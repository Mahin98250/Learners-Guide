import { gdb } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { getCurrentInstituteContext, hasInstitutePermission } from "@/lg/tenant";
import type { ProvisionRole, Kind, Row } from "./AdminRecordsConstants";

export async function ensureAdminSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Unable to read administrator session: ${error.message}`);
  let session = data.session;
  const expiresAt = Number(session?.expires_at || 0);
  if (!session || (expiresAt > 0 && expiresAt <= Math.floor(Date.now() / 1000) + 60)) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("Your administrator session has expired. Please sign in again.");
    }
    session = refreshed.data.session;
  }
  const context = await getCurrentInstituteContext();
  const instituteId = context.membership?.institute_id;
  if (!instituteId) throw new Error("An active institute workspace must be selected before managing accounts.");
  if (!(await hasInstitutePermission(instituteId, "people.manage"))) {
    throw new Error("You do not have permission to manage institute accounts.");
  }
  return session;
}

export async function provision(role: ProvisionRole, loginId: string, name: string, ref: string, action: "create" | "update" | "delete", authId?: string | null, password?: string) {
  await ensureAdminSession();
  const context = await getCurrentInstituteContext();
  const instituteId = context.membership?.institute_id;
  if (!instituteId) throw new Error("An active institute workspace must be selected before provisioning an account.");
  let resolvedAuthId = authId || null;
  if (action === "delete" && !resolvedAuthId) {
    const users = (await gdb("users")) as Array<Record<string, unknown>>;
    const match = users.find((row) =>
      String(row.ref ?? "") === String(ref ?? "") &&
      String(row.role ?? "") === role &&
      row.auth_id
    );
    resolvedAuthId = match?.auth_id ? String(match.auth_id) : null;
  }
  const body: Record<string, unknown> = { action, role, loginId, name, ref, instituteId };
  if (resolvedAuthId) body.authId = resolvedAuthId;
  if (password) body.password = password;

  if (action === "delete") {
    const scoped = await supabase.rpc("remove_institute_account_membership", {
      p_institute_id: instituteId,
      p_auth_id: resolvedAuthId || "",
      p_role_key: role,
    });
    if (scoped.error) throw scoped.error;
    const scopedRow = Array.isArray(scoped.data) ? scoped.data[0] : scoped.data;
    if (!scopedRow?.membership_removed) {
      return { authId: resolvedAuthId || undefined, deleted: false, membershipRemoved: false, remainingMemberships: Number(scopedRow?.remaining_memberships || 0) };
    }
    if (scopedRow.remaining_memberships > 0) {
      return { authId: resolvedAuthId || undefined, deleted: false, membershipRemoved: true, remainingMemberships: Number(scopedRow.remaining_memberships) };
    }
  }

  let result = await supabase.functions.invoke("admin-provision-user", { body });
  if (result.error && /401|unauthorized|jwt|token|authorization/i.test(result.error.message || "")) {
    await ensureAdminSession();
    result = await supabase.functions.invoke("admin-provision-user", { body });
  }
  if (result.error) throw new Error(result.error.message || "Authentication service failed.");
  if (result.data?.error) throw new Error(String(result.data.error));

  if (action !== "delete") {
    const synced = await supabase.rpc("sync_institute_account_membership", {
      p_institute_id: instituteId,
      p_auth_id: String(result.data?.authId || authId || ""),
      p_role_key: role,
      p_name: name,
      p_email: String(result.data?.email || ""),
      p_phone: loginId,
      p_ref: ref,
    });
    if (synced.error) throw synced.error;
  }

  return result.data as { authId?: string; email?: string; deleted?: boolean; repaired?: boolean; created?: boolean; updated?: boolean; membershipRemoved?: boolean; remainingMemberships?: number };
}

export const normalizePhone = (value: string): string => value.replace(/\s+/g, "").trim();
export const validatePassword = (password: string, label: string): void => { if (password.length < 8) throw new Error(`${label} must be at least 8 characters.`); };
export const authRowId = (authId?: string): string => authId || crypto.randomUUID();

export async function nextId(kind: Kind): Promise<string> {
  const rows = (await gdb(kind)) as Row[];
  const field = kind === "students" ? "sid" : "tid";
  const prefix = kind === "students" ? "LG-" : "LGT";
  const width = kind === "students" ? 3 : 2;
  const used = new Set(rows.map((r) => String(r[field] ?? "").trim().toUpperCase()));
  const re = kind === "students" ? /^LG-?(\d+)$/i : /^LGT-?(\d+)$/i;
  let max = 0;
  for (const row of rows) { const match = String(row[field] ?? "").match(re); if (match) max = Math.max(max, Number(match[1])); }
  let n = max + 1;
  let value = `${prefix}${String(n).padStart(width, "0")}`;
  while (used.has(value.toUpperCase())) { n += 1; value = `${prefix}${String(n).padStart(width, "0")}`; }
  return value;
}
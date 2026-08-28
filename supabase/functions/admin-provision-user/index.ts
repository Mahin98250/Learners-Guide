import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_PASSWORDS: Record<string, string> = {
  student: "Student@1234",
  parent: "Parent@1234",
  teacher: "Teacher@1234",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const normalize = (value: string) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeEmail = (value: string) => String(value || "").trim().toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const authEmail = (role: string, id: string, recoveryEmail = "") => {
  const recovery = normalizeEmail(recoveryEmail);
  if (isEmail(recovery)) return recovery;
  if (String(id).includes("@")) return normalizeEmail(id);
  return `${({ teacher: "t", student: "s", parent: "p", admin: "u" } as Record<string, string>)[role] || "u"}.${normalize(id)}@learnersguide.in`;
};

async function listAllUsers(a: ReturnType<typeof createClient>) {
  const users: any[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await a.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}
async function findUser(a: ReturnType<typeof createClient>, email: string) {
  const users = await listAllUsers(a);
  return users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;
}
async function findUserByRefRole(a: ReturnType<typeof createClient>, ref: string | null, role: string) {
  if (!ref) return null;
  const users = await listAllUsers(a);
  return users.find((u) => u.app_metadata?.role === role && String(u.app_metadata?.ref || "") === String(ref)) || null;
}
async function getUser(a: ReturnType<typeof createClient>, id: string | null) {
  if (!id) return null;
  const { data, error } = await a.auth.admin.getUserById(id);
  if (error) {
    if (error.status === 404 || error.code === "user_not_found") return null;
    throw error;
  }
  return data.user || null;
}
async function syncParentLink(admin: ReturnType<typeof createClient>, parentAuthId: string, studentId: string | null) {
  if (!studentId) return;
  const { data: existing, error: readError } = await admin.from("parent_student_links").select("parent_auth_id").eq("parent_auth_id", parentAuthId).eq("student_id", studentId).maybeSingle();
  if (readError) throw new Error(`Unable to verify parent link: ${readError.message}`);
  if (existing) {
    const { error } = await admin.from("parent_student_links").update({ status: "active" }).eq("parent_auth_id", parentAuthId).eq("student_id", studentId);
    if (error) throw new Error(`Unable to activate parent link: ${error.message}`);
    return;
  }
  const { error } = await admin.from("parent_student_links").insert({ parent_auth_id: parentAuthId, student_id: studentId, status: "active" });
  if (error) throw new Error(`Unable to link parent to student: ${error.message}`);
}
async function ensureEmailAvailable(admin: ReturnType<typeof createClient>, email: string, currentAuthId: string | null) {
  if (!isEmail(email)) return null;
  const existing = await findUser(admin, email);
  if (existing && existing.id !== currentAuthId) return existing;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Missing authorization" }, 401);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !anon || !service) return json({ error: "Supabase environment is not configured" }, 500);
    const token = authorization.replace(/^Bearer\s+/i, "");
    const caller = createClient(url, anon);
    const { data: callerData, error: callerError } = await caller.auth.getUser(token);
    if (callerError || !callerData.user) return json({ error: "Invalid authorization" }, 401);
    const admin = createClient(url, service);
    const { data: callerAdmin, error: callerAdminError } = await admin.auth.admin.getUserById(callerData.user.id);
    if (callerAdminError || !callerAdmin.user) return json({ error: "Unable to verify administrator" }, 500);
    if (callerAdmin.user.app_metadata?.role !== "admin") return json({ error: "Administrator access required" }, 403);

    const body = await req.json();
    const action = String(body.action || "").trim().toLowerCase();
    const role = String(body.role || "").trim().toLowerCase();
    const loginId = String(body.loginId || "").trim();
    const suppliedPassword = String(body.password || "");
    const name = String(body.name || "User").trim() || "User";
    const ref = body.ref ? String(body.ref) : null;
    const authId = body.authId ? String(body.authId) : null;
    const recoveryEmail = normalizeEmail(String(body.recoveryEmail || ""));
    if (!["student", "parent", "teacher"].includes(role)) return json({ error: "Invalid role" }, 400);
    if (!["create", "update", "delete"].includes(action)) return json({ error: "Unsupported action" }, 400);
    if (recoveryEmail && !isEmail(recoveryEmail)) return json({ error: "Enter a valid recovery email address." }, 400);
    const email = authEmail(role, loginId, recoveryEmail);
    const existingByEmail = email ? await findUser(admin, email) : null;
    // On create, honor an explicitly supplied password; otherwise fall back to the role default.
    const password = action === "create" ? (suppliedPassword || DEFAULT_PASSWORDS[role] || "") : suppliedPassword;

    if (action === "delete") {
      let user = await getUser(admin, authId);
      if (!user) user = await findUserByRefRole(admin, ref, role);
      if (!user) user = existingByEmail;
      if (!user) return json({ deleted: true, alreadyMissing: true });
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) return json({ error: `Unable to delete authentication account: ${error.message}` }, 502);
      return json({ authId: user.id, deleted: true });
    }

    if (!loginId) return json({ error: "Login ID is required" }, 400);
    if (action === "create") {
      if (!password) return json({ error: "Password is required" }, 400);
      if (existingByEmail) {
        const existingRole = existingByEmail.app_metadata?.role;
        const existingRef = existingByEmail.app_metadata?.ref;
        if (existingRole && existingRole !== role) return json({ error: "This login ID is already used by another account type." }, 409);
        if (existingRef && ref && String(existingRef) !== String(ref)) return json({ error: "This login ID is already linked to another institute profile." }, 409);
        const { data, error } = await admin.auth.admin.updateUserById(existingByEmail.id, { email: isEmail(recoveryEmail) ? recoveryEmail : existingByEmail.email, email_confirm: true, password, user_metadata: { ...(existingByEmail.user_metadata || {}), name, phone: loginId }, app_metadata: { ...(existingByEmail.app_metadata || {}), role, ref } });
        if (error) return json({ error: `Unable to repair authentication account: ${error.message}` }, 502);
        if (role === "parent") await syncParentLink(admin, data.user.id, ref);
        return json({ authId: data.user.id, email: data.user.email, updated: true, repaired: true });
      }
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, phone: loginId }, app_metadata: { role, ref } });
      if (error) return json({ error: `Unable to create authentication account: ${error.message}` }, 502);
      if (role === "parent") await syncParentLink(admin, data.user.id, ref);
      return json({ authId: data.user.id, email: data.user.email, created: true });
    }

    let user = await getUser(admin, authId);
    if (!user) user = await findUserByRefRole(admin, ref, role);
    if (!user) user = existingByEmail;
    if (!user) {
      if (!password) return json({ error: "Authentication account not found. A password is required to recreate it.", code: "AUTH_ACCOUNT_MISSING" }, 404);
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, phone: loginId }, app_metadata: { role, ref } });
      if (error) return json({ error: `Unable to repair authentication account: ${error.message}` }, 502);
      if (role === "parent") await syncParentLink(admin, data.user.id, ref);
      return json({ authId: data.user.id, email: data.user.email, created: true, repaired: true });
    }
    const existingRole = user.app_metadata?.role;
    if (existingRole && existingRole !== role) return json({ error: "The authentication account belongs to a different role." }, 409);
    if (isEmail(recoveryEmail)) {
      const conflict = await ensureEmailAvailable(admin, recoveryEmail, user.id);
      if (conflict) return json({ error: "That email address is already assigned to another account. Please use a different email address." }, 409);
    }
    const patch: Record<string, unknown> = { user_metadata: { ...(user.user_metadata || {}), name, phone: loginId }, app_metadata: { ...(user.app_metadata || {}), role, ref } };
    if (password) patch.password = password;
    if (isEmail(recoveryEmail)) { patch.email = recoveryEmail; patch.email_confirm = true; }
    const { data, error } = await admin.auth.admin.updateUserById(user.id, patch);
    if (error) return json({ error: `Unable to update authentication account: ${error.message}` }, 502);
    if (role === "parent") await syncParentLink(admin, data.user.id, ref);
    return json({ authId: data.user.id, email: data.user.email, updated: true, repaired: authId !== data.user.id });
  } catch (error) {
    console.error("admin-provision-user:", error);
    return json({ error: error instanceof Error ? error.message : "Provisioning failed" }, 500);
  }
});

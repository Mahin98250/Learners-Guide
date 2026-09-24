import { useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";
import { getCurrentInstituteContext } from "@/lg/tenant";

export type AdminNavPermission =
  | "students.manage"
  | "teachers.manage"
  | "people.read"
  | "academics.manage"
  | "attendance.read"
  | "attendance.manage"
  | "homework.manage"
  | "assessments.manage"
  | "assessments.read"
  | "materials.manage"
  | "reports.read"
  | "fees.read"
  | "announcements.manage"
  | "notifications.read"
  | "integrations.read";

export async function getCurrentInstitutePermissionSet(instituteId: string): Promise<Set<string>> {
  const id = String(instituteId || "").trim();
  if (!id) return new Set();
  const { data, error } = await supabase.rpc("get_current_institute_permissions", {
    p_institute_id: id,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return new Set(
    rows
      .map((row: unknown) => {
        if (typeof row === "string") return row.trim();
        if (row && typeof row === "object" && "permission_code" in row) {
          return String((row as { permission_code?: unknown }).permission_code || "").trim();
        }
        return "";
      })
      .filter(Boolean),
  );
}

export function useCurrentInstitutePermissions(instituteId?: string | null) {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const id = String(instituteId || "").trim();
    setLoading(true);
    setError("");
    if (!id) {
      setPermissions(new Set());
      setLoading(false);
      return () => { live = false; };
    }

    void getCurrentInstitutePermissionSet(id)
      .then((next) => {
        if (!live) return;
        setPermissions(next);
      })
      .catch((reason) => {
        if (!live) return;
        setPermissions(new Set());
        setError(reason instanceof Error ? reason.message : "Unable to load your institute permissions.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => { live = false; };
  }, [instituteId]);

  const can = (permission: string) => permissions.has(permission);
  return { permissions, can, loading, error };
}

export async function getCurrentAdminPermissionContext() {
  const context = await getCurrentInstituteContext();
  const instituteId = context.membership?.institute_id || "";
  return {
    ...context,
    instituteId,
    permissions: instituteId ? await getCurrentInstitutePermissionSet(instituteId) : new Set<string>(),
  };
}

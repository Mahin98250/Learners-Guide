import { supabase } from "@/lg/supabase";

export type InstituteTenant = {
  institute_id: string;
  slug: string;
  name: string;
  status: string;
  display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  login_title: string | null;
  powered_by_enabled: boolean;
  timezone: string;
  locale: string;
};

export type InstituteMembershipContext = {
  institute_id: string;
  role: string;
  role_id: string | null;
  status: string;
};

export function normalizeHostname(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export function getCurrentHostname() {
  if (typeof window === "undefined") return "";
  return normalizeHostname(window.location.hostname);
}

/**
 * Public branding/routing lookup performed before authentication.
 * This does not grant institute data access.
 */
export async function resolveInstituteForCurrentHostname(): Promise<InstituteTenant | null> {
  const hostname = getCurrentHostname();
  if (!hostname) return null;

  const { data, error } = await supabase.rpc("resolve_institute_domain", {
    p_hostname: hostname,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as InstituteTenant) : null;
}

/**
 * Resolves the authenticated user's active institute memberships.
 * When a hostname is mapped to an institute, that institute is selected and
 * must also be present in the user's membership set.
 */
export async function getCurrentInstituteContext() {
  const tenant = await resolveInstituteForCurrentHostname();
  const { data, error } = await supabase
    .from("institute_memberships")
    .select("institute_id,role,role_id,status")
    .eq("status", "active");

  if (error) throw error;

  const memberships = (data || []) as InstituteMembershipContext[];
  if (tenant) {
    const membership = memberships.find((item) => item.institute_id === tenant.institute_id) || null;
    return { tenant, membership, memberships };
  }

  if (memberships.length === 1) {
    return { tenant: null, membership: memberships[0], memberships };
  }

  return { tenant: null, membership: null, memberships };
}

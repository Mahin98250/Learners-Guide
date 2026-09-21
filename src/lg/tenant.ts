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
  institute_name?: string | null;
  display_name?: string | null;
  slug?: string | null;
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

const ACTIVE_INSTITUTE_STORAGE_KEY = "lg-active-institute-id";

export function getPreferredInstituteId() {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_INSTITUTE_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setPreferredInstituteId(instituteId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_INSTITUTE_STORAGE_KEY, instituteId);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
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

  let memberships = (data || []) as InstituteMembershipContext[];
  if (memberships.length) {
    const ids = memberships.map((item) => item.institute_id);
    const [{ data: institutes, error: instituteError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from("institutes").select("id,name,slug,status").in("id", ids),
      supabase.from("institute_settings").select("institute_id,display_name,timezone,locale").in("institute_id", ids),
    ]);
    if (instituteError) throw instituteError;
    if (settingsError) throw settingsError;
    const instituteMap = new Map((institutes || []).map((item: any) => [String(item.id), item]));
    const settingsMap = new Map((settings || []).map((item: any) => [String(item.institute_id), item]));
    memberships = memberships.map((item) => {
      const institute = instituteMap.get(item.institute_id);
      const setting = settingsMap.get(item.institute_id);
      return {
        ...item,
        institute_name: institute?.name ?? null,
        display_name: setting?.display_name ?? null,
        slug: institute?.slug ?? null,
      };
    });
  }

  if (tenant) {
    const membership = memberships.find((item) => item.institute_id === tenant.institute_id) || null;
    return { tenant, membership, memberships };
  }

  const preferredId = getPreferredInstituteId();
  if (preferredId) {
    const preferred = memberships.find((item) => item.institute_id === preferredId) || null;
    if (preferred) {
      const preferredTenant = preferred.institute_name
        ? {
            institute_id: preferred.institute_id,
            slug: preferred.slug || "",
            name: preferred.institute_name,
            status: preferred.status,
            display_name: preferred.display_name || preferred.institute_name,
            logo_url: null,
            favicon_url: null,
            primary_color: null,
            secondary_color: null,
            login_title: null,
            powered_by_enabled: true,
            timezone: "Asia/Kolkata",
            locale: "en-IN",
          }
        : null;
      return { tenant: preferredTenant, membership: preferred, memberships };
    }
  }

  if (memberships.length === 1) {
    const only = memberships[0];
    const onlyTenant = only.institute_name
      ? {
          institute_id: only.institute_id,
          slug: only.slug || "",
          name: only.institute_name,
          status: only.status,
          display_name: only.display_name || only.institute_name,
          logo_url: null,
          favicon_url: null,
          primary_color: null,
          secondary_color: null,
          login_title: null,
          powered_by_enabled: true,
          timezone: "Asia/Kolkata",
          locale: "en-IN",
        }
      : null;
    return { tenant: onlyTenant, membership: only, memberships };
  }

  return { tenant: null, membership: null, memberships };
}

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
 * Resolves a verified institute domain before authentication.
 *
 * This is a branding/routing lookup only. It never grants access to institute
 * data; post-login authorization remains membership + RLS based.
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

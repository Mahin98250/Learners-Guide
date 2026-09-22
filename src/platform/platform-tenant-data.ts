import { supabase } from "@/lg/supabase";

export type PlatformInstituteDetail = {
  institute: {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
  };
  settings: Record<string, unknown> | null;
  domains: Array<{
    id: string;
    hostname: string;
    domain_type: string;
    status: string;
    tls_status: string;
    is_primary: boolean;
    verified_at: string | null;
    created_at: string;
  }>;
  entitlements: Array<{
    feature_code: string;
    enabled: boolean;
  }>;
  membership_count: number;
  active_membership_count: number;
};

export async function getPlatformInstituteDetail(
  instituteId: string,
): Promise<PlatformInstituteDetail> {
  const { data, error } = await supabase.rpc("platform_get_institute_detail", {
    p_institute_id: instituteId,
  });

  if (error) throw error;

  const raw = (data ?? {}) as Partial<PlatformInstituteDetail>;
  return {
    institute: raw.institute as PlatformInstituteDetail["institute"],
    settings: raw.settings ?? null,
    domains: Array.isArray(raw.domains)
      ? (raw.domains as PlatformInstituteDetail["domains"])
      : [],
    entitlements: Array.isArray(raw.entitlements)
      ? (raw.entitlements as PlatformInstituteDetail["entitlements"])
      : [],
    membership_count: Number(raw.membership_count) || 0,
    active_membership_count: Number(raw.active_membership_count) || 0,
  };
}

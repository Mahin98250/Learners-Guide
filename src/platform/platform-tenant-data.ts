import { supabase } from "@/lg/supabase";

export type PlatformInstitute = {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended" | "archived" | string;
  created_at: string;
};

export type PlatformInstituteCursor = {
  created_at: string;
  id: string;
};

export type PlatformInstitutePage = {
  items: PlatformInstitute[];
  has_more: boolean;
  next_cursor: PlatformInstituteCursor | null;
};

export type PlatformInstituteDirectoryParams = {
  limit?: number;
  cursor?: PlatformInstituteCursor | null;
  search?: string;
  status?: "trial" | "active" | "suspended" | "archived" | "all";
};

function normalizeLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.min(Math.max(Math.trunc(numeric), 1), 100);
}

const STATUS_COUNTS_CACHE_TTL_MS = 5_000;
let statusCountsCache: { value: Record<string, number>; expiresAt: number } | null = null;
let statusCountsPromise: Promise<Record<string, number>> | null = null;

export function invalidatePlatformInstituteStatusCounts() {
  statusCountsCache = null;
}

export async function listPlatformInstitutes(
  params: PlatformInstituteDirectoryParams = {},
): Promise<PlatformInstitutePage> {
  const cursor = params.cursor ?? null;
  const { data, error } = await supabase.rpc("platform_list_institutes", {
    p_limit: normalizeLimit(params.limit),
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_search: String(params.search ?? "").trim() || null,
    p_status: params.status && params.status !== "all" ? params.status : null,
  });

  if (error) throw error;

  const raw = (data ?? {}) as Partial<PlatformInstitutePage>;
  return {
    items: Array.isArray(raw.items) ? (raw.items as PlatformInstitute[]) : [],
    has_more: raw.has_more === true,
    next_cursor: raw.next_cursor
      ? {
          created_at: String(raw.next_cursor.created_at ?? ""),
          id: String(raw.next_cursor.id ?? ""),
        }
      : null,
  };
}

export async function getPlatformInstituteStatusCounts(): Promise<Record<string, number>> {
  const now = Date.now();
  if (statusCountsCache && statusCountsCache.expiresAt > now) {
    return statusCountsCache.value;
  }

  if (statusCountsPromise) return statusCountsPromise;

  statusCountsPromise = (async () => {
    const { data, error } = await supabase.rpc("platform_institute_status_counts");
    if (error) throw error;

    const raw = (data ?? {}) as Record<string, unknown>;
    const value = Object.fromEntries(
      Object.entries(raw).map(([key, count]) => [key, Number(count) || 0]),
    );
    statusCountsCache = {
      value,
      expiresAt: Date.now() + STATUS_COUNTS_CACHE_TTL_MS,
    };
    return value;
  })().finally(() => {
    statusCountsPromise = null;
  });

  return statusCountsPromise;
}

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

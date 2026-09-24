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

export type PlatformInstituteOverview = {
  institute: {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
  };
  people: {
    students: number;
    teachers: number;
    admin_portals: number;
    total_active: number;
  };
  activity: {
    materials: number;
    homework: number;
    tests: number;
    announcements: number;
    attendance_records: number;
  };
  storage: {
    used_bytes: number;
    limit_bytes: number | null;
    tracked_sources: {
      study_materials_bytes: number;
      homework_bytes: number;
    };
  };
};

export async function getPlatformInstituteOverview(
  instituteId: string,
): Promise<PlatformInstituteOverview> {
  const { data, error } = await supabase.rpc("platform_get_institute_overview", {
    p_institute_id: instituteId,
  });

  if (error) throw error;

  const raw = (data ?? {}) as Partial<PlatformInstituteOverview>;
  const people = (raw.people ?? {}) as Partial<PlatformInstituteOverview["people"]>;
  const activity = (raw.activity ?? {}) as Partial<PlatformInstituteOverview["activity"]>;
  const storage = (raw.storage ?? {}) as Partial<PlatformInstituteOverview["storage"]>;
  const tracked = (storage.tracked_sources ?? {}) as Partial<PlatformInstituteOverview["storage"]["tracked_sources"]>;

  return {
    institute: raw.institute as PlatformInstituteOverview["institute"],
    people: {
      students: Number(people.students) || 0,
      teachers: Number(people.teachers) || 0,
      admin_portals: Number(people.admin_portals) || 0,
      total_active: Number(people.total_active) || 0,
    },
    activity: {
      materials: Number(activity.materials) || 0,
      homework: Number(activity.homework) || 0,
      tests: Number(activity.tests) || 0,
      announcements: Number(activity.announcements) || 0,
      attendance_records: Number(activity.attendance_records) || 0,
    },
    storage: {
      used_bytes: Number(storage.used_bytes) || 0,
      limit_bytes: storage.limit_bytes == null ? null : Number(storage.limit_bytes) || null,
      tracked_sources: {
        study_materials_bytes: Number(tracked.study_materials_bytes) || 0,
        homework_bytes: Number(tracked.homework_bytes) || 0,
      },
    },
  };
}


export type PlatformStorageInstitute = {
  id: string;
  name: string;
  slug: string;
  status: string;
  used_bytes: number;
  study_materials_bytes: number;
  homework_bytes: number;
  quota_bytes: number | null;
};

export type PlatformStorageOverview = {
  totals: {
    institutes: number;
    institutes_with_storage: number;
    used_bytes: number;
    study_materials_bytes: number;
    homework_bytes: number;
    configured_quota_bytes: number;
  };
  institutes: PlatformStorageInstitute[];
};

export async function getPlatformStorageOverview(): Promise<PlatformStorageOverview> {
  const { data, error } = await supabase.rpc("platform_get_storage_overview");
  if (error) throw error;

  const raw = (data ?? {}) as Partial<PlatformStorageOverview>;
  const totals = (raw.totals ?? {}) as Partial<PlatformStorageOverview["totals"]>;
  const rows = Array.isArray(raw.institutes) ? raw.institutes : [];

  return {
    totals: {
      institutes: Number(totals.institutes) || 0,
      institutes_with_storage: Number(totals.institutes_with_storage) || 0,
      used_bytes: Number(totals.used_bytes) || 0,
      study_materials_bytes: Number(totals.study_materials_bytes) || 0,
      homework_bytes: Number(totals.homework_bytes) || 0,
      configured_quota_bytes: Number(totals.configured_quota_bytes) || 0,
    },
    institutes: rows.map((row) => {
      const item = (row ?? {}) as Partial<PlatformStorageInstitute>;
      return {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        slug: String(item.slug ?? ""),
        status: String(item.status ?? ""),
        used_bytes: Number(item.used_bytes) || 0,
        study_materials_bytes: Number(item.study_materials_bytes) || 0,
        homework_bytes: Number(item.homework_bytes) || 0,
        quota_bytes: item.quota_bytes == null ? null : Number(item.quota_bytes) || null,
      };
    }),
  };
}


export type PlatformHealthCheck = {
  key: string;
  label: string;
  status: "healthy" | "degraded" | "attention";
  message: string;
  detail: string;
};

export type PlatformSystemHealth = {
  overall: "healthy" | "degraded" | "attention";
  checked_at: string;
  summary: {
    institutes: number;
    active_institutes: number;
    registered_domains: number;
    primary_domains: number;
    storage_buckets: number;
    audit_events: number;
  };
  configuration: {
    default_app_domain: string | null;
    automatic_subdomains_enabled: boolean;
  };
  checks: PlatformHealthCheck[];
};

export async function getPlatformSystemHealth(): Promise<PlatformSystemHealth> {
  const { data, error } = await supabase.rpc("platform_get_system_health");
  if (error) throw error;

  const raw = (data ?? {}) as Partial<PlatformSystemHealth>;
  const summary = (raw.summary ?? {}) as Partial<PlatformSystemHealth["summary"]>;
  const configuration = (raw.configuration ?? {}) as Partial<PlatformSystemHealth["configuration"]>;
  const checks = Array.isArray(raw.checks) ? raw.checks : [];

  return {
    overall: raw.overall === "attention" || raw.overall === "degraded" ? raw.overall : "healthy",
    checked_at: String(raw.checked_at ?? new Date().toISOString()),
    summary: {
      institutes: Number(summary.institutes) || 0,
      active_institutes: Number(summary.active_institutes) || 0,
      registered_domains: Number(summary.registered_domains) || 0,
      primary_domains: Number(summary.primary_domains) || 0,
      storage_buckets: Number(summary.storage_buckets) || 0,
      audit_events: Number(summary.audit_events) || 0,
    },
    configuration: {
      default_app_domain: configuration.default_app_domain == null ? null : String(configuration.default_app_domain),
      automatic_subdomains_enabled: configuration.automatic_subdomains_enabled === true,
    },
    checks: checks.map((row) => {
      const item = (row ?? {}) as Partial<PlatformHealthCheck>;
      const status = item.status === "attention" || item.status === "degraded" ? item.status : "healthy";
      return {
        key: String(item.key ?? ""),
        label: String(item.label ?? ""),
        status,
        message: String(item.message ?? ""),
        detail: String(item.detail ?? ""),
      };
    }),
  };
}

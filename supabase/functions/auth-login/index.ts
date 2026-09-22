import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const clean = (v: unknown) => String(v ?? "").trim();
const key = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, "");
const inactive = (v: unknown) => ["inactive", "disabled", "suspended", "deleted"].includes(clean(v).toLowerCase());
const prefix: Record<string, string> = { teacher: "t", student: "s", parent: "p" };

const normalizeHostname = (value: unknown) => clean(value).toLowerCase().replace(/^https?:\\/\\//, "").replace(/\\/+$/, "");

async function resolveTenant(admin: ReturnType<typeof createClient>, hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;
  const { data: domain, error: domainError } = await admin
    .from("institute_domains")
    .select("institute_id,status,tls_status")
    .eq("hostname", normalized)
    .maybeSingle();
  if (domainError) throw domainError;
  if (!domain || domain.status !== "verified" || !["active", "provisioning"].includes(String(domain.tls_status || ""))) return null;
  const { data: institute, error: instituteError } = await admin
    .from("institutes")
    .select("id,status")
    .eq("id", domain.institute_id)
    .maybeSingle();
  if (instituteError) throw instituteError;
  if (!institute || !["trial", "active"].includes(String(institute.status || ""))) return null;
  return { instituteId: String(institute.id), hostname: normalized };
}

async function hasTenantMembership(
  admin: ReturnType<typeof createClient>,
  authId: string,
  instituteId: string,
  role: string,
) {
  const { data: person, error: personError } = await admin
    .from("people")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (personError) throw personError;
  if (!person) return false;
  const { data: membership, error: membershipError } = await admin
    .from("institute_memberships")
    .select("id,role,status")
    .eq("institute_id", instituteId)
    .eq("person_id", person.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return false;
  return String(membership.role || "").toLowerCase() === role;
}

async function firstTenantBoundUser(
  admin: ReturnType<typeof createClient>,
  candidates: any[],
  instituteId: string | null,
  role: string,
) {
  for (const candidate of candidates || []) {
    if (!candidate?.id) continue;
    if (!instituteId || await hasTenantMembership(admin, String(candidate.id), instituteId, role)) return candidate;
  }
  return null;
}
const emailFor = (loginId: string, role: string) => {
  const value = clean(loginId);
  if (value.includes("@")) return value.toLowerCase();
  return `${prefix[role] || "u"}.${key(value)}@learnersguide.in`;
};

async function findAuthUserByUsersRow(admin: ReturnType<typeof createClient>, role: string, loginId: string, ref?: string) {
  const query = admin.from("users").select("auth_id,email,ref,phone,status,role").eq("role", role).limit(1);
  const { data, error } = ref ? await query.eq("ref", ref).maybeSingle() : await query.eq("phone", loginId).maybeSingle();
  if (error || !data) return null;
  if (inactive(data.status)) return { blocked: true, user: null, row: data };
  if (!data.auth_id) return { blocked: false, user: null, row: data };
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(data.auth_id);
  if (authError || !authData.user) return { blocked: false, user: null, row: data };
  return { blocked: false, user: authData.user, row: data };
}

async function findTeacherAuthByTid(admin: ReturnType<typeof createClient>, tid: string) {
  const { data: teacher, error } = await admin.from("teachers").select("id,status").eq("tid", tid).limit(1).maybeSingle();
  if (error || !teacher) return null;
  if (inactive(teacher.status)) return { blocked: true, user: null, ref: String(teacher.id) };
  return findAuthUserByUsersRow(admin, "teacher", "", String(teacher.id));
}

async function findAuthUserByRoleAndLoginFallback(admin: ReturnType<typeof createClient>, role: string, loginId: string) {
  const normalized = key(loginId);
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => {
      if (u.app_metadata?.role !== role) return false;
      const phone = key(u.user_metadata?.phone || "");
      const email = clean(u.email).toLowerCase();
      return phone === normalized || email === clean(loginId).toLowerCase();
    });
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function findAuthUserByRefFallback(admin: ReturnType<typeof createClient>, role: string, ref: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.app_metadata?.role === role && String(u.app_metadata?.ref || "") === String(ref));
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !anon || !service) return json({ error: "Authentication service is not configured" }, 500);

    const body = await req.json();
    const loginId = clean(body.loginId);
    const password = String(body.password || "");
    const role = clean(body.role).toLowerCase();
    if (!loginId || !password) return json({ error: "Invalid login ID or password." }, 400);
    if (!["student", "teacher", "parent"].includes(role)) return json({ error: "Invalid account type." }, 400);

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    let email = emailFor(loginId, role);
    let authId = "";

    if (role === "student") {
      let student: any = null;
      for (const column of ["sid", "id"]) {
        const { data, error } = await admin.from("students").select("id,sid,status").eq(column, loginId).limit(1).maybeSingle();
        if (error) return json({ error: "Unable to verify login. Please try again." }, 503);
        if (data) { student = data; break; }
      }
      if (!student) return json({ error: "Invalid login ID or password." }, 401);
      if (tenant && String(student.institute_id || "") !== tenant.instituteId) return json({ error: "This login is not available on this institute portal." }, 403);
      if (inactive(student.status)) return json({ error: "This account is inactive. Please contact the institute administrator." }, 403);
      const profile = await findAuthUserByUsersRow(admin, role, loginId, String(student.id));
      if (profile?.blocked) return json({ error: "This account is inactive. Please contact the institute administrator." }, 403);
      if (profile?.user && (!tenant || await hasTenantMembership(admin, profile.user.id, tenant.instituteId, role))) {
        authId = profile.user.id;
        email = clean(profile.user.email).toLowerCase() || clean(profile.row.email).toLowerCase() || email;
      }
      if (!authId) {
        const fallback = await findAuthUserByRoleAndLoginFallback(admin, role, loginId);
        const tenantBound = await firstTenantBoundUser(admin, fallback ? [fallback] : [], tenant?.instituteId || null, role);
        if (tenantBound) { authId = tenantBound.id; email = clean(tenantBound.email).toLowerCase() || email; }
      }
    } else {
      let profile = await findAuthUserByUsersRow(admin, role, loginId);
      if (!profile && role === "teacher") profile = await findTeacherAuthByTid(admin, loginId);
      if (profile?.blocked) return json({ error: "This account is inactive. Please contact the institute administrator." }, 403);

      let authUser = profile?.user || null;
      if (authUser && tenant && !(await hasTenantMembership(admin, authUser.id, tenant.instituteId, role))) authUser = null;
      if (authUser) {
        authId = authUser.id;
        email = clean(authUser.email).toLowerCase() || clean(profile?.row?.email).toLowerCase() || email;
      } else {
        const fallback = await findAuthUserByRoleAndLoginFallback(admin, role, loginId);
        authUser = await firstTenantBoundUser(admin, fallback ? [fallback] : [], tenant?.instituteId || null, role);
        if (authUser) { authId = authUser.id; email = clean(authUser.email).toLowerCase() || email; }
      }

      if (!authUser) {
        const { data: appUsers, error } = await admin.from("users").select("auth_id,email,ref,phone,status,role").eq("role", role).eq("phone", loginId).limit(20);
        if (!error) {
          for (const appUser of appUsers || []) {
            if (inactive(appUser.status)) continue;
            const candidateId = clean(appUser.auth_id);
            let candidateUser = null;
            if (candidateId) {
              const { data: byId, error: byIdError } = await admin.auth.admin.getUserById(candidateId);
              if (!byIdError && byId.user) candidateUser = byId.user;
            }
            if (!candidateUser && appUser.ref) candidateUser = await findAuthUserByRefFallback(admin, role, String(appUser.ref));
            if (candidateUser && (!tenant || await hasTenantMembership(admin, candidateUser.id, tenant.instituteId, role))) {
              authUser = candidateUser;
              break;
            }
          }
        }
        if (authUser) {
          authId = authUser.id;
          email = clean(authUser.email).toLowerCase() || email;
        }
      }
      if (!authUser) return json({ error: "Invalid login ID or password." }, 401);
      if (inactive(authUser.user_metadata?.status)) return json({ error: "This account is inactive. Please contact the institute administrator." }, 403);
      email = clean(authUser.email).toLowerCase() || email;
    }

    if (!email) return json({ error: "Your authentication account is not configured. Please contact the institute administrator." }, 401);
    const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      console.error("auth-login invalid credentials", { role, authId, error: error?.message });
      return json({ error: "Invalid login ID or password." }, 401);
    }
    if (data.user.app_metadata?.role !== role) {
      await client.auth.signOut();
      return json({ error: "That account is registered under a different role." }, 403);
    }
    if (tenant && !(await hasTenantMembership(admin, data.user.id, tenant.instituteId, role))) {
      await client.auth.signOut();
      return json({ error: "This account does not belong to this institute portal." }, 403);
    }
    return json({ session: data.session, user: data.user, tenant: tenant ? { institute_id: tenant.instituteId, hostname: tenant.hostname } : null }, 200);
  } catch (error) {
    console.error("auth-login:", error);
    return json({ error: "Unable to sign in right now. Please try again." }, 500);
  }
});

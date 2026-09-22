import { supabase } from "@/lg/supabase";
import { getCurrentInstituteContext, getCurrentHostname } from "@/lg/tenant";

/**
 * Production authentication for Mahin.
 * Passwords are handled only by Supabase Auth.
 * Role/ref are read from server-managed app_metadata.
 * Profile existence and active status are re-checked after every online login.
 * Previously authenticated users may continue offline using the persisted Supabase session.
 */
const ACCOUNT_DOMAIN = "learnersguide.in";
const PREFIX = { teacher: "t", student: "s", parent: "p" };
const OFFLINE_LOGIN_KEY = "lg_offline_login_v1";

export const normalizeId = (loginId) => String(loginId || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
export const authEmail = (loginId, role) => {
  const clean = String(loginId || "").trim().toLowerCase();
  if (clean.includes("@")) return clean;
  if (role === "admin") return clean;
  return `${PREFIX[role] || "u"}.${normalizeId(loginId)}@${ACCOUNT_DOMAIN}`;
};

const profileConfig = {
  student: { table: "students", statusField: "status" },
  teacher: { table: "teachers", statusField: "status" },
};
const inactiveStatuses = ["inactive", "disabled", "suspended", "deleted"];
const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
const readOfflineIdentity = () => { try { return JSON.parse(localStorage.getItem(OFFLINE_LOGIN_KEY) || "null"); } catch { return null; } };
const saveOfflineIdentity = (loginId, role, userId) => { try { localStorage.setItem(OFFLINE_LOGIN_KEY, JSON.stringify({ loginId: normalizeId(loginId), role, userId, savedAt: Date.now() })); } catch {} };

const toUser = (authUser, requestedRole) => {
  const userMetadata = authUser?.user_metadata || {};
  const appMetadata = authUser?.app_metadata || {};
  return { id: authUser.id, name: userMetadata.name || userMetadata.phone || "User", phone: userMetadata.phone || "", role: appMetadata.role || requestedRole || "", ref: appMetadata.ref || null };
};

const validateProfile = async (user, role) => {
  if (role === "admin") return { ok: true, error: null };
  if (!user.ref) return { ok: false, error: "Your account is not linked to an institute profile yet. Please contact the administrator." };
  if (role === "parent") {
    const { data: links, error: linkError } = await supabase.from("parent_student_links").select("student_id,status").eq("parent_auth_id", user.id).eq("status", "active");
    if (linkError) return { ok: false, error: "We could not verify your parent profile. Please try again." };
    if (!links?.length) return { ok: false, error: "Your parent account is not linked to an active student. Please contact the administrator." };
    const studentIds = [...new Set(links.map((link) => String(link.student_id || "")).filter(Boolean))];
    const { data: students, error: studentError } = await supabase.from("students").select("id,status").in("id", studentIds);
    if (studentError) return { ok: false, error: "We could not verify your linked student profile. Please try again." };
    const activeStudent = (students || []).find((student) => !inactiveStatuses.includes(String(student.status || "active").toLowerCase()));
    if (!activeStudent) return { ok: false, error: "Your linked student account is inactive. Please contact the institute administrator." };
    return { ok: true, error: null };
  }
  const config = profileConfig[role];
  if (!config) return { ok: false, error: "This account type is not supported." };
  const { data, error } = await supabase.from(config.table).select(`id,${config.statusField}`).eq("id", user.ref).maybeSingle();
  if (error) return { ok: false, error: "We could not verify your institute profile. Please try again." };
  if (!data) return { ok: false, error: "Your institute profile no longer exists. Please contact the administrator." };
  const status = String(data[config.statusField] || "active").toLowerCase();
  if (inactiveStatuses.includes(status)) return { ok: false, error: "This account is inactive. Please contact the institute administrator." };
  return { ok: true, error: null };
};

async function readFunctionError(error, fallback = "Unable to sign in right now. Please try again.") {
  try { const response = error?.context; if (response && typeof response.clone === "function") { const body = await response.clone().json(); if (typeof body?.error === "string" && body.error.trim()) return body.error.trim(); if (typeof body?.message === "string" && body.message.trim()) return body.message.trim(); } } catch {}
  return fallback;
}

async function signInViaGateway(loginId, password, role) {
  let data = null, error = null;
  try { const result = await supabase.functions.invoke("auth-login", { body: { loginId, password, role, hostname: typeof window !== "undefined" ? getCurrentHostname() : "" } }); data = result.data; error = result.error; } catch (invokeError) { error = invokeError; }
  if (!error && data?.session?.access_token && data?.session?.refresh_token && data?.user) {
    const session = { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    let { data: sessionData, error: sessionError } = await supabase.auth.setSession(session);
    if (sessionError || !sessionData.user) { await supabase.auth.signOut({ scope: "local" }).catch(() => {}); const retry = await supabase.auth.setSession(session); sessionData = retry.data; sessionError = retry.error; }
    if (sessionError || !sessionData.user) return { user: null, error: "Unable to establish a secure session. Please try again." };
    return { user: sessionData.user, error: null };
  }

  // Login happens before a JWT exists. If the Edge gateway is still deployed with
  // JWT verification enabled, its platform-level 401 must not make every user unable
  // to sign in. Fall back to the deterministic Supabase Auth email used at provisioning.
  const fallbackEmail = authEmail(loginId, role);
  const fallback = await supabase.auth.signInWithPassword({ email: fallbackEmail, password });
  if (!fallback.error && fallback.data?.user) return { user: fallback.data.user, error: null };
  if (error) return { user: null, error: await readFunctionError(error, fallback.error?.message || "Unable to sign in right now. Please try again.") };
  return { user: null, error: fallback.error?.message || "Invalid login ID or password." };
}

async function signInAdminDirectly(loginId, password) {
  const email = authEmail(loginId, "admin");
  if (!email.includes("@")) return { user: null, error: "Administrator login requires the administrator email address." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return { user: null, error: error?.message || "Invalid admin login ID or password." };
  return { user: data.user, error: null };
}

async function offlineSignIn(loginId, role) {
  const identity = readOfflineIdentity();
  if (!identity || identity.role !== role || identity.loginId !== normalizeId(loginId)) return { user: null, error: "You're offline. Sign in once while connected to the internet before using offline login." };
  const { data, error } = await supabase.auth.getSession();
  const authUser = data?.session?.user;
  if (error || !authUser) return { user: null, error: "Your offline session has expired. Connect to the internet and sign in again." };
  const user = toUser(authUser, role);
  if (user.id !== identity.userId || user.role !== role) return { user: null, error: "Your offline session could not be verified. Connect to the internet and sign in again." };
  return { user, error: null, offline: true };
}

export async function signIn(loginId, password, role) {
  const cleanLogin = String(loginId || "").trim();
  if (!cleanLogin || !password) return { user: null, error: "Enter your login ID and password." };
  if (!["admin", "student", "teacher", "parent"].includes(role)) return { user: null, error: "Please select a valid account type." };

  if (isOffline()) return offlineSignIn(cleanLogin, role);

  let authResult;
  try { authResult = role === "admin" ? await signInAdminDirectly(cleanLogin, password) : await signInViaGateway(cleanLogin, password, role); }
  catch { authResult = { user: null, error: "Unable to sign in right now. Please try again." }; }
  if (!authResult.user) return authResult;
  const appRole = authResult.user.app_metadata?.role;
  if (!appRole) { await supabase.auth.signOut({ scope: "local" }).catch(() => {}); return { user: null, error: "Your account has not been approved by the institute administrator yet." }; }
  if (appRole !== role) { await supabase.auth.signOut({ scope: "local" }).catch(() => {}); return { user: null, error: `That account is registered as a ${appRole}.` }; }
  const user = toUser(authResult.user, role);
  try {
    const context = await getCurrentInstituteContext();
    if (context.tenant && !context.membership) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return { user: null, error: "This account does not belong to this institute portal." };
    }
  } catch (tenantError) {
    console.warn("Unable to resolve institute membership during sign-in:", tenantError);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    return { user: null, error: "We could not verify this institute portal. Please try again." };
  }
  const profileCheck = await validateProfile(user, role);
  if (!profileCheck.ok) { await supabase.auth.signOut({ scope: "local" }).catch(() => {}); return { user: null, error: profileCheck.error }; }
  saveOfflineIdentity(cleanLogin, role, user.id);
  return { user, error: null };
}

export async function signUp() { return { user: null, needsConfirm: false, error: "Self-registration is disabled. Please contact your institute administrator for login credentials." }; }

export async function getCurrentUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) return null;
  let authUser = sessionData.session.user;
  if (!isOffline()) {
    // getSession() can return a cached JWT whose user_metadata predates an
    // administrator profile-name correction. Refresh the user record from
    // Supabase Auth so the portal always uses the current display name.
    const { data: freshUserData } = await supabase.auth.getUser();
    if (freshUserData?.user) authUser = freshUserData.user;
  }
  const user = toUser(authUser);
  if (!user.role) return null;
  if (isOffline()) return user;
  try {
    const context = await getCurrentInstituteContext();
    if (context.tenant && !context.membership) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return null;
    }
  } catch (tenantError) {
    console.warn("Unable to resolve institute membership:", tenantError);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    return null;
  }
  const profileCheck = await validateProfile(user, user.role);
  if (!profileCheck.ok) { await supabase.auth.signOut({ scope: "local" }).catch(() => {}); return null; }
  return user;
}

export function onAuthStateChange(callback) { return supabase.auth.onAuthStateChange((event, session) => callback(event, session?.user ? toUser(session.user) : null)); }
export async function signOut() { const { error } = await supabase.auth.signOut(); if (error) throw error; try { localStorage.removeItem(OFFLINE_LOGIN_KEY); } catch {} }

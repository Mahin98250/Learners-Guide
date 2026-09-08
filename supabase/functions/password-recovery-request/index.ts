import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
const normalizeId = (value: unknown) => normalize(value).replace(/[^a-z0-9]/g, "");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genericMessage = "If the account details match an active account with a verified recovery email, a password reset link has been sent. Check the recovery email inbox and spam folder.";
const deliveryError = "We could not send the recovery email right now. Please try again in a few minutes or contact the institute administrator.";
const PRODUCTION_SITE_URL = "https://learners-guide.vercel.app/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!url || !serviceKey || !anonKey) return json({ error: "Recovery service is not configured." }, 500);

    const body = await req.json();
    const role = normalize(body?.role);
    const identifier = normalize(body?.identifier || body?.email);
    if (!["student", "parent", "teacher", "admin"].includes(role)) return json({ error: "Choose a valid account type." }, 400);
    if (!identifier) return json({ error: role === "student" ? "Enter your Student ID." : role === "admin" ? "Enter your administrator email." : "Enter your phone number." }, 400);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Administrator recovery is an account-security operation. Require a
    // currently authenticated administrator so the public recovery endpoint
    // cannot be used to target arbitrary administrator accounts.
    if (role === "admin") {
      const authorization = req.headers.get("Authorization") || "";
      const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
      if (!accessToken) return json({ error: "Administrator authentication is required." }, 401);
      const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
      if (callerError || callerData.user?.app_metadata?.role !== "admin") return json({ error: "Administrator authentication is required." }, 403);
    }

    let authId = "";

    if (role === "admin") {
      if (!emailPattern.test(identifier)) return json({ error: "Enter a valid administrator email address." }, 400);
      for (let page = 1; page <= 100; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const account = data.users.find((row) => row.app_metadata?.role === "admin" && normalize(row.email) === identifier);
        if (account) { authId = account.id; break; }
        if (data.users.length < 1000) break;
      }
    } else if (role === "student") {
      const sid = normalizeId(identifier);
      const { data: students, error: studentError } = await admin.from("students").select("id,sid,status").limit(1000);
      if (studentError) throw studentError;
      const student = (students || []).find((row) => normalizeId(row.sid) === sid || normalizeId(row.id) === sid);
      if (student && normalize(student.status) === "active") {
        const studentRefs = new Set([normalize(String(student.id)), normalize(String(student.sid))]);
        const { data: users, error: userError } = await admin.from("users").select("auth_id,role,ref,status").eq("role", "student").limit(1000);
        if (userError) throw userError;
        const account = (users || []).find((row) => row.auth_id && normalize(row.status) === "active" && studentRefs.has(normalize(row.ref)));
        authId = String(account?.auth_id || "");
      }
    } else {
      const phone = identifier.replace(/\D/g, "");
      const { data: users, error } = await admin.from("users").select("auth_id,role,phone,status").eq("role", role).limit(1000);
      if (error) throw error;
      const account = (users || []).find((row) => row.auth_id && normalize(row.status) === "active" && String(row.phone || "").replace(/\D/g, "") === phone);
      authId = String(account?.auth_id || "");
    }

    if (!authId) return json({ message: genericMessage });

    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(authId);
    if (authUserError) throw authUserError;
    const authUser = authUserData.user;
    const email = normalize(authUser?.email);
    const confirmed = Boolean(authUser?.email_confirmed_at);
    if (!emailPattern.test(email) || !confirmed) return json({ message: genericMessage });

    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    // Use the configured production Site URL rather than a path that may not be
    // present in Supabase's redirect allow-list. The app root detects the
    // recovery session and routes it to /reset-password safely.
    const { error: resetError } = await publicClient.auth.resetPasswordForEmail(email, { redirectTo: PRODUCTION_SITE_URL });
    if (resetError) {
      console.error("password-recovery-request reset error", resetError.message || resetError);
      return json({ error: deliveryError }, 502);
    }

    return json({ message: genericMessage });
  } catch (error) {
    console.error("password-recovery-request", error);
    return json({ error: "Recovery service is temporarily unavailable. Please try again." }, 503);
  }
});

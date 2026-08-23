import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
const normalizeId = (value: unknown) => normalize(value).replace(/[^a-z0-9]/g, "");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genericMessage = "If the account details match an active account with a verified recovery email, a password reset link has been sent. Check the recovery email inbox and spam folder.";

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
    const identifier = normalize(body?.identifier);
    if (!["student", "parent", "teacher"].includes(role)) return json({ error: "Choose a valid account type." }, 400);
    if (!identifier) return json({ error: role === "student" ? "Enter your Student ID." : "Enter your phone number." }, 400);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    let email = "";
    if (role === "student") {
      const sid = normalizeId(identifier);
      const { data: studentBySid, error: sidError } = await admin.from("students").select("id,sid,status").eq("sid", identifier).maybeSingle();
      if (sidError) throw sidError;
      let student = studentBySid;
      if (!student) {
        const { data: studentById, error: idError } = await admin.from("students").select("id,sid,status").eq("id", identifier).maybeSingle();
        if (idError) throw idError;
        student = studentById;
      }
      if (!student) {
        const { data: students, error } = await admin.from("students").select("id,sid,status").limit(1000);
        if (error) throw error;
        student = (students || []).find((row) => normalizeId(row.sid) === sid || normalizeId(row.id) === sid);
      }
      if (student && normalize(student.status) === "active") {
        const { data: users, error: userError } = await admin.from("users").select("email,auth_id,role,ref,status").eq("role", "student").limit(1000);
        if (userError) throw userError;
        const account = (users || []).find((row) => row.auth_id && normalize(row.status) === "active" && normalize(row.ref) === normalize(String(student.id)) && emailPattern.test(normalize(row.email)) && !normalize(row.email).endsWith("@learnersguide.in"));
        email = normalize(account?.email);
      }
    } else {
      const phone = identifier.replace(/\D/g, "");
      const { data: users, error } = await admin.from("users").select("email,auth_id,role,phone,status").eq("role", role).limit(1000);
      if (error) throw error;
      const account = (users || []).find((row) => row.auth_id && normalize(row.status) === "active" && String(row.phone || "").replace(/\D/g, "") === phone && emailPattern.test(normalize(row.email)) && !normalize(row.email).endsWith("@learnersguide.in"));
      email = normalize(account?.email);
    }

    if (!email) return json({ message: genericMessage });
    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const base = Deno.env.get("PUBLIC_APP_URL") || "https://mahin98250.github.io/LG-Main-App/";
    const redirectTo = new URL("reset-password", base.endsWith("/") ? base : `${base}/`).toString();
    const { error: resetError } = await publicClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) console.error("password-recovery-request reset error", resetError.message);
    return json({ message: genericMessage });
  } catch (error) {
    console.error("password-recovery-request", error);
    return json({ message: genericMessage });
  }
});

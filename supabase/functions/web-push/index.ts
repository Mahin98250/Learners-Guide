import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKeys.default;
const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || publishableKeys.default;
const admin = createClient(SUPABASE_URL, serviceKey);

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-lg-push-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function ensureVapid() {
  const { data, error } = await admin.from("push_config").select("id,internal_secret,vapid_public,vapid_private").eq("id", 1).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Push configuration is unavailable.");
  if (data.vapid_public && data.vapid_private) return data;
  const keys = webpush.generateVAPIDKeys();
  const { data: updated, error: updateError } = await admin.from("push_config").update({ vapid_public: keys.publicKey, vapid_private: keys.privateKey, updated_at: new Date().toISOString() }).eq("id", 1).select("id,internal_secret,vapid_public,vapid_private").single();
  if (updateError || !updated) throw new Error(updateError?.message || "Could not initialize push keys.");
  return updated;
}

async function authenticatedUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || !publishableKey) return null;
  const client = createClient(SUPABASE_URL, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await client.auth.getUser(token);
  return data.user || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "public-key") {
      const cfg = await ensureVapid();
      return json({ publicKey: cfg.vapid_public });
    }
    if (action === "subscribe") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      const sub = body.subscription;
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json({ error: "Invalid push subscription" }, 400);
      const { error } = await admin.from("push_subscriptions").upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, expiration_time: sub.expirationTime ?? null, updated_at: new Date().toISOString() }, { onConflict: "user_id,endpoint" });
      if (error) return json({ error: error.message }, 500);
      await ensureVapid();
      return json({ ok: true });
    }
    if (action === "unsubscribe") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      if (!body.endpoint) return json({ error: "Endpoint required" }, 400);
      const { error } = await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "dispatch") {
      const supplied = req.headers.get("x-lg-push-secret") || "";
      const { data: cfg, error: cfgError } = await admin.from("push_config").select("internal_secret,vapid_public,vapid_private").eq("id", 1).single();
      if (cfgError || !cfg || !supplied || supplied !== cfg.internal_secret) return json({ error: "Unauthorized" }, 401);
      const notificationId = String(body.notification_id || "");
      if (!notificationId) return json({ error: "notification_id required" }, 400);
      const { data: n, error: nError } = await admin.from("notifications").select("id,title,desc,type,uid").eq("id", notificationId).maybeSingle();
      if (nError || !n) return json({ ok: true, sent: 0 });
      const activeCfg = cfg.vapid_public && cfg.vapid_private ? cfg : await ensureVapid();
      webpush.setVapidDetails("mailto:admin@learnersguide.app", activeCfg.vapid_public, activeCfg.vapid_private);
      const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth,expiration_time").eq("user_id", n.uid);
      let sent = 0;
      for (const sub of subs || []) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth }, expirationTime: sub.expiration_time }, JSON.stringify({ title: n.title || "Mahin", body: n.desc || "You have a new notification.", type: n.type || "message", notificationId: n.id, url: "app" }), { TTL: 86400 });
          sent++;
          await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", sub.id);
        } catch (error) {
          const message = String((error as any)?.message || error).slice(0, 500);
          await admin.from("push_subscriptions").update({ last_error: message, updated_at: new Date().toISOString() }).eq("id", sub.id);
          const status = Number((error as any)?.statusCode || 0);
          if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
      return json({ ok: true, sent });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("web-push error", error);
    return json({ error: String((error as any)?.message || error) }, 500);
  }
});

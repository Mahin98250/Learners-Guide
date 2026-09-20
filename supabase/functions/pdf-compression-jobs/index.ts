import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const allowedBuckets = new Set(["homework", "materials"]);
const allowedProfiles = new Set(["recommended", "extreme", "less"]);

async function getUser(admin: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function isTenantMember(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from("compression_tenant_memberships")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  return !error && !!data;
}

async function sourceIsBoundToTenant(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  bucket: string,
  path: string,
) {
  const { data, error } = await admin
    .from("compression_tenant_sources")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("source_bucket", bucket)
    .eq("source_path", path)
    .maybeSingle();

  return !error && !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Compression service is not configured" }, 500);

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Missing authorization" }, 401);

    const token = authorization.replace(/^Bearer\s+/i, "");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const user = await getUser(admin, token);
    if (!user) return json({ error: "Invalid authorization" }, 401);

    const body = await req.json();
    const tenantId = String(body?.tenantId || "").trim();
    const bucket = String(body?.bucket || "").trim();
    const path = String(body?.path || "").trim();
    const profile = String(body?.profile || "recommended").trim();

    if (!tenantId || !allowedBuckets.has(bucket) || !/^.+\.pdf$/i.test(path)) {
      return json({ error: "Invalid tenant, bucket, or PDF path" }, 400);
    }
    if (!allowedProfiles.has(profile)) {
      return json({ error: "Invalid compression profile" }, 400);
    }

    if (!(await isTenantMember(admin, tenantId, user.id))) {
      return json({ error: "You are not a member of this compression tenant" }, 403);
    }

    if (!(await sourceIsBoundToTenant(admin, tenantId, bucket, path))) {
      return json({ error: "The requested source file is not accessible to this account" }, 403);
    }

    const { data: job, error } = await admin
      .from("pdf_compression_jobs")
      .insert({
        tenant_id: tenantId,
        requested_by: user.id,
        source_bucket: bucket,
        source_path: path,
        profile,
        status: "queued",
      })
      .select("id,tenant_id,status,profile,created_at")
      .single();

    if (error || !job) {
      console.error("pdf-compression-jobs enqueue:", error);
      return json({ error: "Unable to create compression job" }, 500);
    }

    return json(job, 202);
  } catch (error) {
    console.error("pdf-compression-jobs:", error);
    return json({ error: "Compression job could not be created safely" }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import postgres from "npm:postgres@3";

const PROJECT_REF = "efnxjfzyqbdulpjhffsm";
const REGION = "ap-northeast-1";
const EXPECTED_REPOSITORY = "Mahin98250/Learners-Guide";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_REF = `${EXPECTED_REPOSITORY}/.github/workflows/supabase-complete-backup-final.yml@${EXPECTED_REF}`;
const OIDC_AUDIENCE = "learners-guide-supabase-backup";
const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";

const githubJWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

const supabaseUrl =
  Deno.env.get("SUPABASE_URL") || `https://${PROJECT_REF}.supabase.co`;

function getSupabaseAdminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const encoded = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (encoded) {
    try {
      const keys = JSON.parse(encoded);
      const defaultKey = keys?.default;
      if (typeof defaultKey === "string" && defaultKey.length > 0) return defaultKey;
    } catch {
      // Fall through to the explicit error below.
    }
  }

  throw new Error("Supabase privileged key is unavailable to backup broker");
}

const serviceKey = getSupabaseAdminKey();
const sourceDbUrl = Deno.env.get("SUPABASE_DB_URL");

if (!sourceDbUrl) throw new Error("Supabase DB URL is unavailable to backup broker");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function responseJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function bearerToken(req: Request) {
  const value = req.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function authorizeGitHub(req: Request) {
  const token = bearerToken(req);
  if (!token) throw new Error("missing GitHub OIDC bearer token");

  const { payload } = await jwtVerify(token, githubJWKS, {
    issuer: GITHUB_ISSUER,
    audience: OIDC_AUDIENCE,
    algorithms: ["RS256"],
  });

  if (String(payload.repository || "") !== EXPECTED_REPOSITORY) throw new Error("unauthorized repository");
  if (String(payload.repository_owner || "") !== "Mahin98250") throw new Error("unauthorized repository owner");
  if (String(payload.ref || "") !== EXPECTED_REF) throw new Error("unauthorized ref");

  const workflowRef = String(payload.workflow_ref || "");
  const jobWorkflowRef = String(payload.job_workflow_ref || "");
  if (workflowRef !== EXPECTED_WORKFLOW_REF && jobWorkflowRef !== EXPECTED_WORKFLOW_REF) {
    throw new Error("unauthorized workflow");
  }
}

function parseConnectionString(input: string) {
  const parsed = new URL(input);
  return {
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
  };
}

async function verifyDatabaseUrl(url: string) {
  const client = postgres(url, {
    max: 1,
    idle_timeout: 3,
    connect_timeout: 10,
    ssl: "require",
    prepare: false,
  });
  try {
    const rows = await client`
      select current_database() as database,
             current_user as user,
             current_setting('server_version') as version
    `;
    return rows[0];
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

async function getVerifiedSessionPoolerUrl() {
  const source = parseConnectionString(sourceDbUrl!);
  const username = `postgres.${PROJECT_REF}`;
  const database = source.database || "postgres";
  const hosts = [
    `aws-${REGION}.pooler.supabase.com`,
    `aws-0-${REGION}.pooler.supabase.com`,
    `aws-1-${REGION}.pooler.supabase.com`,
  ];

  if (source.port === 5432 && source.hostname.endsWith("pooler.supabase.com")) {
    return { url: sourceDbUrl, verification: await verifyDatabaseUrl(sourceDbUrl!) };
  }

  const failures: string[] = [];
  for (const host of hosts) {
    const candidate =
      `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(source.password)}@${host}:5432/${encodeURIComponent(database)}`;
    try {
      return {
        url: candidate,
        verification: await verifyDatabaseUrl(candidate),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${host}: ${message}`);
    }
  }

  throw new Error(`no working Supabase Session Pooler endpoint; ${failures.join(" | ")}`);
}

async function collectStorage() {
  const bucketsResult = await admin.storage.listBuckets();
  if (bucketsResult.error) throw bucketsResult.error;
  const buckets = bucketsResult.data || [];
  const objects: Array<Record<string, unknown>> = [];

  for (const bucket of buckets) {
    let offset = 0;
    const limit = 1000;
    while (true) {
      const result = await admin
        .from("storage.objects")
        .select("bucket_id,name,id,metadata,created_at,updated_at,owner")
        .eq("bucket_id", bucket.id)
        .order("name", { ascending: true })
        .range(offset, offset + limit - 1);
      if (result.error) throw result.error;
      const page = result.data || [];

      for (const object of page) {
        const signed = await admin.storage.from(bucket.id).createSignedUrl(object.name, 1200);
        if (signed.error || !signed.data?.signedUrl) {
          throw signed.error || new Error(`failed to create signed URL for ${bucket.id}/${object.name}`);
        }
        objects.push({
          bucket: bucket.id,
          name: object.name,
          id: object.id,
          metadata: object.metadata,
          created_at: object.created_at,
          updated_at: object.updated_at,
          owner: object.owner,
          signed_url: signed.data.signedUrl,
        });
      }

      if (page.length < limit) break;
      offset += limit;
    }
  }

  return { buckets, objects };
}

async function collectAuthUsers() {
  const users: unknown[] = [];
  let page = 1;
  while (true) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const batch = result.data.users || [];
    users.push(...batch.map((user) => ({
      id: user.id,
      aud: user.aud,
      role: user.role,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      updated_at: user.updated_at,
      email_confirmed_at: user.email_confirmed_at,
      phone_confirmed_at: user.phone_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      identities: user.identities,
      is_anonymous: user.is_anonymous,
    })));
    if (batch.length < 1000) break;
    page += 1;
  }
  return users;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responseJson({ error: "POST required" }, 405);
  try {
    await authorizeGitHub(req);
    const db = await getVerifiedSessionPoolerUrl();
    const storage = await collectStorage();
    const authUsers = await collectAuthUsers();
    return responseJson({
      ok: true,
      project_ref: PROJECT_REF,
      db,
      storage,
      auth_users: authUsers,
      issued_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("backup broker failure", error);
    return responseJson({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type DeliveryJob = {
  id: string;
  institute_id: string;
  notification_id: string;
  recipient_auth_id: string;
  channel: "web_push" | "email" | "whatsapp" | "sms";
  attempt_count: number;
};

type DispatchResult = {
  kind: "sent" | "blocked" | "retry";
  providerMessageId?: string | null;
  error?: string;
};

class ConfigurationError extends Error {}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  secretKeys.default ||
  "";
const DISPATCH_SECRET = Deno.env.get("NOTIFICATION_DISPATCHER_SECRET") || "";
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;

if (!SUPABASE_URL || !serviceKey) {
  throw new Error("Supabase server configuration is missing.");
}

const admin = createClient(SUPABASE_URL, serviceKey);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

function safeError(error: unknown) {
  return String((error as any)?.message || error || "Unknown delivery error").slice(0, 500);
}

function retryDelaySeconds(attemptCount: number) {
  return Math.min(60 * 2 ** Math.max(0, attemptCount - 1), 3600);
}

async function loadPushSecret() {
  const { data, error } = await admin
    .from("push_config")
    .select("internal_secret")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.internal_secret) {
    throw new ConfigurationError("Web push internal secret is not configured.");
  }

  return String(data.internal_secret);
}

async function dispatchWebPush(job: DeliveryJob): Promise<DispatchResult> {
  const pushSecret = await loadPushSecret();

  const response = await fetch(
    SUPABASE_URL + "/functions/v1/web-push",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lg-push-secret": pushSecret,
      },
      body: JSON.stringify({
        action: "dispatch",
        notification_id: job.notification_id,
      }),
    },
  );

  const raw = await response.text();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (response.ok) {
    return { kind: "sent", providerMessageId: null };
  }

  const message = safeError(
    payload?.error || raw || ("web-push returned " + response.status),
  );

  if (response.status === 401 || response.status === 403) {
    throw new ConfigurationError(message);
  }

  return { kind: "retry", error: message };
}

function unavailableExternalAdapter(channel: DeliveryJob["channel"]): DispatchResult {
  return {
    kind: "blocked",
    error: channel + " provider adapter is not configured yet.",
  };
}

const adapters: Record<
  DeliveryJob["channel"],
  (job: DeliveryJob) => Promise<DispatchResult>
> = {
  web_push: dispatchWebPush,
  email: async (job) => unavailableExternalAdapter(job.channel),
  whatsapp: async (job) => unavailableExternalAdapter(job.channel),
  sms: async (job) => unavailableExternalAdapter(job.channel),
};

async function completeJob(job: DeliveryJob, result: DispatchResult) {
  if (result.kind === "sent") {
    await admin
      .from("notification_delivery_jobs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        locked_at: null,
        provider_message_id: result.providerMessageId || null,
        last_error: null,
      })
      .eq("id", job.id)
      .eq("status", "processing");
    return;
  }

  if (result.kind === "blocked") {
    await admin
      .from("notification_delivery_jobs")
      .update({
        status: "blocked",
        locked_at: null,
        last_error: result.error || "Delivery blocked by provider configuration.",
      })
      .eq("id", job.id)
      .eq("status", "processing");
    return;
  }

  if (job.attempt_count >= MAX_ATTEMPTS) {
    await admin
      .from("notification_delivery_jobs")
      .update({
        status: "failed",
        available_at: "infinity",
        locked_at: null,
        last_error: result.error || "Maximum delivery attempts reached.",
      })
      .eq("id", job.id)
      .eq("status", "processing");
    return;
  }

  const availableAt = new Date(
    Date.now() + retryDelaySeconds(job.attempt_count) * 1000,
  ).toISOString();

  await admin
    .from("notification_delivery_jobs")
    .update({
      status: "failed",
      available_at: availableAt,
      locked_at: null,
      last_error: result.error || "Delivery failed; retry scheduled.",
    })
    .eq("id", job.id)
    .eq("status", "processing");
}

async function dispatchBatch(limit = BATCH_SIZE) {
  const { data, error } = await admin.rpc("notification_claim_delivery_jobs", {
    p_limit: Math.min(Math.max(Number(limit) || BATCH_SIZE, 1), 100),
  });

  if (error) {
    throw new Error("Unable to claim notification jobs: " + error.message);
  }

  const jobs = (data || []) as DeliveryJob[];
  const summary = {
    claimed: jobs.length,
    sent: 0,
    blocked: 0,
    retried: 0,
    failed: 0,
  };

  for (const job of jobs) {
    let result: DispatchResult;

    try {
      result = await adapters[job.channel](job);
    } catch (error) {
      if (error instanceof ConfigurationError) {
        result = { kind: "blocked", error: safeError(error) };
      } else {
        result = { kind: "retry", error: safeError(error) };
      }
    }

    await completeJob(job, result);

    if (result.kind === "sent") summary.sent++;
    else if (result.kind === "blocked") summary.blocked++;
    else {
      summary.retried++;
      if (job.attempt_count >= MAX_ATTEMPTS) summary.failed++;
    }
  }

  return summary;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supplied = req.headers.get("x-lg-dispatch-secret") || "";
  if (!DISPATCH_SECRET || !supplied || supplied !== DISPATCH_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedLimit = Number(body.limit || BATCH_SIZE);
    const summary = await dispatchBatch(requestedLimit);
    return json({ ok: true, ...summary });
  } catch (error) {
    console.error("notification-dispatcher error", error);
    return json({ error: safeError(error) }, 500);
  }
});

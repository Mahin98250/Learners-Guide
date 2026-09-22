import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260922190000_phase7_notification_dispatcher.sql",
  "utf8",
);
const dispatcher = fs.readFileSync(
  "supabase/functions/notification-dispatcher/index.ts",
  "utf8",
);
const config = fs.readFileSync("supabase/config.toml", "utf8");

assert.match(migration, /create or replace function public\.notification_claim_delivery_jobs/);
assert.match(migration, /for update skip locked/);
assert.match(migration, /status = 'processing'/);
assert.match(migration, /attempt_count = j\.attempt_count \+ 1/);
assert.match(migration, /status = 'failed'/);
assert.match(migration, /locked_at < now\(\) - interval '10 minutes'/);
assert.match(migration, /revoke all on function public\.notification_claim_delivery_jobs\(integer\) from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.notification_claim_delivery_jobs\(integer\) to service_role/);

assert.match(dispatcher, /NOTIFICATION_DISPATCHER_SECRET/);
assert.match(dispatcher, /notification_claim_delivery_jobs/);
assert.match(dispatcher, /web_push: dispatchWebPush/);
assert.match(dispatcher, /email: async/);
assert.match(dispatcher, /whatsapp: async/);
assert.match(dispatcher, /sms: async/);
assert.match(dispatcher, /status: "sent"/);
assert.match(dispatcher, /status: "blocked"/);
assert.match(dispatcher, /status: "failed"/);
assert.match(dispatcher, /MAX_ATTEMPTS = 5/);
assert.match(dispatcher, /available_at: "infinity"/);
assert.match(dispatcher, /x-lg-push-secret/);
assert.doesNotMatch(dispatcher, /sb_(publishable|secret)_[A-Za-z0-9_]+/);

assert.match(config, /\[functions\.notification-dispatcher\]\s+verify_jwt = false/);
assert.match(config, /\[functions\.web-push\]\s+verify_jwt = false/);

console.log("Phase 7 notification dispatcher contract passed.");

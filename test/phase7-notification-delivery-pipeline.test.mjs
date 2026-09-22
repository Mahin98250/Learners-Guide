import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260922183000_phase7_notification_delivery_jobs.sql", "utf8");
const integrationMigration = fs.readFileSync("supabase/migrations/20260922170000_phase7_notifications_integrations.sql", "utf8");

assert.match(migration, /create table if not exists public\.notification_delivery_jobs/);
assert.match(migration, /channel text not null check \(channel in \('web_push','email','whatsapp','sms'\)\)/);
assert.match(migration, /unique \(notification_id, recipient_auth_id, channel\)/);
assert.match(migration, /status in \('pending','processing','sent','failed','blocked','cancelled'\)/);
assert.match(migration, /public\.user_has_institute_permission\(institute_id,'integrations\.read'\)/);
assert.match(migration, /create or replace function public\.notification_enqueue_delivery_jobs/);
assert.match(migration, /role_key = case/);
assert.match(migration, /event_type = case/);
assert.match(migration, /provider_code = case when v_channel = 'push' then 'web_push' else v_channel end/);
assert.match(migration, /case when v_integration\.secret_configured then 'pending' else 'blocked' end/);
assert.match(migration, /create trigger notifications_enqueue_delivery/);
assert.match(migration, /p\.auth_id::text = v_notification\.uid/);
assert.match(integrationMigration, /provider_code text not null check/);
assert.match(integrationMigration, /secret_configured boolean not null default false/);

console.log("Phase 7 delivery pipeline contract passed.");

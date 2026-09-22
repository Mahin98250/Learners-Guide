import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260922170000_phase7_notifications_integrations.sql", "utf8");
const center = fs.readFileSync("src/admin/NotificationIntegrationsCenter.tsx", "utf8");
const portal = fs.readFileSync("src/admin/ModernAdminPortal.tsx", "utf8");

assert.match(migration, /create table if not exists public\.institute_notification_integrations/);
assert.match(migration, /create table if not exists public\.institute_notification_preferences/);
assert.match(migration, /public\.user_has_institute_permission\(institute_id,'integrations\.read'\)/);
assert.match(migration, /public\.user_has_institute_permission\(institute_id,'integrations\.manage'\)/);
assert.match(migration, /public\.user_has_institute_permission\(institute_id,'notifications\.manage'\)/);
assert.match(migration, /secret_configured boolean not null default false/);
assert.match(migration, /revoke all on function public\.seed_institute_defaults\(uuid\) from public, anon, authenticated/);
assert.match(center, /institute_notification_integrations/);
assert.match(center, /institute_notification_preferences/);
assert.match(center, /provider credentials are kept out of client configuration/);
assert.match(portal, /Notifications & Integrations/);
assert.match(portal, /notifications-integrations/);

console.log("Phase 7 notification/integration contract passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const controlPlane = read("src/platform/PlatformOwnerControlPlane.tsx");
const client = read("src/platform/platform-tenant-data.ts");
const migration = read("supabase/migrations/20260924160000_owner_platform_activity_audit.sql");

test("Owner Activity & Audit is wired through the secure platform RPC", () => {
  assert.match(controlPlane, /activeSection === "activity"/);
  assert.match(controlPlane, /getPlatformAuditActivity/);
  assert.match(controlPlane, /Refresh activity/);
  assert.match(client, /platform_get_audit_activity/);
});

test("Platform audit RPC is owner-gated, bounded, filtered and read-only", () => {
  assert.match(migration, /platform_owner_access_ok()/);
  assert.match(migration, /platform_get_audit_activity\(/);
  assert.match(migration, /p_cursor_created_at/);
  assert.match(migration, /p_cursor_id/);
  assert.match(migration, /p_category/);
  assert.match(migration, /p_search/);
  assert.match(migration, /limit v_limit/);
  assert.match(migration, /revoke all on function public\.platform_get_audit_activity/);
  assert.match(migration, /scope = 'platform'/);
  assert.doesNotMatch(migration, /update public\.audit_logs/);
  assert.doesNotMatch(migration, /delete from public\.audit_logs/);
});

test("Owner audit UI does not expose raw metadata or actor identities", () => {
  assert.match(controlPlane, /Raw metadata and actor identities are not returned to this interface/);
  assert.doesNotMatch(controlPlane, /actor_auth_id/);
  assert.doesNotMatch(controlPlane, /actor_person_id/);
  assert.doesNotMatch(controlPlane, /event\.metadata/);
  assert.doesNotMatch(controlPlane, /event\.actor_auth_id/);
  assert.doesNotMatch(controlPlane, /event\.actor_person_id/);
});

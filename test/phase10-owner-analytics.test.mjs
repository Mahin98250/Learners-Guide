import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const controlPlane = read("src/platform/PlatformOwnerControlPlane.tsx");
const client = read("src/platform/platform-tenant-data.ts");
const migration = read("supabase/migrations/20260924150000_owner_platform_analytics_overview.sql");

test("Owner Analytics is wired through the aggregate platform RPC", () => {
  assert.match(controlPlane, /getPlatformAnalytics/);
  assert.match(controlPlane, /activeSection === "analytics"/);
  assert.match(controlPlane, /Refresh analytics/);
  assert.match(client, /platform_get_analytics/);
});

test("Platform analytics RPC is owner-gated and read-only", () => {
  assert.match(migration, /platform_owner_access_ok\(\)/);
  assert.match(migration, /platform_get_analytics\(p_days integer default 30\)/);
  assert.match(migration, /revoke all on function public\.platform_get_analytics\(integer\)/);
  assert.match(migration, /generate_series/);
  assert.match(migration, /study_materials/);
  assert.match(migration, /attendance/);
  assert.doesNotMatch(migration, /update public\./);
  assert.doesNotMatch(migration, /delete from public\./);
});

test("Analytics remains aggregate-only", () => {
  assert.doesNotMatch(controlPlane, /\.from\(["']students["']\)/);
  assert.doesNotMatch(controlPlane, /\.from\(["']teachers["']\)/);
  assert.doesNotMatch(controlPlane, /\.from\(["']audit_logs["']\)/);
  assert.match(controlPlane, /no individual users, messages, or files are exposed/);
});

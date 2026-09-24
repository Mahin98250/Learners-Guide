import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const controlPlane = read("src/platform/PlatformOwnerControlPlane.tsx");
const client = read("src/platform/platform-tenant-data.ts");
const migration = read("supabase/migrations/20260924180000_owner_security_overview.sql");

test("Owner Security loads live session assurance and MFA state", () => {
  assert.match(controlPlane, /activeSection === "security"/);
  assert.match(controlPlane, /getPlatformSecurityOverview/);
  assert.match(controlPlane, /getAuthenticatorAssuranceLevel/);
  assert.match(controlPlane, /listFactors/);
  assert.match(controlPlane, /Refresh security/);
});

test("Security overview is backend owner-gated", () => {
  assert.match(migration, /platform_owner_access_ok()/);
  assert.match(migration, /platform_get_security_overview()/);
  assert.match(migration, /revoke all on function public\.platform_get_security_overview/);
  assert.match(client, /platform_get_security_overview/);
});

test("Security UI does not expose sensitive auth records", () => {
  assert.doesNotMatch(controlPlane, /access_token|refresh_token|client_secret|secret_key|private_key/i);
  assert.match(controlPlane, /Secrets and recovery codes are never returned/);
});

// Regression guard: security copy is allowed to mention password login; tests target secret field names.

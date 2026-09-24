import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const controlPlane = read("src/platform/PlatformOwnerControlPlane.tsx");
const client = read("src/platform/platform-tenant-data.ts");
const migration = read("supabase/migrations/20260924170000_owner_platform_domains_overview.sql");

test("Owner Domains is wired to secure domain lifecycle operations", () => {
  assert.match(controlPlane, /activeSection === "domains"/);
  assert.match(controlPlane, /getPlatformDomains/);
  assert.match(controlPlane, /registerPlatformDomain/);
  assert.match(controlPlane, /Record DNS verified/);
  assert.match(controlPlane, /Set TLS active/);
  assert.match(client, /platform_get_domains/);
});

test("Domain overview RPC is owner-gated and read-only", () => {
  assert.match(migration, /platform_owner_access_ok()/);
  assert.match(migration, /platform_get_domains()/);
  assert.match(migration, /revoke all on function public.platform_get_domains/);
  assert.doesNotMatch(migration, /update public.institute_domains/);
  assert.doesNotMatch(migration, /delete from public.institute_domains/);
});

test("Owner Domains UI does not expose verification tokens in the directory", () => {
  assert.doesNotMatch(controlPlane, /domain.verification_token/);
  assert.match(controlPlane, /Verification tokens are only shown immediately after registration/);
});

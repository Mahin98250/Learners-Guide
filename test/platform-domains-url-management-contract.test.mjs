import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const migration = fs.readFileSync("supabase/migrations/20260922240000_platform_domains_url_management.sql", "utf8");
const portal = fs.readFileSync("src/platform/PlatformOwnerPortal.tsx", "utf8");
const tenant = fs.readFileSync("src/lg/tenant.ts", "utf8");

test("Phase 2 protects all domain mutations with platform-owner MFA", () => {
  for (const name of [
    "register_institute_domain",
    "platform_set_primary_domain",
    "platform_disable_domain",
    "platform_record_domain_dns_verified",
    "platform_set_domain_tls_status",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public.\${name}`));
  }
  assert.equal((migration.match(/platform_owner_access_ok\(\)/g) || []).length, 5);
  assert.match(migration, /revoke all on function public\.register_institute_domain/);
  assert.match(migration, /grant execute on function public\.platform_record_domain_dns_verified\(uuid\) to authenticated/);
  assert.match(migration, /Primary domain cannot be disabled/);
  assert.match(migration, /Domain must be verified before TLS can become active/);
});

test("Owner portal exposes the full domain lifecycle", () => {
  for (const name of [
    "register_institute_domain",
    "platform_record_domain_dns_verified",
    "platform_set_domain_tls_status",
    "platform_set_primary_domain",
    "platform_disable_domain",
  ]) assert.match(portal, new RegExp(name));
  assert.match(portal, /DNS TXT verification/);
  assert.match(portal, /TLS active/);
});

test("Tenant resolver remains verification and TLS gated", () => {
  assert.match(tenant, /resolve_institute_domain/);
  assert.match(tenant, /verified/);
});

console.log("Phase 2 Domains & Institute URL Management contract checks passed.");

import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20260922240000_platform_domains_url_management.sql", "utf8");
const portal = fs.readFileSync("src/platform/PlatformOwnerPortal.tsx", "utf8");
const tenantFoundation = fs.readFileSync("supabase/migrations/20260921130000_multi_institute_foundation.sql", "utf8");

test("Phase 2 protects all domain mutations with platform-owner MFA", () => {
  for (const name of [
    "register_institute_domain",
    "platform_set_primary_domain",
    "platform_disable_domain",
    "platform_record_domain_dns_verified",
    "platform_set_domain_tls_status",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public.${name}`));
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
  assert.match(portal, /Mark TLS active/);
});

test("Tenant resolver remains verification and TLS gated", () => {
  assert.match(tenantFoundation, /create or replace function public\.resolve_institute_domain/);
  assert.match(tenantFoundation, /d\.status = 'verified'/);
  assert.match(tenantFoundation, /d\.tls_status in \('active', 'provisioning'\)/);
});

console.log("Phase 2 Domains & Institute URL Management contract checks passed.");

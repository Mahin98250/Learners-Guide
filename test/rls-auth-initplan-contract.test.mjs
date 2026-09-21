import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260921234500_optimize_rls_auth_initplan_policies.sql",
  "utf8",
);

test("RLS policies use statement-scoped auth.uid() evaluation", () => {
  assert.match(migration, /select auth\.uid\(\)/);
  assert.doesNotMatch(migration, /(?<!select )auth\.uid\(\)/);
});

test("all ten advisor-targeted policies are covered", () => {
  for (const name of [
    "compression_tenant_memberships_member_read",
    "compression_tenant_sources_member_read",
    "compression_tenant_sources_owner_delete",
    "compression_tenant_sources_owner_insert",
    "compression_tenant_sources_owner_update",
    "compression_tenants_member_read",
    "institute_memberships_self_or_platform_read",
    "pdf_compression_jobs_member_insert",
    "pdf_compression_jobs_member_read",
    "people_self_read",
  ]) {
    assert.match(migration, new RegExp(name));
  }
});

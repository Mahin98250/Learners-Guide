import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260921233000_index_uncovered_foreign_keys.sql",
  "utf8",
);

test("all currently uncovered foreign keys receive covering indexes", () => {
  assert.match(migration, /idx_audit_logs_actor_person_id/);
  assert.match(migration, /idx_compression_tenant_memberships_user_id/);
  assert.match(migration, /idx_compression_tenants_created_by/);
});

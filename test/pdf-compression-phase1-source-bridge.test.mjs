import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260920140000_pdf_compression_phase1_source_bridge.sql",
  "utf8",
);

test("Source bridge requires an active admin owner", () => {
  assert.match(migration, /public\.app_role\(\) = 'admin'/);
  assert.match(migration, /m\.membership_role = 'owner'/);
  assert.match(migration, /t\.status = 'active'/);
});

test("Source bridge only binds real homework or materials storage paths", () => {
  assert.match(migration, /source_bucket = 'homework'/);
  assert.match(migration, /from public\.homework h/);
  assert.match(migration, /h\.storage_path = compression_tenant_sources\.source_path/);
  assert.match(migration, /source_bucket = 'materials'/);
  assert.match(migration, /from public\.materials m/);
  assert.match(migration, /m\.storage_path = compression_tenant_sources\.source_path/);
});

test("Optional source_record_id must agree with the bound record", () => {
  assert.match(migration, /source_record_id text/);
  assert.match(migration, /h\.id = compression_tenant_sources\.source_record_id/);
  assert.match(migration, /m\.id = compression_tenant_sources\.source_record_id/);
});

test("Operators cannot create or mutate source bindings", () => {
  assert.match(migration, /revoke insert, update, delete on public\.compression_tenant_sources from authenticated/);
  assert.match(migration, /compression_tenant_sources_owner_insert/);
  assert.match(migration, /compression_tenant_sources_owner_update/);
  assert.match(migration, /compression_tenant_sources_owner_delete/);
});

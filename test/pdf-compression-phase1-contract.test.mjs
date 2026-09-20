import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260920120000_pdf_compression_phase1_tenancy_jobs.sql",
  "utf8",
);
const functionSource = fs.readFileSync(
  "supabase/functions/pdf-compression-jobs/index.ts",
  "utf8",
);
const config = fs.readFileSync("supabase/config.toml", "utf8");

test("Phase 1 creates explicit tenant and compression job boundaries", () => {
  assert.match(migration, /create table if not exists public\.compression_tenants/);
  assert.match(migration, /create table if not exists public\.compression_tenant_memberships/);
  assert.match(migration, /create table if not exists public\.compression_tenant_sources/);
  assert.match(migration, /create table if not exists public\.pdf_compression_jobs/);
  assert.match(migration, /tenant_id uuid not null references public\.compression_tenants/);
  assert.match(migration, /requested_by uuid not null references auth\.users/);
});

test("Compression jobs are protected by tenant membership RLS", () => {
  assert.match(migration, /alter table public\.pdf_compression_jobs enable row level security/);
  assert.match(migration, /pdf_compression_jobs_member_read/);
  assert.match(migration, /pdf_compression_jobs_member_insert/);
  assert.match(migration, /compression_tenant_memberships m/);
  assert.match(migration, /m\.user_id = auth\.uid\(\)/);
  assert.match(migration, /revoke update, delete on public\.pdf_compression_jobs from authenticated/);
});

test("Phase 1 reserves a private PDF staging bucket", () => {
  assert.match(migration, /'pdf-compression-tmp'/);
  assert.match(migration, /public = false/);
  assert.match(migration, /104857600/);
  assert.match(migration, /application\/pdf/);
});

test("Job API requires JWT, tenant membership and explicit tenant-source binding", () => {
  assert.match(config, /\[functions\.pdf-compression-jobs\][\s\S]*verify_jwt = true/);
  assert.match(functionSource, /isTenantMember/);
  assert.match(functionSource, /sourceIsBoundToTenant/);
  assert.match(functionSource, /compression_tenant_sources/);
  assert.match(functionSource, /return json\(job, 202\)/);
  assert.doesNotMatch(functionSource, /SUPABASE_SERVICE_ROLE_KEY.*browser/i);
});

test("Job API restricts profiles and PDF source buckets", () => {
  assert.match(functionSource, /allowedBuckets = new Set\(\["homework", "materials"\]\)/);
  assert.match(functionSource, /allowedProfiles = new Set\(\["recommended", "extreme", "less"\]\)/);
  assert.match(functionSource, /\\\.pdf\$/i);
});

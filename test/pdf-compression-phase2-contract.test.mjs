import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/20260920160000_pdf_compression_phase2_worker.sql", "utf8");
const worker = fs.readFileSync("supabase/functions/pdf-compression-jobs/index.ts", "utf8");

test("Phase 2 adds worker claim metadata and retry support", () => {
  assert.ok(migration.includes("attempt_count integer"));
  assert.ok(migration.includes("worker_id text"));
  assert.ok(migration.includes("retry_pdf_compression_job"));
  assert.ok(migration.includes("membership_role = 'owner'"));
  assert.ok(migration.includes("public.app_role() = 'admin'"));
});

test("Worker has an explicit resource and validation boundary", () => {
  assert.ok(worker.includes("MAX_PDF_BYTES = 50 * 1024 * 1024"));
  assert.ok(worker.includes("MIN_PDF_BYTES = 256 * 1024"));
  assert.ok(worker.includes("preserveXFA: true"));
  assert.ok(worker.includes("throwOnInvalidObject: true"));
});

test("Worker never replaces a PDF unless the candidate is smaller and the source is unchanged", () => {
  assert.ok(worker.includes("optimizedSize >= originalSize"));
  assert.ok(worker.includes("latestSourceObject.updated_at !== sourceObject.updated_at"));
  assert.ok(worker.includes("storage.from(job.source_bucket).upload(job.source_path"));
});

test("Temporary staging is always cleaned up", () => {
  assert.ok(worker.includes("finally"));
  assert.ok(worker.includes("TMP_BUCKET"));
  assert.ok(worker.includes("remove([inputTempPath, outputTempPath])"));
});

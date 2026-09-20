import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/20260920160000_pdf_compression_phase2_worker.sql", "utf8");
const worker = fs.readFileSync("supabase/functions/pdf-compression-jobs/index.ts", "utf8");

test("Phase 2 adds worker claim metadata and retry support", () => {
  assert.match(migration, /attempt_count integer/);
  assert.match(migration, /worker_id text/);
  assert.match(migration, /retry_pdf_compression_job/);
  assert.match(migration, /membership_role = 'owner'/);
  assert.match(migration, /public\.app_role\(\) = 'admin'/);
});

test("Worker has an explicit resource and validation boundary", () => {
  assert.match(worker, /MAX_PDF_BYTES = 50 \\* 1024 \\* 1024/);
  assert.match(worker, /MIN_PDF_BYTES = 256 \\* 1024/);
  assert.match(worker, /preserveXFA: true/);
  assert.match(worker, /throwOnInvalidObject: true/);
});

test("Worker never replaces a PDF unless the candidate is smaller and the source is unchanged", () => {
  assert.match(worker, /optimizedSize >= originalSize/);
  assert.match(worker, /latestSourceObject\\.updated_at !== sourceObject\\.updated_at/);
  assert.match(worker, /storage\\.from\\(job\\.source_bucket\\)\\.upload\\(job\\.source_path/);
});

test("Temporary staging is always cleaned up", () => {
  assert.match(worker, /finally/);
  assert.match(worker, /TMP_BUCKET/);
  assert.match(worker, /remove\\(\\[inputTempPath, outputTempPath\\]\\)/);
});
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const compression = fs.readFileSync("src/lg/fileCompression.ts", "utf8");
const jobs = fs.readFileSync("src/lg/pdfCompressionJobs.ts", "utf8");
const overlay = fs.readFileSync("src/PdfOptimizationOverlay.tsx", "utf8");
const main = fs.readFileSync("src/main.tsx", "utf8");
const worker = fs.readFileSync("supabase/functions/pdf-compression-jobs/index.ts", "utf8");
const config = fs.readFileSync("supabase/config.toml", "utf8");

test("Browser no longer ships the qpdf PDF compressor", () => {
  assert.equal(pkg.dependencies["qpdf-run"], undefined);
  assert.doesNotMatch(compression, /qpdf-run/);
  assert.match(compression, /server-queue/);
});

test("PDF upload enters the server-side queue instead of client compression", () => {
  assert.match(jobs, /functions\.invoke\("pdf-compression-jobs"/);
  assert.match(jobs, /lg:pdf-optimization/);
  assert.match(jobs, /trackPdfCompressionJob/);
  assert.match(worker, /withSupabase\(\{ auth: \["user", "secret"\] \}\s*,/);
  assert.match(worker, /EdgeRuntime\.waitUntil\(processJob/);
});

test("Server worker validates, stages, compares and safely replaces PDFs", () => {
  assert.match(worker, /MAX_PDF_BYTES = 50 \* 1024 \* 1024/);
  assert.match(worker, /PDFDocument\.load\(sourceBytes/);
  assert.match(worker, /preserveXFA: true/);
  assert.match(worker, /pageCount/);
  assert.match(worker, /optimizedSize >= originalSize/);
  assert.match(worker, /SOURCE_CHANGED/);
  assert.match(worker, /storage_path/);
  assert.match(worker, /from\(TMP_BUCKET\)/);
  assert.match(worker, /status: "optimized"/);
  assert.match(worker, /status: "original-kept"/);
  assert.match(worker, /status: "failed"/);
  assert.match(worker, /runRasterWorker/);
  assert.match(worker, /RASTER_ENGINE/);
});

test("The job endpoint is configured for explicit user/secret auth modes", () => {
  assert.match(config, /\[functions\.pdf-compression-jobs\]/);
  assert.match(config, /verify_jwt = false/);
});

test("The global overlay describes server-side completion", () => {
  assert.match(overlay, /server-side optimization/i);
  assert.match(overlay, /smaller server-generated file/i);
  assert.match(overlay, /Images recompressed/);
  assert.match(main, /PdfOptimizationOverlay/);
});

test("Upload entry points enqueue PDFs after Storage + record creation", () => {
  for (const path of [
    "src/admin/HomeworkPage.tsx",
    "src/lg/TeacherHomeworkPage.jsx",
    "src/lg/teacherWorkflows.jsx",
    "src/admin/MaterialsDriveV2.tsx",
    "src/admin/MaterialsDrive.tsx",
  ]) {
    const source = fs.readFileSync(path, "utf8");
    assert.match(source, /enqueuePdfCompressionJob/);
  }
});

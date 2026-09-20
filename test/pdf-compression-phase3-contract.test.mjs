import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const raster = fs.readFileSync("src/server/pdfRasterCompression.ts", "utf8");
const worker = fs.readFileSync("api/pdf-compression-worker.ts", "utf8");
const edge = fs.readFileSync("supabase/functions/pdf-compression-jobs/index.ts", "utf8");
const migration = fs.readFileSync(
  "supabase/migrations/20260920180000_pdf_compression_phase3_raster_telemetry.sql",
  "utf8",
);
const jobs = fs.readFileSync("src/lg/pdfCompressionJobs.ts", "utf8");
const overlay = fs.readFileSync("src/PdfOptimizationOverlay.tsx", "utf8");

test("Phase 3 uses the commercially safe Sharp image engine", () => {
  assert.equal(pkg.dependencies.sharp, "^0.35.4");
  assert.match(raster, /import sharp from "sharp"/);
  assert.match(raster, /DCTDecode/);
  assert.match(raster, /FlateDecode/);
  assert.match(raster, /\.jpeg\(/);
  assert.match(raster, /chromaSubsampling: "4:2:0"/);
});

test("Raster compression is conservative around PDF semantics", () => {
  assert.match(raster, /ImageMask/);
  assert.match(raster, /SMask/);
  assert.match(raster, /Mask/);
  assert.match(raster, /DecodeParms/);
  assert.match(raster, /BitsPerComponent/);
  assert.match(raster, /DeviceRGB/);
  assert.match(raster, /DeviceGray/);
  assert.match(raster, /nextDict\.delete\(PDFName\.of\("DecodeParms"\)\)/);
  assert.match(raster, /context\.assign/);
});

test("Raster worker never receives raw PDF bytes in its request and only accepts signed Supabase URLs", () => {
  assert.match(worker, /sourceUrl/);
  assert.match(worker, /uploadUrl/);
  assert.match(worker, /\/storage\/v1\/object\/sign\//);
  assert.match(worker, /\/storage\/v1\/object\/upload\/sign\//);
  assert.match(worker, /MAX_PDF_BYTES/);
  assert.match(worker, /validateCandidate/);
  assert.match(worker, /method: "PUT"/);
});

test("Phase 3 reuses the Phase 2 safe replacement contract", () => {
  assert.match(edge, /createSignedUrl\(inputTempPath, 300\)/);
  assert.match(edge, /createSignedUploadUrl\(outputTempPath, \{ upsert: true \}\)/);
  assert.match(edge, /runRasterWorker/);
  assert.match(edge, /rasterCandidateIsValid/);
  assert.match(edge, /latestSourceObject\.updated_at !== sourceObject\.updated_at/);
  assert.match(edge, /optimizedSize >= originalSize/);
  assert.match(edge, /STRUCTURAL_ENGINE/);
  assert.match(edge, /RASTER_ENGINE/);
});

test("Phase 3 records image-level compression telemetry and fixes attempt numbering", () => {
  assert.match(migration, /image_count integer/);
  assert.match(migration, /image_recompressed_count integer/);
  assert.match(migration, /raster_original_bytes bigint/);
  assert.match(migration, /raster_final_bytes bigint/);
  assert.match(migration, /set attempt_count = 1/);
  assert.match(migration, /alter column attempt_count set default 1/);
  assert.match(edge, /attempt_count: 1/);
  assert.doesNotMatch(edge, /worker_id: workerId,[\s\S]{0,100}attempt_count: 1/);
});

test("UI surfaces raster image recompression results", () => {
  assert.match(jobs, /image_count,image_recompressed_count/);
  assert.match(jobs, /PDF images were recompressed/);
  assert.match(overlay, /Images recompressed/);
});

test("Compression queue works for any authenticated uploader through an isolated bridge tenant", () => {
  assert.match(edge, /compression-user-\$\{userId\.replace/);
  assert.match(edge, /membership_role: "owner"/);
  assert.match(edge, /source ownership and the application record binding are still checked/i);
});

test("Queue failures are visible instead of being silently swallowed", () => {
  assert.match(jobs, /Compression job was not created/);
  assert.match(jobs, /PDF uploaded, but the server compression job could not be queued/);
});

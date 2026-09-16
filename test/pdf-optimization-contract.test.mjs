import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const optimizer = fs.readFileSync("src/lg/fileOptimizer.ts", "utf8");
const overlay = fs.readFileSync("src/PdfOptimizationOverlay.tsx", "utf8");
const main = fs.readFileSync("src/main.tsx", "utf8");
const supabaseClient = fs.readFileSync("src/lg/supabase.ts", "utf8");
const adminHomework = fs.readFileSync("src/admin/HomeworkPage.tsx", "utf8");
const teacherHomework = fs.readFileSync("src/lg/teacherHomeworkApp.jsx", "utf8");
const teacherMaterials = fs.readFileSync("src/lg/teacherWorkflows.jsx", "utf8");
const adminMaterials = fs.readFileSync("src/admin/MaterialsDriveV2.tsx", "utf8");

test("PDF optimizer uses qpdf WASM and safe fallback", () => {
  assert.match(pkg.dependencies["qpdf-run"], /^\^0\.2\.1$/);
  assert.match(optimizer, /optimizeWithQpdf/);
  assert.match(optimizer, /candidateSize >= input\.size/);
  assert.match(optimizer, /engine: "qpdf-wasm"/);
  assert.doesNotMatch(optimizer, /compressPDF/);
  assert.doesNotMatch(optimizer, /@fileslim\/compress/);
});

test("PDF validation uses a real PDF parser and preserves page geometry", () => {
  assert.match(optimizer, /validatePdf/);
  assert.match(optimizer, /import\("pdf-lib"\)/);
  assert.match(optimizer, /PDFDocument\.load/);
  assert.match(optimizer, /throwOnInvalidObject: true/);
  assert.match(optimizer, /pageCount/);
  assert.match(optimizer, /pageSizes/);
  assert.match(optimizer, /samePageCount/);
  assert.match(optimizer, /samePageSizes/);
  assert.doesNotMatch(optimizer, /qpdf\.run\(\{[\s\S]*?--check/);
  assert.doesNotMatch(optimizer, /qpdf\.run\(\{[\s\S]*?--show-npages/);
  assert.doesNotMatch(optimizer, /checkedName/);
  assert.doesNotMatch(optimizer, /outputName: checkedName/);
  assert.doesNotMatch(optimizer, /header !== "%PDF-"/);
  assert.doesNotMatch(optimizer, /sameMetadata/);
});

test("qpdf runner uses supported browser assets and is cleaned up", () => {
  assert.match(optimizer, /new URL\("qpdf-run\/worker"/);
  assert.match(optimizer, /new URL\("qpdf-run\/qpdf\.js"/);
  assert.match(optimizer, /new URL\("qpdf-run\/qpdf\.wasm"/);
  assert.match(optimizer, /await qpdf\.destroy\(\)/);
  assert.match(optimizer, /--optimize-images/);
  assert.match(optimizer, /--jpeg-quality=\$\{quality\}/);
  assert.match(optimizer, /JPEG_QUALITY_LEVELS = \[60, 40\]/);
  assert.match(optimizer, /--object-streams=generate/);
  assert.match(optimizer, /--recompress-flate/);
});

test("PDF optimization uses one structural+image pass at multiple quality levels", () => {
  assert.match(optimizer, /for \(const quality of JPEG_QUALITY_LEVELS\)/);
  assert.match(optimizer, /optimized-\$\{quality\}\.pdf/);
  assert.match(optimizer, /candidates/);
  assert.match(optimizer, /candidate\.bytes\.byteLength/);
  assert.doesNotMatch(optimizer, /structural\.pdf/);
  assert.doesNotMatch(optimizer, /images\.pdf/);
});

test("PDF optimization reports processing, success, safe fallback and failure states", () => {
  assert.match(optimizer, /lg:pdf-optimization/);
  assert.match(optimizer, /status: "processing"/);
  assert.match(optimizer, /status: "optimized"/);
  assert.match(optimizer, /status: "original-kept"/);
  assert.match(optimizer, /status: "failed"/);
  assert.match(optimizer, /savingsBytes/);
  assert.match(optimizer, /savingsPercent/);
});

test("global optimization overlay shows requested measurements and final status", () => {
  assert.match(overlay, /Original size/);
  assert.match(overlay, /Optimized size/);
  assert.match(overlay, /Data saved/);
  assert.match(overlay, /Compression/);
  assert.match(overlay, /passed PDF structural validation and page-geometry checks/i);
  assert.match(overlay, /Original kept/);
  assert.match(overlay, /validation\/optimization pipeline/i);
  assert.match(overlay, /validationReason/);
  assert.match(main, /PdfOptimizationOverlay/);
});

test("Storage client does not trigger a second hidden optimization pass", () => {
  assert.doesNotMatch(supabaseClient, /file-optimizer/);
  assert.doesNotMatch(supabaseClient, /originalStorageFrom/);
});

test("admin homework runs PDFs through the optimizer before Storage", () => {
  assert.match(adminHomework, /optimizePdfFile\(file, setProcessing\)/);
  assert.match(adminHomework, /file_size: uploadFile\?\.size/);
});

test("teacher homework runs PDFs through the optimizer before Storage and cleans up partial failures", () => {
  assert.match(teacherHomework, /optimizePdfFile\(uploadFile, setProcessing\)/);
  assert.match(teacherHomework, /file_size: uploadFile\.size/);
  assert.match(teacherHomework, /storage\.from\("homework"\)\.remove\(\[path\]\)/);
  assert.match(teacherHomework, /storageUploaded/);
});

test("teacher material uploads PDFs through the optimizer before Storage", () => {
  assert.match(teacherMaterials, /optimizePdfFile\(selectedFile, setProcessing\)/);
  assert.match(teacherMaterials, /file_size: uploadFile\.size/);
});

test("active admin materials uploader runs PDFs through the optimizer before Storage", () => {
  assert.match(adminMaterials, /optimizePdfFile\(file, setProcessing\)/);
  assert.match(adminMaterials, /file_size:uploadFile\.size/);
});

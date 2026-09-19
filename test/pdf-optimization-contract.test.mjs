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
  assert.match(optimizer, /status: "failed"/);
  assert.doesNotMatch(optimizer, /compressPDF/);
  assert.doesNotMatch(optimizer, /@fileslim\/compress/);
});

test("PDF inspection uses qpdf and preserves the original page count", () => {
  assert.match(optimizer, /async function inspectPdf/);
  assert.match(optimizer, /--json-key=pages/);
  assert.match(optimizer, /outputName: "inspection\.json"/);
  assert.match(optimizer, /outputs: \["inspection\.json"\]/);
  assert.match(optimizer, /JSON\.parse\(new TextDecoder\(\)\.decode\(inspectionBytes\)\)/);
  assert.match(optimizer, /source\.pageCount/);
  assert.match(optimizer, /inspection\.pageCount === source\.pageCount/);
  assert.doesNotMatch(optimizer, /validatePdf/);
  assert.doesNotMatch(optimizer, /PDFDocument\.load/);
  assert.doesNotMatch(optimizer, /throwOnInvalidObject/);
  assert.doesNotMatch(optimizer, /header !== "%PDF-"/);
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

test("PDF optimization tries multiple quality levels and keeps only smaller candidates", () => {
  assert.match(optimizer, /for \(const quality of JPEG_QUALITY_LEVELS\)/);
  assert.match(optimizer, /optimized-\$\{quality\}\.pdf/);
  assert.match(optimizer, /candidates/);
  assert.match(optimizer, /candidate\.bytes\.byteLength/);
  assert.match(optimizer, /candidateSize >= input\.size/);
  assert.doesNotMatch(optimizer, /structural\.pdf/);
  assert.doesNotMatch(optimizer, /images\.pdf/);
});

test("PDF optimization reports processing, success and safe fallback states", () => {
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
  assert.match(overlay, /qpdf inspection and page-count checks/i);
  assert.match(overlay, /Original kept/);
  assert.match(overlay, /validation\/optimization pipeline/i);
  assert.match(overlay, /validationReason/);
  assert.match(main, /PdfOptimizationOverlay/);
});

test("Storage client does not trigger a second hidden optimization pass", () => {
  assert.doesNotMatch(supabaseClient, /file-optimizer/);
  assert.doesNotMatch(supabaseClient, /originalStorageFrom/);
});

test("admin homework runs files through the unified compression pipeline before Storage", () => {
  assert.match(adminHomework, /compressFile\(file, setProcessing\)/);
  assert.match(adminHomework, /file_size: uploadFile\?\.size/);
});

test("teacher homework runs files through the unified compression pipeline before Storage and cleans up partial failures", () => {
  assert.match(teacherHomework, /compressFile\(uploadFile, setProcessing\)/);
  assert.match(teacherHomework, /file_size: uploadFile\.size/);
  assert.match(teacherHomework, /storage\.from\("homework"\)\.remove\(\[path\]\)/);
  assert.match(teacherHomework, /storageUploaded/);
});

test("teacher material uploads files through the unified compression pipeline before Storage", () => {
  assert.match(teacherMaterials, /compressFile\(selectedFile, setProcessing\)/);
  assert.match(teacherMaterials, /file_size: uploadFile\.size/);
});

test("active admin materials uploader runs files through the unified compression pipeline before Storage", () => {
  assert.match(adminMaterials, /compressFile\(file,setProcessing\)/);
  assert.match(adminMaterials, /file_size:uploadFile\.size/);
});
test("all supported upload paths use the unified file compression entry point", () => {
  const compression = fs.readFileSync("src/lg/fileCompression.ts", "utf8");
  assert.match(compression, /export async function compressFile/);
  assert.match(compression, /kind === "pdf"/);
  assert.ok(compression.includes("optimizePdfFile(input, onProgress)"));
  assert.match(compression, /Non-PDF formats intentionally remain unchanged/);
  for (const source of [adminHomework, teacherHomework, teacherMaterials, adminMaterials]) {
    assert.match(source, /compressFile\(/);
    assert.doesNotMatch(source, /optimizePdfFile\(/);
  }
});

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


test("PDF optimizer uses qpdf WASM and keeps a safe fallback", () => {
  assert.match(pkg.dependencies["pdf-lib"], /^\^1\.17\.1$/);
  assert.match(pkg.dependencies["qpdf-run"], /^\^0\.2\.1$/);
  assert.match(optimizer, /qpdfOptimize/);
  assert.match(optimizer, /candidateSize >= input\.size/);
  assert.match(optimizer, /engine: "qpdf-wasm"/);
  assert.doesNotMatch(optimizer, /compressPDF/);
  assert.doesNotMatch(optimizer, /@fileslim\/compress/);
});

test("PDF validation uses qpdf itself instead of pdf-lib", () => {
  assert.match(optimizer, /header !== "%PDF-"/);
  assert.match(optimizer, /qpdfCheck/);
  assert.match(optimizer, /--check/);
  assert.match(optimizer, /--show-npages/);
  assert.match(optimizer, /page count changed/);
  assert.match(optimizer, /validationReason/);
  assert.doesNotMatch(optimizer, /PDFDocument\.load/);
  assert.doesNotMatch(optimizer, /sameMetadata/);
  assert.doesNotMatch(optimizer, /DIMENSION_TOLERANCE_PT/);
});

test("qpdf runner is bundled correctly and always cleaned up", () => {
  assert.match(optimizer, /new URL\("qpdf-run\/worker"/);
  assert.match(optimizer, /new URL\("qpdf-run\/qpdf\.js"/);
  assert.match(optimizer, /new URL\("qpdf-run\/qpdf\.wasm"/);
  assert.match(optimizer, /await qpdf\.destroy\(\)/);
  assert.match(optimizer, /--optimize-images/);
  assert.match(optimizer, /--jpeg-quality=\$\{jpegQuality\}/);
  assert.match(optimizer, /runProfile\(85\)/);
  assert.match(optimizer, /runProfile\(75\)/);
  assert.match(optimizer, /--recompress-flate/);
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

test("global optimization overlay shows all requested measurements and final status", () => {
  assert.match(overlay, /Original size/);
  assert.match(overlay, /Optimized size/);
  assert.match(overlay, /Data saved/);
  assert.match(overlay, /Compression/);
  assert.match(overlay, /Optimization successful and verified/);
  assert.match(overlay, /Original kept/);
  assert.match(overlay, /compressed file was rejected for safety/i);
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

test("teacher homework runs PDFs through the optimizer before Storage", () => {
  assert.match(teacherHomework, /optimizePdfFile\(uploadFile, setProcessing\)/);
  assert.match(teacherHomework, /file_size: uploadFile\.size/);
});

test("teacher material uploads PDFs through the optimizer before Storage", () => {
  assert.match(teacherMaterials, /optimizePdfFile\(selectedFile, setProcessing\)/);
  assert.match(teacherMaterials, /file_size: uploadFile\.size/);
});

test("active admin materials uploader runs PDFs through the optimizer before Storage", () => {
  assert.match(adminMaterials, /optimizePdfFile\(file, setProcessing\)/);
  assert.match(adminMaterials, /file_size:uploadFile\.size/);
});

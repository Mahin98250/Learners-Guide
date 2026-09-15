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

test("PDF optimizer uses the safe in-app engine and keeps a safe fallback", () => {
  assert.match(pkg.dependencies["pdf-lib"], /^\^1\.17\.1$/);
  assert.match(optimizer, /buildOptimizedPdf/);
  assert.match(optimizer, /candidate\.size >= input\.size/);
  assert.match(optimizer, /engine: "safe-pdf"/);
  assert.doesNotMatch(optimizer, /compressPDF/);
  assert.doesNotMatch(optimizer, /@fileslim\/compress/);
});

test("PDF validation keeps structural safety without false metadata/page-box rejection", () => {
  assert.match(optimizer, /header !== "%PDF-"/);
  assert.match(optimizer, /page count changed/);
  assert.match(optimizer, /invalid page size/);
  assert.doesNotMatch(optimizer, /sameMetadata/);
  assert.doesNotMatch(optimizer, /DIMENSION_TOLERANCE_PT/);
  assert.match(optimizer, /validationReason/);
});

test("PDF image replacement updates the complete image dictionary", () => {
  assert.match(optimizer, /nextDict\.set\(PDFName\.of\("Filter"\)/);
  assert.match(optimizer, /nextDict\.set\(PDFName\.of\("Width"\)/);
  assert.match(optimizer, /nextDict\.set\(PDFName\.of\("Height"\)/);
  assert.match(optimizer, /nextDict\.set\(PDFName\.of\("ColorSpace"\)/);
  assert.match(optimizer, /nextDict\.delete\(PDFName\.of\("DecodeParms"\)/);
  assert.match(optimizer, /PDFRawStream\.of\(nextDict, jpeg\)/);
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
  assert.match(overlay, /optimizer could not safely complete/i);
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

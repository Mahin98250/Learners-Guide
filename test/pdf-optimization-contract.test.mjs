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
  assert.equal(pkg.dependencies["qpdf-run"], "0.2.1");
  assert.match(optimizer, /optimizeWithQpdf/);
  assert.match(optimizer, /candidateSize >= input\.size/);
  assert.match(optimizer, /engine: "qpdf-wasm"/);
  assert.match(optimizer, /OptimizationStatus = "optimized" \| "original-kept" \| "failed"/);
  assert.match(optimizer, /const fallback = originalResult\(input, "original-kept"\)/g);
  assert.doesNotMatch(optimizer, /compressPDF/);
  assert.doesNotMatch(optimizer, /@fileslim\/compress/);
});

test("PDF optimization validates page count without unsupported qpdf inspection output", () => {
  assert.match(optimizer, /import\("pdf-lib"\)/);
  assert.match(optimizer, /PDFDocument\.load/);
  assert.match(optimizer, /pdf\.getPageCount\(\)/);
  assert.match(optimizer, /source\.pageCount/);
  assert.match(optimizer, /inspection\.pageCount === source\.pageCount/);
  assert.doesNotMatch(optimizer, /outputs: \[\]/);
  assert.doesNotMatch(optimizer, /--show-npages/);
  assert.doesNotMatch(optimizer, /--json-key=pages/);
  assert.doesNotMatch(optimizer, /inspection\.json/);
  assert.doesNotMatch(optimizer, /--jpeg-quality/);
  assert.doesNotMatch(optimizer, /JPEG_QUALITY_LEVELS/);
  assert.doesNotMatch(optimizer, /validatePdf/);
  assert.doesNotMatch(optimizer, /throwOnInvalidObject/);
});
test("qpdf runner uses supported browser assets and supported compression flags", () => {
  assert.match(optimizer, /new URL\("qpdf-run\/worker"/);
  assert.match(optimizer, /new URL\("qpdf-run\/qpdf\.js"/);
  assert.match(optimizer, /new URL\("qpdf-run\/qpdf\.wasm"/);
  assert.match(optimizer, /await qpdf\.destroy\(\)/);
  assert.match(optimizer, /--optimize-images/);
  assert.match(optimizer, /--object-streams=generate/);
  assert.match(optimizer, /--recompress-flate/);
  assert.match(optimizer, /--compression-level=9/);
  assert.doesNotMatch(optimizer, /--jpeg-quality/);
});

test("PDF optimization keeps only a smaller, page-count-preserving candidate", () => {
  assert.match(optimizer, /const candidateName = "optimized\.pdf"/);
  assert.match(optimizer, /candidate\.byteLength/);
  assert.match(optimizer, /candidateSize >= input\.size/);
  assert.match(optimizer, /page-count validation/);
  assert.doesNotMatch(optimizer, /for \(const quality/);
  assert.doesNotMatch(optimizer, /optimized-\$\{quality\}\.pdf/);
});

test("PDF optimization reports processing, success and safe fallback states", () => {
  assert.match(optimizer, /lg:pdf-optimization/);
  assert.match(optimizer, /status: "processing"/);
  assert.match(optimizer, /status: "optimized"/);
  assert.match(optimizer, /status: "original-kept"/);
  assert.match(optimizer, /const fallback = originalResult\(input, "original-kept"\)/);
  assert.match(optimizer, /savingsBytes/);
  assert.match(optimizer, /savingsPercent/);
});

test("global optimization overlay shows requested measurements and final status", () => {
  assert.match(overlay, /Original size/);
  assert.match(overlay, /Optimized size/);
  assert.match(overlay, /Data saved/);
  assert.match(overlay, /Compression/);
  assert.match(overlay, /PDF validation and page-count checks/i);
  assert.match(overlay, /original PDF is kept/i);
  assert.match(overlay, /optimization pipeline/i);
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
  assert.match(compression, /Archives and legacy\/unknown formats are intentionally left untouched/);
  for (const source of [adminHomework, teacherHomework, teacherMaterials, adminMaterials]) {
    assert.match(source, /compressFile\(/);
    assert.doesNotMatch(source, /optimizePdfFile\(/);
  }
});

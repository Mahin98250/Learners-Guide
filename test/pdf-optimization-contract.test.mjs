import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const optimizer = fs.readFileSync("src/lg/fileOptimizer.ts", "utf8");
const adminHomework = fs.readFileSync("src/admin/HomeworkPage.tsx", "utf8");
const teacherHomework = fs.readFileSync("src/lg/teacherHomeworkApp.jsx", "utf8");
const materials = fs.readFileSync("src/admin/MaterialsDriveV2.tsx", "utf8");

test("PDF optimizer dependency and safe fallback are present", () => {
  assert.match(pkg.dependencies["@fileslim/compress"], /^\^2\.3\.0$/);
  assert.match(optimizer, /compressPDF/);
  assert.match(optimizer, /candidateSize >= input\.size/);
  assert.match(optimizer, /stripMetadata: false/);
});

test("admin homework runs PDFs through the optimizer before Storage", () => {
  assert.match(adminHomework, /optimizePdfFile\(file, setProcessing\)/);
  assert.match(adminHomework, /file_size: uploadFile\?\.size/);
});

test("teacher homework runs PDFs through the optimizer before Storage", () => {
  assert.match(teacherHomework, /optimizePdfFile\(uploadFile, setProcessing\)/);
  assert.match(teacherHomework, /file_size: uploadFile\.size/);
});

test("modern materials drive has the optimizer integration contract", () => {
  assert.match(materials, /optimizePdfFile/);
  assert.match(materials, /file_size:file\.size/);
});

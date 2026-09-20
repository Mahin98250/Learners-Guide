import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const compression = fs.readFileSync("src/lg/fileCompression.ts", "utf8");
const teacherHomework = fs.readFileSync("src/lg/teacherHomeworkApp.jsx", "utf8");
const teacherMaterials = fs.readFileSync("src/lg/teacherWorkflows.jsx", "utf8");

test("unified compression detects the formats the teacher upload UI accepts", () => {
  assert.match(compression, /extension === "\.pdf"/);
  assert.match(compression, /IMAGE_MIME_TYPES = new Set\(\["image\/jpeg", "image\/png", "image\/webp"\]\)/);
  assert.match(compression, /OOXML_EXTENSIONS = new Set\(\["\.docx", "\.docm", "\.pptx", "\.pptm", "\.xlsx", "\.xlsm"\]\)/);
  assert.match(teacherHomework, /const ACCEPT = "\.pdf,\.ppt,\.pptx,\.doc,\.docx,\.png,\.jpg,\.jpeg"/);
  assert.match(teacherMaterials, /const ACCEPT = "\.pdf,\.ppt,\.pptx,\.doc,\.docx,\.png,\.jpg,\.jpeg"/);
  assert.match(compression, /extension === "\.png"/);
});

test("Office compression validates package structure, signatures, and byte-preserving round trips", () => {
  assert.match(compression, /\{ unzipSync, zipSync \} = await import\("fflate"\)/);
  assert.match(compression, /\[Content_Types\]\.xml/);
  assert.match(compression, /_xmlsignatures\//);
  assert.match(compression, /sourceNames\.length !== candidateNames\.length/);
  assert.match(compression, /source\[index\] !== candidate\[index\]/);
});

test("every accepted teacher attachment goes through unified compression", () => {
  assert.doesNotMatch(
    teacherHomework,
    /if \(uploadFile\?\.type === "application\/pdf" \|\| uploadFile\?\.name\.toLowerCase\(\)\.endsWith\("\.pdf"\)\)/
  );
  assert.doesNotMatch(
    teacherMaterials,
    /if \(selectedFile\.type === "application\/pdf" \|\| selectedFile\.name\.toLowerCase\(\)\.endsWith\("\.pdf"\)\)/
  );
  assert.match(teacherHomework, /const optimized = await compressFile\(uploadFile, setProcessing\)/);
  assert.match(teacherMaterials, /const optimized = await compressFile\(selectedFile, setProcessing\)/);
});

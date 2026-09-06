import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260906170000_phase_exam_results_integrity_hardening.sql", "utf8");
const studentResults = fs.readFileSync("src/lg/studentResults.jsx", "utf8");
const parent = fs.readFileSync("src/lg/parentWorkflows.jsx", "utf8");

assert.match(migration, /validate_test_result_integrity/);
assert.match(migration, /new\.marks\s*<\s*0/);
assert.match(migration, /new\.marks\s*>\s*v_total/);
assert.match(migration, /batch_students/);
assert.match(migration, /bs\.status\s*=\s*'active'/);
assert.match(migration, /create trigger test_results_integrity/);
assert.match(studentResults, /from\("test_results"\)/);
assert.match(studentResults, /from\("tests"\)/);
assert.match(parent, /from\("test_results"\)/);
assert.match(parent, /from\("tests"\)/);

console.log("Exam/results integrity contract passed.");

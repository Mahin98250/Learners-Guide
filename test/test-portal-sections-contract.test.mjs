import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Student tests are split into upcoming and previous sections", () => {
  const s = read("src/lg/studentResults.jsx");
  assert.match(s, /const upcoming=rows\.filter\(r=>dateKey\(r\.date\)>=todayKey\(\)/);
  assert.match(s, /const previous=rows\.filter\(r=>dateKey\(r\.date\)<todayKey\(\)/);
  assert.match(s, /Upcoming Tests & Exams/);
  assert.match(s, /Previous Tests & Exams/);
});

test("Teacher portal exposes tests and result entry", () => {
  const app = read("src/lg/teacherHomeworkApp.jsx");
  const tests = read("src/lg/teacherTests.jsx");
  assert.match(app, /import\s*\{TTests,TTestResults\}\s*from\s*"@\/lg\/teacherTests"/);
  assert.match(app, /key:"tests",icon:"📋",label:"Tests"/);
  assert.match(app, /tab==="tests"\?/);
  assert.match(app, /<TTests teacher=\{teacher\}\/>/);
  assert.match(app, /<TTestResults teacher=\{teacher\}\/>/);
  assert.match(tests, /Upcoming Tests/);
  assert.match(tests, /Previous Tests/);
  assert.match(tests, /supabase\.from\("test_results"\)/);
  assert.match(tests, /Save Results/);
});

test("Admin test management keeps separate upcoming and previous sections", () => {
  const a = read("src/admin/tests/TestManagementPage.tsx");
  assert.match(a, /upcomingTests/);
  assert.match(a, /previousTests/);
  assert.match(a, /Upcoming Tests/);
  assert.match(a, /Previous Tests/);
});

test("Parent portal retains results data flow", () => {
  const p = read("src/lg/parentWorkflows.jsx");
  assert.match(p, /test_results/);
  assert.match(p, /Results/);
});

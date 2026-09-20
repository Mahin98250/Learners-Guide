import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("active admin credential defaults are centralized and legacy admin tree is retired", () => {
  const constants = read("src/admin/records/AdminRecordsConstants.ts");
  const records = read("src/admin/records/AdminRecordsPage.tsx");
  const teachers = read("src/admin/records/TeacherRecordsPage.tsx");

  assert.match(constants, /DEFAULT_STUDENT_PASSWORD\s*=\s*"Student@1234"/);
  assert.match(constants, /DEFAULT_PARENT_PASSWORD\s*=\s*"Parent@1234"/);
  assert.match(constants, /DEFAULT_TEACHER_PASSWORD\s*=\s*"Teacher@1234"/);
  assert.match(records, /DEFAULT_STUDENT_PASSWORD/);
  assert.match(records, /DEFAULT_PARENT_PASSWORD/);
  assert.match(records, /Default password: Student@1234/);
  assert.match(records, /Default password: Parent@1234/);
  assert.match(teachers, /DEFAULT_TEACHER_PASSWORD/);
  assert.match(teachers, /Default: Teacher@1234/);
  assert.doesNotMatch(teachers, /const DEFAULT_PASSWORD = "1234"/);

  for (const legacy of [
    "src/admin/ReferenceAdminPanel.tsx",
    "src/admin/ReferenceAdminRouter.tsx",
    "src/admin/ReferenceAdminStudents.tsx",
    "src/admin/ReferenceAdminTeachers.tsx",
    "src/admin/ReferenceAdminBatches.tsx",
  ]) {
    assert.equal(fs.existsSync(path.join(root, legacy)), false, legacy);
  }
});

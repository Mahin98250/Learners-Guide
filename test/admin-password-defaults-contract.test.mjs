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
  const teacherRecords = read("src/admin/records/AdminRecordsPage.tsx");

  assert.doesNotMatch(constants, /DEFAULT_(?:STUDENT|PARENT|TEACHER)_PASSWORD/);
  assert.doesNotMatch(records, /Student@1234|Parent@1234|Teacher@1234/);
  assert.match(records, /label="Student Password"/);
  assert.match(records, /label="Parent Password"/);
  assert.match(records, /label="Teacher Password"/);
  assert.doesNotMatch(teacherRecords, /DEFAULT_TEACHER_PASSWORD/);
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

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("legacy admin credential defaults are explicit source constants", () => {
  const students = read("src/admin/ReferenceAdminStudents.tsx");
  const teachers = read("src/admin/ReferenceAdminTeachers.tsx");

  assert.match(students, /pass: "Student@1234"/);
  assert.match(students, /placeholder="Default: Student@1234"/);
  assert.match(students, /Parent default password: <b>Parent@1234<\/b>|Default login passwords: Student <b>Student@1234<\/b> · Parent <b>Parent@1234<\/b>/);
  assert.doesNotMatch(students, /pass: "1234"/);

  assert.match(teachers, /pass: "Teacher@1234"/);
  assert.match(teachers, /Default teacher password: <b>Teacher@1234<\/b>/);
  assert.doesNotMatch(teachers, /pass: "1234"/);
});

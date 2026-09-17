import fs from "node:fs";
import path from "node:path";

const files = {
  students: path.resolve("src/admin/ReferenceAdminStudents.tsx"),
  teachers: path.resolve("src/admin/ReferenceAdminTeachers.tsx"),
};

const read = (file) => fs.readFileSync(file, "utf8");
const writeIfChanged = (file, before, source) => {
  if (source === before) return false;
  fs.writeFileSync(file, source);
  return true;
};

// Keep the actual extracted admin components as the source of truth. This
// prebuild step only normalizes documented default credentials and the
// deterministic student roll-number UI.
const studentBefore = read(files.students);
let studentSource = studentBefore;
studentSource = studentSource
  .replaceAll('pass: "1234"', 'pass: "Student@1234"')
  .replaceAll('placeholder="Default: 1234"', 'placeholder="Default: Student@1234"')
  .replaceAll("parent@1234", "Parent@1234")
  .replace(
    /return `LG-?\$\{String\(Math\.max\(0, \.\.\.nums\) \+ 1\)\.padStart\(3, "0"\)\}`;/,
    'return `LG-${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;',
  );

if (!studentSource.includes("Default login passwords: Student <b>Student@1234</b> · Parent <b>Parent@1234</b>")) {
  studentSource = studentSource.replace(
    '              Parent default password: <b>Parent@1234</b>\n            </div>',
    '              Default login passwords: Student <b>Student@1234</b> · Parent <b>Parent@1234</b>\n            </div>',
  );
}

const teacherBefore = read(files.teachers);
let teacherSource = teacherBefore.replaceAll('pass: "1234"', 'pass: "Teacher@1234"');
if (!teacherSource.includes("Default teacher password: <b>Teacher@1234</b>")) {
  const teacherPasswordField = `          <Field
            label="Password"
            value={form.pass}
            onChange={(v) => setForm({ ...form, pass: v })}
          />`;
  teacherSource = teacherSource.replace(
    teacherPasswordField,
    `${teacherPasswordField}\n          <div style={{ background: "#fff7ed", padding: 12, borderRadius: 12, fontSize: 12, color: "#92400e", marginBottom: 13 }}>
            Default teacher password: <b>Teacher@1234</b>
          </div>`,
  );
}

const changedStudents = writeIfChanged(files.students, studentBefore, studentSource);
const changedTeachers = writeIfChanged(files.teachers, teacherBefore, teacherSource);

console.log(
  `Admin default-password and student-roll UI prepared. students=${changedStudents ? "updated" : "unchanged"}, teachers=${changedTeachers ? "updated" : "unchanged"}`,
);

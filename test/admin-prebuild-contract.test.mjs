import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "prepare-admin-password-ui.mjs");

const writeFixture = (root) => {
  const adminDir = path.join(root, "src", "admin");
  fs.mkdirSync(adminDir, { recursive: true });
  fs.writeFileSync(
    path.join(adminDir, "ReferenceAdminStudents.tsx"),
    `const form = { pass: "1234" };\nconst help = 'placeholder="Default: 1234"';\nconst parent = 'pass: "parent@1234"';\nconst parentHelp = '              Parent default password: <b>parent@1234</b>\\n            </div>';\nconst nextSid = () => {\n  const nums = [];\n  return \`LG\${String(Math.max(0, ...nums) + 1).padStart(3, "0")}\`;\n};\n`,
  );
  fs.writeFileSync(
    path.join(adminDir, "ReferenceAdminTeachers.tsx"),
    `const form = { pass: "1234" };\nconst teacherPasswordField = \`          <Field\\n            label="Password"\\n            value={form.pass}\\n            onChange={(v) => setForm({ ...form, pass: v })}\\n          />\`;\n`,
  );
};

test("admin prebuild prepares extracted student and teacher modules", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lg-admin-prebuild-"));
  try {
    writeFixture(tempRoot);
    const scriptTarget = path.join(tempRoot, "scripts", "prepare-admin-password-ui.mjs");
    fs.mkdirSync(path.dirname(scriptTarget), { recursive: true });
    fs.copyFileSync(scriptPath, scriptTarget);

    execFileSync(process.execPath, [scriptTarget], {
      cwd: tempRoot,
      stdio: "pipe",
    });

    const students = fs.readFileSync(
      path.join(tempRoot, "src", "admin", "ReferenceAdminStudents.tsx"),
      "utf8",
    );
    const teachers = fs.readFileSync(
      path.join(tempRoot, "src", "admin", "ReferenceAdminTeachers.tsx"),
      "utf8",
    );

    assert.match(students, /Student@1234/);
    assert.match(students, /Default: Student@1234/);
    assert.match(students, /Parent@1234/);
    assert.match(students, /return `LG-\$\{String\(Math\.max\(0, \.\.\.nums\) \+ 1\)\.padStart\(3, "0"\)\}`;/);
    assert.match(
      students,
      /Default login passwords: Student <b>Student@1234<\/b> · Parent <b>Parent@1234<\/b>/,
    );
    assert.match(teachers, /Teacher@1234/);
    assert.match(teachers, /Default teacher password: <b>Teacher@1234<\/b>/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

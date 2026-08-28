import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/admin/ReferenceAdminPanel.tsx");
let source = fs.readFileSync(file, "utf8");
const before = source;

// Keep the actual admin component as the source of truth. This prebuild step only
// normalizes documented default credentials and does not touch custom passwords.
const studentStart = source.indexOf("function Students");
const teacherStart = source.indexOf("function Teachers");
const simpleCrudStart = source.indexOf("function SimpleCrud");

if (studentStart >= 0 && teacherStart > studentStart) {
  const prefix = source.slice(0, studentStart);
  const body = source
    .slice(studentStart, teacherStart)
    .replaceAll('pass: "1234"', 'pass: "Student@1234"')
    .replaceAll('placeholder="Default: 1234"', 'placeholder="Default: Student@1234"')
    .replaceAll('parent@1234', 'Parent@1234');
  source = prefix + body + source.slice(teacherStart);
}

const teacherEnd = simpleCrudStart > teacherStart ? simpleCrudStart : source.length;
if (teacherStart >= 0 && teacherEnd > teacherStart) {
  const prefix = source.slice(0, teacherStart);
  const body = source
    .slice(teacherStart, teacherEnd)
    .replaceAll('pass: "1234"', 'pass: "Teacher@1234"');
  source = prefix + body + source.slice(teacherEnd);
}

// Normalize the parent credential used by the actual runtime save path.
source = source.replaceAll('pass: "parent@1234"', 'pass: "Parent@1234"');
source = source.replaceAll('Parent default password: <b>parent@1234</b>', 'Parent default password: <b>Parent@1234</b>');

// Keep the UI documentation synchronized with provisioning.
if (!source.includes("Default login passwords: Student <b>Student@1234</b> · Parent <b>Parent@1234</b>")) {
  source = source.replace(
    '              Parent default password: <b>Parent@1234</b>\n            </div>',
    '              Default login passwords: Student <b>Student@1234</b> · Parent <b>Parent@1234</b>\n            </div>',
  );
}

if (!source.includes("Default teacher password: <b>Teacher@1234</b>")) {
  const teacherPasswordField = `          <Field\n            label="Password"\n            value={form.pass}\n            onChange={(v) => setForm({ ...form, pass: v })}\n          />`;
  source = source.replace(
    teacherPasswordField,
    `${teacherPasswordField}\n          <div style={{ background: "#fff7ed", padding: 12, borderRadius: 12, fontSize: 12, color: "#92400e", marginBottom: 13 }}>\n            Default teacher password: <b>Teacher@1234</b>\n          </div>`,
  );
}

if (source !== before) fs.writeFileSync(file, source);
console.log("Admin default-password UI prepared.");

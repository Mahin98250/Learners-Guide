import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/admin/ReferenceAdminPanel.tsx");
let source = fs.readFileSync(file, "utf8");
const before = source;

source = source.replace(/(function Students[\s\S]*?pass:\s*")[^"]+("[\s\S]*?parentName:)/m, (_m, prefix, suffix) => `${prefix}Student@1234${suffix}`);
source = source.replace(/(function Teachers[\s\S]*?pass:\s*")[^"]+("[\s\S]*?\n\s*\}\),?)/m, (_m, prefix, suffix) => `${prefix}Teacher@1234${suffix}`);
source = source.replaceAll("parent@1234", "Parent@1234");
source = source.replace('placeholder="Default: 1234"', 'placeholder="Default: Student@1234"');

if (!source.includes("Default login passwords: Student <b>Student@1234</b>")) {
  source = source.replace(
    '              Parent default password: <b>Parent@1234</b>\n            </div>',
    '              Default login passwords: Student <b>Student@1234</b> · Parent <b>Parent@1234</b>\n            </div>',
  );
}

const teacherPasswordField = `          <Field\n            label="Password"\n            value={form.pass}\n            onChange={(v) => setForm({ ...form, pass: v })}\n          />`;
if (!source.includes("Default teacher password: <b>Teacher@1234</b>")) {
  source = source.replace(
    teacherPasswordField,
    `${teacherPasswordField}\n          <div style={{ background: "#fff7ed", padding: 12, borderRadius: 12, fontSize: 12, color: "#92400e", marginBottom: 13 }}>\n            Default teacher password: <b>Teacher@1234</b>\n          </div>`,
  );
}

if (source !== before) fs.writeFileSync(file, source);
console.log("Admin default-password UI prepared.");

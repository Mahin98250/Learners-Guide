import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Admin advanced home is wired as the primary admin landing screen", () => {
  const admin = read("src/admin/AdminWithDrive.tsx");
  const home = read("src/admin/AdvancedAdminHome.tsx");
  assert.match(admin, /import \{ AdvancedAdminHome \} from "@\/admin\/AdvancedAdminHome"/);
  assert.match(admin, /if \(advancedHome\) return <AdvancedAdminHome/);
  assert.match(home, /Students/);
  assert.match(home, /Teachers/);
  assert.match(home, /Batches/);
  assert.match(home, /Tests & Results/);
  assert.match(home, /Attendance/);
  assert.match(home, /Fees/);
  assert.match(home, /Study Materials/);
  assert.match(home, /Analytics/);
  assert.match(home, /@media\(max-width:1100px\)/);
  assert.match(home, /@media\(max-width:800px\)/);
  assert.match(home, /@media\(max-width:520px\)/);
});

test("Admin advanced home keeps the existing management portal available", () => {
  const admin = read("src/admin/AdminWithDrive.tsx");
  assert.match(admin, /onOpenManagement=\{\(\) => setAdvancedHome\(false\)\}/);
  assert.match(admin, /<ReferenceAdminPanel user=\{user\} onLogout=\{onLogout\} \/>/);
});

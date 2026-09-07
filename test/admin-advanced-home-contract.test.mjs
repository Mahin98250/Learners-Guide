import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("current admin landing uses the modern portal", () => {
  const admin = read("src/admin/AdminWithDrive.tsx");
  const portal = read("src/admin/ModernAdminPortal.tsx");
  assert.match(admin, /import \{ ModernAdminPortal \} from "@\/admin\/ModernAdminPortal"/);
  assert.match(admin, /<ModernAdminPortal user=\{user\} onLogout=\{onLogout\} \/>/);
  assert.match(portal, /Attendance/);
  assert.match(portal, /Fees/);
  assert.match(portal, /People & Analytics/);
});

test("modern admin landing does not retain retired wrappers", () => {
  const admin = read("src/admin/AdminWithDrive.tsx");
  assert.doesNotMatch(admin, /AdvancedAdminHome|AdminManagementHub|ReferenceAdminPanel/);
});

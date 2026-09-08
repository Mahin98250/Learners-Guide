import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("modern admin portal contains the management areas", () => {
  const source = read("src/admin/ModernAdminPortal.tsx");
  for (const label of ["Students", "Teachers", "User Accounts", "Search Profiles", "Batches & Timetable", "Attendance", "Fees", "Announcements", "Analytics"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("admin wrapper keeps only the modern portal entry point", () => {
  const source = read("src/admin/AdminWithDrive.tsx");
  assert.match(source, /ModernAdminPortal/);
  assert.doesNotMatch(source, /AdminManagementHub|ReferenceAdminPanel|setManagementHub/);
});

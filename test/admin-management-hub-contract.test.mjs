import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Admin management hub groups the core management areas and supports search", () => {
  const source = read("src/admin/AdminManagementHub.tsx");
  for (const label of ["People", "Academic", "Operations", "Students", "Teachers", "Batches & Timetable", "Attendance", "Fees", "Announcements"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /Search management/);
  assert.match(source, /Admin Management/);
});

test("Admin flow can open the management hub without removing the legacy panel", () => {
  const source = read("src/admin/AdminWithDrive.tsx");
  assert.match(source, /AdminManagementHub/);
  assert.match(source, /setManagementHub\(true\)/);
  assert.match(source, /<ReferenceAdminPanel/);
});

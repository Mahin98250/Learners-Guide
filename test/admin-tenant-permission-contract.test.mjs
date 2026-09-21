import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tenant = fs.readFileSync("src/lg/tenant.ts", "utf8");
const adminRoute = fs.readFileSync("src/routes/admin.tsx", "utf8");
const recordsAuth = fs.readFileSync("src/admin/records/AdminRecordsAuth.ts", "utf8");

test("tenant helper exposes server-side permission checks", () => {
  assert.match(tenant, /user_has_institute_permission/);
  assert.match(tenant, /p_institute_id: id/);
  assert.match(tenant, /p_permission_code: code/);
});

test("admin route requires an active tenant permission", () => {
  assert.match(adminRoute, /getCurrentInstituteContext/);
  assert.match(adminRoute, /hasInstitutePermission/);
  assert.match(adminRoute, /people\.manage/);
});

test("admin account management requires tenant permission", () => {
  assert.match(recordsAuth, /hasInstitutePermission/);
  assert.match(recordsAuth, /people\.manage/);
});

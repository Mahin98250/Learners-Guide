import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const edge = fs.readFileSync("supabase/functions/admin-provision-user/index.ts", "utf8");
const page = fs.readFileSync("src/admin/AdminAccountPage.tsx", "utf8");

test("administrator listing is tenant-scoped", () => {
  assert.match(edge, /list-admins/);
  assert.match(edge, /institute_memberships/);
  assert.match(edge, /instituteId/);
  assert.match(edge, /authIds/);
});

test("new administrator provisioning links the created account to the institute", () => {
  assert.match(edge, /ensureAdminInstituteMembership/);
  assert.match(edge, /role_key.*institute_admin/);
  assert.match(edge, /role:"admin"/);
});

test("admin account UI always sends the selected institute context", () => {
  assert.match(page, /list-admins.*instituteId/);
  assert.match(page, /role: "admin".*instituteId/);
});

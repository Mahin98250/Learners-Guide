import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("src/routes/admin.tsx", "utf8");
const legacy = fs.readFileSync("src/admin/AdminPortal.tsx", "utf8");
const helper = fs.readFileSync("src/lg/admin-access.ts", "utf8");

test("admin route uses centralized verified workspace authorization", () => {
  assert.match(route, /getVerifiedAdminAccess\("people\.manage"\)/);
  assert.doesNotMatch(route, /current\.role\s*!==\s*"admin"/);
  assert.match(route, /if \(!access\)/);
});

test("successful admin login cannot bypass workspace authorization", () => {
  assert.match(route, /onSuccess=\{\(\) => \{ void load\(\); \}\}/);
});

test("legacy admin portal uses the same authorization helper", () => {
  assert.match(legacy, /getVerifiedAdminAccess\("people\.manage"\)/);
  assert.doesNotMatch(legacy, /current\?\.role\s*===\s*"admin"/);
});

test("centralized helper requires active membership and server-side permission", () => {
  assert.match(helper, /membership\.status !== "active"/);
  assert.match(helper, /hasInstitutePermission\(membership\.institute_id, permission\)/);
});

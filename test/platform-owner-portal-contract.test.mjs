import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const portal = fs.readFileSync("src/platform/PlatformOwnerPortal.tsx","utf8");
const route = fs.readFileSync("src/routes/owner.tsx","utf8");

test("platform owner UI is separated from institute portals",()=>{
  assert.match(route,/createFileRoute\("/owner"\)/);
  assert.match(portal,/current_platform_roles/);
  assert.match(portal,/PLATFORM OWNER/);
});

test("platform owner UI uses protected provisioning functions",()=>{
  assert.match(portal,/create_institute/);
  assert.match(portal,/register_institute_domain/);
  assert.match(portal,/audit_logs/);
});

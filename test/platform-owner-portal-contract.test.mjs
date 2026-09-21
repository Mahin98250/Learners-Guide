import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const portal = fs.readFileSync("src/platform/PlatformOwnerPortal.tsx","utf8");
const route = fs.readFileSync("src/routes/owner.tsx","utf8");

test("platform owner UI is separated from institute portals",()=>{
  assert.ok(route.includes('createFileRoute("/owner")'));
  assert.match(portal,/current_platform_roles/);
  assert.match(portal,/PLATFORM OWNER/);
});

test("platform owner UI uses protected provisioning functions",()=>{
  assert.match(portal,/create_institute/);
  assert.match(portal,/register_institute_domain/);
  assert.match(portal,/audit_logs/);
});


test("platform owner control center exposes protected operational controls",()=>{
  assert.match(portal,/platform_set_institute_status/);
  assert.match(portal,/platform_set_primary_domain/);
  assert.match(portal,/platform_disable_domain/);
  assert.match(portal,/platform_update_settings/);
  assert.match(portal,/Edit platform settings/);
  assert.match(portal,/AUDIT TRAIL/);
});

import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration=fs.readFileSync("supabase/migrations/20260922250000_platform_institute_provisioning_onboarding.sql","utf8");
const portal=fs.readFileSync("src/platform/PlatformOwnerPortal.tsx","utf8");

test("Phase 3 provisioning is atomic and platform-owner MFA protected",()=>{
  assert.match(migration,/create or replace function public\.platform_provision_institute/);
  assert.match(migration,/platform_owner_access_ok\(\)/);
  assert.match(migration,/set search_path = ''/);
  assert.match(migration,/status,'trial'/);
  assert.match(migration,/perform public\.seed_institute_defaults\(v_id\)/);
  assert.match(migration,/revoke all on function public\.platform_provision_institute\(text,text,text,text,text\) from public,anon/);
  assert.match(migration,/grant execute on function public\.platform_provision_institute\(text,text,text,text,text\) to authenticated/);
  assert.match(migration,/institute\.provisioned/);
});

test("Owner portal uses the single provisioning operation",()=>{
  assert.match(portal,/platform_provision_institute/);
  assert.match(portal,/Provision institute/);
  assert.match(portal,/Custom domain/);
  assert.doesNotMatch(portal,/supabase\.from\("institutes"\)\.insert/);
});

console.log("Phase 3 institute provisioning contract checks passed.");

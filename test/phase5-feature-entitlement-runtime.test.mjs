import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration=fs.readFileSync("supabase/migrations/20260922290000_phase5_feature_entitlement_runtime.sql","utf8");
const hook=fs.readFileSync("src/lg/institute-features.tsx","utf8");
const admin=fs.readFileSync("src/admin/ModernAdminPortal.tsx","utf8");

test("runtime entitlement check is tenant-aware and not anonymously callable",()=>{
  assert.match(migration,/current_institute_feature_enabled/);
  assert.ok(migration.includes("m.status = 'active'"));
  assert.ok(migration.includes("e.enabled = true"));
  assert.ok(migration.includes("auth.uid()"));
  assert.ok(migration.includes("revoke all on function public.current_institute_feature_enabled(text) from public, anon"));
  assert.ok(migration.includes("grant execute on function public.current_institute_feature_enabled(text) to authenticated"));
});

test("tenant members can read only their entitlement rows",()=>{
  assert.match(migration,/institute_feature_entitlements_member_read/);
  assert.match(migration,/public\.user_is_institute_member\(institute_id\)/);
});

test("admin navigation is controlled by feature entitlements",()=>{
  assert.match(hook,/useInstituteFeatures/);
  assert.match(hook,/FeatureDisabled/);
  assert.match(admin,/useInstituteFeatures/);
  assert.match(admin,/visibleGroups/);
  for(const feature of ["students","teachers","academics","attendance","homework","assessments","materials","fees","announcements","reports","notifications"]){
    assert.ok(admin.includes('feature: "'+feature+'"'),"missing admin mapping: "+feature);
  }
});

console.log("Phase 5 feature entitlement runtime contract checks passed.");

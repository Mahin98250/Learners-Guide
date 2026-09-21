import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync("supabase/migrations/20260921200000_multi_institute_tenant_boundary_enforcement.sql","utf8").toLowerCase();

test("tenant boundary migration uses restrictive policies",()=>{
  assert.match(source,/as restrictive for all/);
  assert.match(source,/user_is_institute_member\(institute_id\)/);
});
test("tenant boundary migration auto-fills single-institute inserts and blocks ambiguous writes",()=>{
  assert.match(source,/v_membership_count/);
  assert.match(source,/institute_id is required when the account belongs to multiple institutes/);
});
test("tenant boundary prevents cross-institute row moves and creates membership assignment helper",()=>{
  assert.match(source,/changing an existing row between institutes is not permitted/);
  assert.match(source,/public\.assign_institute_membership/);
  assert.match(source,/public\.is_platform_member\(\)/);
});

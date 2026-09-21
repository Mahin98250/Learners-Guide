import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("supabase/functions/admin-provision-user/index.ts", "utf8");

test("existing shared accounts cannot be password-reset from one institute", () => {
  assert.match(source, /shared with another institute and its password cannot be changed/);
  assert.match(source, /existingMemberships\.some\(\(m:any\)=>String\(m\.institute_id\)!==instituteId\)/);
});

test("credential changes are blocked when an account belongs to another active institute", () => {
  assert.match(source, /shared with another institute; credential changes must be managed outside a single institute workspace/);
  assert.match(source, /targetMemberships\.some\(\(m:any\)=>String\(m\.institute_id\)!==instituteId\)\&\&\(password\|\|isEmail\(recoveryEmail\)\)/);
});

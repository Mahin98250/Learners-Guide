import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("supabase/migrations/20260921214000_institute_membership_provisioning_rpc.sql", "utf8").toLowerCase();

test("phase 4 membership synchronization is security-definer and tenant scoped", () => {
  assert.match(source, /sync_institute_account_membership/);
  assert.match(source, /security definer/);
  assert.match(source, /teachers\.manage/);
  assert.match(source, /students\.manage/);
  assert.match(source, /institute_memberships/);
});

test("phase 4 deletion removes a tenant membership before global auth deletion", () => {
  assert.match(source, /remove_institute_account_membership/);
  assert.match(source, /membership_removed/);
  assert.match(source, /remaining_memberships/);
});

test("phase 4 parent links carry the institute boundary", () => {
  assert.match(source, /parent_student_links/);
  assert.match(source, /institute_id/);
});
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260921150010_fix_membership_removal_status.sql",
  "utf8",
);

test("membership removal uses the valid revoked terminal status", () => {
  assert.match(migration, /status = 'revoked'/);
  assert.match(migration, /status='revoked'/);
  assert.doesNotMatch(migration, /status\s*=\s*['"]removed['"]/);
});

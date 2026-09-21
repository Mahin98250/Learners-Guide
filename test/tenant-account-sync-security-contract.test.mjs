import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260922120000_harden_tenant_account_sync.sql",
  "utf8",
);

test("tenant account sync requires a real target auth account", () => {
  assert.match(migration, /if\s+p_auth_id\s+is\s+null/i);
  assert.match(migration, /from\s+auth\.users\s+u/i);
  assert.match(migration, /Target authentication account not found/i);
});

test("tenant account sync blocks global profile rewrites across institutes", () => {
  assert.match(
    migration,
    /institute_memberships\s+other_membership[\s\S]*other_membership\.status\s*=\s*'active'/i,
  );
  assert.match(
    migration,
    /other_membership\.institute_id\s*<>\s*p_institute_id/i,
  );
  assert.match(
    migration,
    /Global identity data must not be rewritten by an institute admin/i,
  );
});

test("parent account sync requires the linked student to be in the selected institute", () => {
  assert.match(migration, /from\s+public\.students\s+s/i);
  assert.match(migration, /s\.institute_id\s*=\s*p_institute_id/i);
  assert.match(
    migration,
    /Student does not belong to the selected institute/i,
  );
});

test("tenant account sync keeps API execute privileges least-privilege", () => {
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.sync_institute_account_membership\([^;]+from\s+public,\s*anon/i,
  );
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.sync_institute_account_membership\([^;]+to\s+authenticated/i,
  );
});

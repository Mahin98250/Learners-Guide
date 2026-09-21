import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "supabase/functions/admin-provision-user/index.ts",
  "utf8",
);

test("admin provisioning authorizes through the selected institute permission", () => {
  assert.match(source, /user_has_institute_permission/);
  assert.match(source, /p_institute_id:instituteId/);
  assert.match(source, /people\.manage/);
  assert.match(source, /teachers\.manage/);
  assert.match(source, /students\.manage/);
});

test("admin provisioning does not use app_metadata admin role as the caller gate", () => {
  assert.doesNotMatch(
    source,
    /callerAdmin\.user\.app_metadata\?\.role!==["']admin["']/,
  );
});

test("global account deletion is blocked across active institute memberships", () => {
  assert.match(source, /active in another institute/);
  assert.match(source, /targetMemberships/);
});

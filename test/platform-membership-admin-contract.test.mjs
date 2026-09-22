import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260922230000_platform_people_roles_control_center.sql"), "utf8");
const panel = readFileSync(join(process.cwd(), "src/platform/PlatformMembershipPanel.tsx"), "utf8");

for (const fn of [
  "platform_assign_institute_membership",
  "platform_set_institute_membership_status",
  "platform_create_institute_role",
  "platform_set_role_permission",
  "platform_archive_institute_role",
]) assert.match(migration, new RegExp(fn));

assert.match(migration, /platform_owner_access_ok\(\)/);
assert.match(migration, /security definer set search_path = ''/);
assert.match(migration, /revoke all on function/);
assert.match(migration, /The last institute owner cannot/);
assert.match(migration, /role\.permission\.granted/);
assert.match(migration, /role\.permission\.revoked/);

assert.match(panel, /platform_assign_institute_membership/);
assert.match(panel, /platform_set_institute_membership_status/);
assert.match(panel, /platform_create_institute_role/);
assert.match(panel, /platform_set_role_permission/);
assert.match(panel, /platform_archive_institute_role/);
assert.match(panel, /People & memberships/);
assert.match(panel, /Roles & permissions/);

console.log("Phase 1 People & Roles control center contract checks passed.");

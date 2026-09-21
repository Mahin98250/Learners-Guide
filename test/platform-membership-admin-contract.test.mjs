import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260921223000_multi_institute_phase5_platform_membership_admin.sql"), "utf8");
const panel = readFileSync(join(process.cwd(), "src/platform/PlatformMembershipPanel.tsx"), "utf8");

assert.match(migration, /platform_assign_institute_membership/);
assert.match(migration, /platform_remove_institute_membership/);
assert.match(migration, /security definer set search_path = ''/);
assert.match(migration, /platform_memberships pm/);
assert.match(migration, /revoke all on function/);
assert.match(panel, /platform_assign_institute_membership/);
assert.match(panel, /platform_remove_institute_membership/);
assert.match(panel, /institute_memberships/);
console.log("Phase 5 platform membership contract checks passed.");

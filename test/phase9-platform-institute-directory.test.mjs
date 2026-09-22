import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260923010000_phase9_platform_institute_directory.sql",
  "utf8",
);
const helper = fs.readFileSync("src/platform/platform-tenant-data.ts", "utf8");

test("Phase 9 platform institute directory is owner-gated and bounded", () => {
  assert.match(migration, /create or replace function public\.platform_list_institutes/);
  assert.match(migration, /platform_owner_access_ok\(\)/);
  assert.match(migration, /least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/);
  assert.match(migration, /limit v_limit \+ 1/);
  assert.match(migration, /order by i\.created_at desc, i\.id desc/);
  assert.match(migration, /revoke all on function public\.platform_list_institutes/);
});

test("Phase 9 directory uses keyset pagination instead of offset pagination", () => {
  assert.match(migration, /p_cursor_created_at timestamptz/);
  assert.match(migration, /p_cursor_id uuid/);
  assert.match(migration, /\(i\.created_at, i\.id\) < \(p_cursor_created_at, p_cursor_id\)/);
  assert.doesNotMatch(migration, /offset p_/i);
  assert.match(migration, /next_cursor/);
});

test("Phase 9 directory search and status filtering are server-side", () => {
  assert.match(migration, /p_search text/);
  assert.match(migration, /p_status text/);
  assert.match(migration, /lower\(i\.name\) like/);
  assert.match(migration, /lower\(i\.slug\) like/);
  assert.match(migration, /v_status is null or i\.status = v_status/);
});

test("Phase 9 adds bounded aggregate status counts", () => {
  assert.match(migration, /create or replace function public\.platform_institute_status_counts/);
  assert.match(migration, /group by status/);
  assert.match(migration, /platform_owner_access_ok\(\)/);
});

test("platform client helper clamps page size and forwards cursor", () => {
  assert.match(helper, /Math\.min\(Math\.max\(Math\.trunc\(numeric\), 1\), 100\)/);
  assert.match(helper, /p_cursor_created_at/);
  assert.match(helper, /p_cursor_id/);
  assert.match(helper, /p_search/);
  assert.match(helper, /p_status/);
});

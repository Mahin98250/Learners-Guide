import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("Phase 4G: timetable admin RLS uses statement-cached admin authorization", () => {
  const sql = read("supabase/migrations/20260906103000_phase4g_timetable_rls_initplan_perf.sql");
  assert.match(sql, /create or replace function public\.lg_is_admin\(\)/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function public\.lg_is_admin\(\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.lg_is_admin\(\) to authenticated/i);
  assert.match(sql, /using \(\(select public\.lg_is_admin\(\)\)\)/i);
  assert.match(sql, /with check \(\(select public\.lg_is_admin\(\)\)\)/i);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260921130000_multi_institute_foundation.sql",
  "utf8",
);
const compact = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

test("multi-institute foundation creates the core tenant identity model", () => {
  const sql = compact(migration);
  for (const fragment of [
    "create table if not exists public.institutes",
    "create table if not exists public.people",
    "create table if not exists public.platform_memberships",
    "create table if not exists public.institute_memberships",
    "create table if not exists public.institute_settings",
    "create table if not exists public.institute_domains",
  ]) {
    assert.ok(sql.includes(fragment), `Missing migration fragment: ${fragment}`);
  }
});

test("multi-institute foundation seeds the legacy Learner's Guide tenant and backfills membership", () => {
  const sql = compact(migration);
  assert.match(sql, /learners-guide/);
  assert.match(sql, /from public\.users u/);
  assert.match(sql, /join public\.people p on p\.auth_id = u\.auth_id/);
  assert.match(sql, /public\.institute_memberships/);
});

test("multi-institute foundation stages institute_id across legacy institute-owned tables", () => {
  const sql = compact(migration);
  for (const table of [
    "students",
    "teachers",
    "batches",
    "batch_students",
    "batch_teachers",
    "attendance",
    "homework",
    "materials",
    "fees",
    "tests",
    "test_results",
    "timetable_entries",
  ]) {
    assert.ok(sql.includes(table), `Missing tenant staging reference: ${table}`);
  }
  assert.match(sql, /add column if not exists institute_id uuid references public\.institutes\(id\)/);
});

test("custom-domain resolution is server-side and safe for anonymous branding lookup", () => {
  const sql = compact(migration);
  assert.match(sql, /create or replace function public\.resolve_institute_domain\(p_hostname text\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /status = 'verified'/);
  assert.match(sql, /grant execute on function public\.resolve_institute_domain\(text\) to anon, authenticated/);
});

test("new control-plane tables are protected by RLS during the staged rollout", () => {
  const sql = compact(migration);
  for (const table of [
    "institutes",
    "people",
    "platform_memberships",
    "institute_memberships",
    "institute_settings",
    "institute_domains",
  ]) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security`));
  }
});

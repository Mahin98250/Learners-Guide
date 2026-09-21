import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const migration = fs.readFileSync("supabase/migrations/20260921150000_multi_institute_permissions_and_context.sql","utf8");
const sql = migration.replace(/\s+/g," ").toLowerCase();

test("phase 2 creates permission, role, override and audit foundations",()=>{
  for(const f of [
    "create table if not exists public.permissions",
    "create table if not exists public.institute_roles",
    "create table if not exists public.institute_role_permissions",
    "create table if not exists public.institute_membership_permission_overrides",
    "create table if not exists public.platform_settings",
    "create table if not exists public.audit_logs"
  ]) assert.ok(sql.includes(f),`Missing: ${f}`);
});
test("phase 2 defines the system role set",()=>{
  for(const role of ["institute_owner","institute_admin","academic_admin","teacher","accountant","receptionist","content_manager","student","parent","staff"])
    assert.ok(sql.includes(`'${role}'`),`Missing role: ${role}`);
});
test("permission denies override role grants",()=>{
  assert.ok(sql.includes("and not exists ("));
  assert.ok(sql.includes("o.effect = 'deny'"));
});
test("new institutes can receive the same default roles",()=>{
  assert.ok(sql.includes("create or replace function public.seed_institute_defaults(p_institute_id uuid)"));
  assert.ok(sql.includes("select public.seed_institute_defaults(id) from public.institutes"));
});
test("platform and institute read policies are explicitly present",()=>{
  for(const p of ["create policy institutes_member_read","create policy audit_logs_platform_or_institute_read","create policy institute_domains_platform_read"])
    assert.ok(sql.includes(p),`Missing policy: ${p}`);
});

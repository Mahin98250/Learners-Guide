import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const queries=read("src/lg/data/queries.js");
const cache=read("src/lg/data/cache.ts");
const tenant=read("src/lg/tenant.ts");
const mutations=read("src/lg/data/mutations.js");
const studentPortal=read("src/lg/studentPortal.jsx");
const parentPortal=read("src/lg/parentWorkflows.jsx");
const studentApp=read("src/lg/StudentAppFixed.jsx");
const migration=read("supabase/migrations/20260923000000_phase6_performance_indexes.sql");

test("Phase 6: shared reads are cached per tenant and authenticated user",()=>{
  assert.match(queries,/getReadCacheKey=async/);
  assert.match(queries,/getMemoryCache\(cacheKey\)/);
  assert.match(queries,/inflight\.has\(cacheKey\)/);
  assert.match(queries,/inflight\.set\(cacheKey,request\)/);
  assert.match(cache,/key===scope\|\|key\.startsWith\(\x60\$\{scope\}::\x60\)/);
  assert.match(mutations,/invalidateMemoryCache\(t\)/);
});

test("Phase 6: institute context is request-coalesced and short-lived",()=>{
  assert.match(tenant,/CONTEXT_CACHE_TTL_MS = 5_000/);
  assert.match(tenant,/contextCache/);
  assert.match(tenant,/contextInflight/);
  assert.match(tenant,/getInstituteContextCacheKey/);
  assert.match(tenant,/clearInstituteContextCache/);
  assert.match(tenant,/getSession\(\)/);
});

test("Phase 6: high-volume direct portal reads carry explicit institute filters",()=>{
  assert.match(studentPortal,/from\("attendance"\)[\s\S]*eq\("institute_id", instituteId\)/);
  assert.match(studentPortal,/from\("fees"\)[\s\S]*eq\("institute_id",instituteId\)/);
  assert.match(studentPortal,/from\("announcements"\)[\s\S]*eq\("institute_id",instituteId\)/);
  assert.match(studentPortal,/from\("timetable_entries"\)[\s\S]*eq\("institute_id",instituteId\)/);
  assert.match(parentPortal,/from\("parent_student_links"\)[\s\S]*eq\("institute_id", instituteId\)/);
  assert.match(parentPortal,/from\("students"\)[\s\S]*eq\("institute_id", instituteId\)/);
  assert.match(parentPortal,/from\("batch_students"\)[\s\S]*eq\("institute_id", instituteId\)/);
  assert.match(parentPortal,/from\("test_results"\)[\s\S]*eq\("institute_id", instituteId\)/);
  assert.match(studentApp,/from\("material_folders"\)[\s\S]*eq\("institute_id",instituteId\)/);
  assert.match(studentApp,/from\("materials"\)[\s\S]*eq\("institute_id",instituteId\)/);
  assert.match(studentApp,/from\("homework"\)[\s\S]*eq\("institute_id",instituteId\)/);
});

test("Phase 6: users remains outside tenant-column assumptions",()=>{
  assert.doesNotMatch(queries,/const TENANT_TABLES=new Set\(\[\"students\",\"teachers\",\"users\"/);
  assert.doesNotMatch(mutations,/const TENANT_TABLES=new Set\(\[\"students\",\"teachers\",\"users\"/);
  assert.doesNotMatch(mutations,/users:new Set\([^\n]*institute_id/);
});

test("Phase 6: focused composite indexes cover observed read patterns",()=>{
  for(const name of [
    "idx_notifications_institute_unread_created",
    "idx_material_folders_institute_parent_name",
    "idx_batch_students_institute_student_status",
    "idx_batch_students_institute_batch_status",
    "idx_homework_institute_batch_created",
    "idx_test_results_institute_student_test",
    "idx_attendance_institute_sid_date",
    "idx_timetable_entries_institute_batch_active_day",
    "idx_timetable_entries_institute_teacher_active_day"
  ]) assert.ok(migration.includes(name), "missing "+name);
});

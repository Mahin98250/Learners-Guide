import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const compact = (value) => value.replace(/[\s\uFEFF\u200B-\u200D]+/g, "").toLowerCase();

const helperContracts = [
  ["public.app_role()", "public/role resolution", "supabase/migrations/20260813110052_fix_admin_rls_role_resolution.sql"],
  ["public.current_ref()", "identity/ref resolution", "supabase/migrations/20260811180512_harden_auth_claim_resolution_and_material_name.sql"],
  ["public.current_role()", "role resolution wrapper", "supabase/migrations/20260813110052_fix_admin_rls_role_resolution.sql"],
  ["public.parent_can_access_student(text)", "students/attendance/fees/marks parent scope", "supabase/migrations/20260812115958_stage_s3_s4_parent_relationship_security.sql"],
  ["public.parent_can_access_batch(text)", "timetable/homework/material parent scope", "supabase/migrations/20260812115958_stage_s3_s4_parent_relationship_security.sql"],
  ["public.teacher_can_access_student(text,text)", "students/batch_students/attendance teacher scope", "supabase/migrations/20260812000005_stage_b_t3_t4_teacher_scope.sql"],
  ["public.teacher_can_access_batch(text,text)", "homework/material teacher batch scope", "supabase/migrations/20260812000006_stage_t5_t6_teacher_homework_material_scope.sql"],
  ["public.student_can_access_batch(text,text)", "legacy un-foldered homework/material batch scope", "supabase/migrations/20260812000006_stage_t5_t6_teacher_homework_material_scope.sql"],
  ["public.student_can_access_material(text,text,text)", "legacy un-foldered material scope", "supabase/migrations/20260901094000_teacher_material_read_access.sql"],
  ["public.student_can_access_material_folder(uuid,text)", "legacy folder authorization helper", "supabase/migrations/20260812000007_stage_s1_s2_student_batch_scope.sql"],
  ["public.teacher_can_access_material_class(text)", "legacy teacher material-class helper", "supabase/migrations/20260818140200_lock_down_security_definer_helper_execution.sql"],
  ["public.homework_row_readable(text,text,text,text,text)", "homework RLS read scope", "supabase/migrations/20260812000006_stage_t5_t6_teacher_homework_material_scope.sql"],
  ["public.homework_storage_readable(text)", "homework storage object read policy", "supabase/migrations/20260814191500_fix_homework_storage_and_download_access.sql"],
  ["public.material_row_readable(text,text,text)", "materials RLS read scope", "supabase/migrations/20260812000006_stage_t5_t6_teacher_homework_material_scope.sql"],
  ["public.material_folder_standard_accessible(uuid,text)", "standard-scoped folder RLS read scope", "supabase/migrations/20260815090000_standard_based_material_access.sql"],
];

const executionMigration = "supabase/migrations/20260906123000_phase4a_security_function_execution_hardening.sql";

 test("Phase 4A keeps the complete 15-helper execution contract", () => {
  const sql = compact(read(executionMigration));
  assert.equal(helperContracts.length, 15);

  for (const [signature] of helperContracts) {
    const fn = signature.replaceAll(" ", "");
    assert.match(sql, new RegExp(`revokeexecuteonfunction${fn.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}frompublic,anon;`));
    assert.match(sql, new RegExp(`grantexecuteonfunction${fn.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}toauthenticated;`));
  }
});

test("Phase 4A helper sources retain SECURITY DEFINER intentionally", () => {
  for (const [signature, purpose, file] of helperContracts) {
    const source = compact(read(file));
    const fnName = signature.slice("public.".length).split("(")[0];
    assert.match(source, new RegExp(`createorreplacefunctionpublic\\.?${fnName.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
    assert.match(source, /securitydefiner/, `${fnName} (${purpose}) must remain SECURITY DEFINER unless its authorization graph is redesigned and re-tested`);
  }
});

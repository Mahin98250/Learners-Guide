import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const compact = (value) => value.replace(/[\s\uFEFF\u200B-\u200D]+/g, "").toLowerCase();
const regexEscape = (value) => value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

const activeHelpers = [
  "public.app_role()",
  "public.current_ref()",
  "public.current_role()",
  "public.parent_can_access_student(text)",
  "public.parent_can_access_batch(text)",
  "public.teacher_can_access_student(text,text)",
  "public.teacher_can_access_batch(text,text)",
  "public.student_can_access_batch(text,text)",
  "public.student_can_access_material(text,text,text)",
  "public.homework_row_readable(text,text,text,text,text)",
  "public.homework_storage_readable(text)",
  "public.material_row_readable(text,text,text)",
  "public.material_folder_standard_accessible(uuid,text)",
];

const legacyHelpers = [
  "public.student_can_access_material_folder(uuid,text)",
  "public.teacher_can_access_material_class(text)",
];

const executionMigration = "supabase/migrations/20260906123000_phase4a_security_function_execution_hardening.sql";
const sql = compact(read(executionMigration));

for (const signature of [...activeHelpers, ...legacyHelpers]) {
  assert.match(sql, new RegExp(`revoke(?:all|execute)onfunction${regexEscape(signature)}frompublic,anon`));
}

test("Phase 4A keeps authenticated EXECUTE for all 13 active RLS/storage helpers", () => {
  assert.equal(activeHelpers.length, 13);
  for (const signature of activeHelpers) {
    assert.match(sql, new RegExp(`grantexecuteonfunction${regexEscape(signature)}toauthenticated;`));
  }
});

test("Phase 4A removes authenticated EXECUTE from the two legacy helpers", () => {
  for (const signature of legacyHelpers) {
    assert.match(sql, new RegExp(`revokeallexecuteonfunction${regexEscape(signature)}frompublic,anon,authenticated;`));
    assert.doesNotMatch(sql, new RegExp(`grantexecuteonfunction${regexEscape(signature)}toauthenticated;`));
  }
});

test("Phase 4A migration contains in-database privilege verification", () => {
  assert.match(sql, /dodeclare/);
  assert.match(sql, /to_regprocedure\(helper\)/);
  assert.match(sql, /has_function_privilege\('authenticated'/);
  assert.match(sql, /has_function_privilege\('anon'/);
});

test("Current schema source still contains the active helper authorization graph", () => {
  const source = compact([
    read("supabase/migrations/20260813110052_fix_admin_rls_role_resolution.sql"),
    read("supabase/migrations/20260811180512_harden_auth_claim_resolution_and_material_name.sql"),
    read("supabase/migrations/20260812115958_stage_s3_s4_parent_relationship_security.sql"),
    read("supabase/migrations/20260812000005_stage_b_t3_t4_teacher_scope.sql"),
    read("supabase/migrations/20260812000006_stage_t5_t6_teacher_homework_material_scope.sql"),
    read("supabase/migrations/20260901094000_teacher_material_read_access.sql"),
    read("supabase/migrations/20260814191500_fix_homework_storage_and_download_access.sql"),
    read("supabase/migrations/20260815090000_standard_based_material_access.sql"),
    read("supabase/migrations/20260901093000_teacher_material_folder_management.sql"),
  ].join("\n"));

  for (const signature of activeHelpers) {
    const fnName = signature.slice("public.".length).split("(")[0];
    assert.match(source, new RegExp(regexEscape(fnName)));
  }
});

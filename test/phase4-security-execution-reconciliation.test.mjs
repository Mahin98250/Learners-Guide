import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const sql=read("supabase/migrations/20260908110000_phase4_security_execution_reconciliation.sql");
const compact=(s)=>s.replace(/\s+/g," ").trim();

const expected=[
  "revoke all on function public.student_can_access_material_folder(uuid, text) from public, anon, authenticated;",
  "revoke all on function public.teacher_can_access_material_class(text) from public, anon, authenticated;",
  "if has_function_privilege('authenticated', 'public.student_can_access_material_folder(uuid,text)', 'EXECUTE') then",
  "if has_function_privilege('authenticated', 'public.teacher_can_access_material_class(text)', 'EXECUTE') then",
];
for(const fragment of expected)assert.ok(compact(sql).includes(compact(fragment)),`Missing security reconciliation contract: ${fragment}`);

const executionFn=read("supabase/migrations/20260906123000_phase4a_security_function_execution_hardening.sql");
assert.ok(compact(executionFn).includes(compact("grant execute on function public.app_role() to authenticated;")));
assert.ok(compact(executionFn).includes(compact("revoke execute on function public.app_role() from public, anon;")));
console.log("Phase 4 Security Execution Reconciliation Contract: PASS");

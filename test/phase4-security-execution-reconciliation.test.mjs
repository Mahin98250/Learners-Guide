import assert from "node:assert/strict";
import fs from "node:fs";
const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const sql=read("supabase/migrations/20260908110000_phase4_security_execution_reconciliation.sql");
const compact=(s)=>s.replace(/\s+/g," ").trim();
for(const fragment of [
  "revoke all on function public.student_can_access_material_folder(uuid, text) from public, anon, authenticated;",
  "revoke all on function public.teacher_can_access_material_class(text) from public, anon, authenticated;",
  "has_function_privilege('authenticated', 'public.student_can_access_material_folder(uuid,text)', 'EXECUTE')",
  "has_function_privilege('authenticated', 'public.teacher_can_access_material_class(text)', 'EXECUTE')",
]) assert.ok(compact(sql).includes(compact(fragment)),`Missing security reconciliation contract: ${fragment}`);
console.log("Phase 4 Security Execution Reconciliation Contract: PASS");

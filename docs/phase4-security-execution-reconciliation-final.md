# Phase 4 — Security Execution Reconciliation

Live Supabase inspection found two historical SECURITY DEFINER helpers still executable by `authenticated`: `student_can_access_material_folder(uuid,text)` and `teacher_can_access_material_class(text)`. A direct `pg_policies` search found no active RLS predicate or `WITH CHECK` reference to either helper.

This phase revokes API execution from `public`, `anon`, and `authenticated` for those two legacy helpers while keeping their bodies intact for compatibility. Active RLS helpers are left unchanged.

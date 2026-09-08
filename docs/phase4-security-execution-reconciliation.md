# Phase 4 — Security Execution Reconciliation

Date: 2026-09-08

Live Supabase inspection found that two historical SECURITY DEFINER helpers still had EXECUTE granted to authenticated users: `student_can_access_material_folder(uuid,text)` and `teacher_can_access_material_class(text)`. A live policy search found no current RLS predicate or WITH CHECK dependency on either helper.

The migration in this phase keeps both function bodies intact for compatibility, but revokes API execution from public, anon, and authenticated and verifies that contract in-database. Active authorization helpers remain unchanged.

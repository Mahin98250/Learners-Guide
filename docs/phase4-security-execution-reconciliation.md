# Phase 4 — Security Execution Reconciliation

Date: 2026-09-08

## Finding

Live Supabase inspection confirmed that public tables currently have no `anon` table grants, but two historical `SECURITY DEFINER` helpers still had `EXECUTE` granted to `authenticated`:

- `student_can_access_material_folder(uuid,text)`
- `teacher_can_access_material_class(text)`

A live `pg_policies` search found no current RLS policy predicate or `WITH CHECK` expression referencing either helper. Their function bodies remain in the database for compatibility, but they are not part of the active authorization graph.

## Change

A reconciliation migration revokes `EXECUTE` from `public`, `anon`, and `authenticated` for both legacy helpers and verifies the resulting privilege state inside the database.

The active RLS helpers remain unchanged. The existing Phase 4A contract keeps their API execution boundary at `authenticated` only because those helpers are still part of the live authorization graph.

## Safety gate

This change is intentionally limited to execution privileges. It does not change function bodies, RLS predicates, table data, or portal behavior.

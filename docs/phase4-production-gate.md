# Phase 4 — Production Regression Gate

Date: 2026-09-01

## Goal

Production changes must preserve portal behavior while keeping Supabase as the authoritative source of application data.

## Data-source contract

- Supabase is the source of truth for students, teachers, users, batches, memberships, timetable, attendance, homework, materials, tests, test results, exams, fees, notifications and parent links.
- `localStorage` is cache/offline support only; it must never be treated as authoritative application data.
- Successful writes must be confirmed by the Supabase response before local cache state is updated.
- RLS and role-scoped database policies remain the authorization boundary.

## Lifecycle regression guard

When a mobile browser restores the app from a frozen/BFCache snapshot, the app:

1. re-checks the authenticated session;
2. clears the non-authoritative local cache;
3. remounts the active portal;
4. allows each portal section to perform its normal Supabase reads again;
5. preserves the existing role and route instead of mixing stale UI state.

Implemented in `src/routes/app.tsx` with a scoped `portalRefreshKey`. This does not run during ordinary in-app navigation.

## Database safety checks performed

Production currently reports `ACTIVE_HEALTHY` on PostgreSQL 17.6.1.084.

The verified baseline includes:

- 3 `tests` rows and 3 `examschedule` rows;
- 41 `materials` rows and 22 `material_folders` rows;
- 10 `batch_students` rows;
- 3 `timetable_entries` rows;
- 20 `test_results` rows;
- 10 `parent_student_links` rows;
- 25 `attendance` rows, with zero null IDs/SIDs and no duplicate `(sid,date,status)` groups at the time of verification.

No data rows were deleted or rewritten by Phase 4E hardening.

## Security hardening

- Removed the unused `pg_graphql` extension from production. The application contains no GraphQL client usage.
- Disabled automatic `EXECUTE` grants for future public-schema functions for `anon`, `authenticated`, and `public`.
- Disabled automatic table DML grants to `anon` for future public-schema tables.
- Existing authenticated grants and RLS helper execution were deliberately preserved because current policies depend on them. Blindly revoking these helpers previously caused portal 403 regressions.

## Release gate

A release is not considered production-ready until:

- typecheck passes;
- production build passes;
- deployment status is successful;
- Student, Teacher and Parent routes load after a fresh sign-in;
- returning from another browser tab does not produce crushed/mismatched layout;
- tests and exams are rendered from their canonical tables without duplicate UI aggregation;
- study-material folders and PDFs remain readable/downloadable;
- attendance writes succeed and persist to Supabase;
- notifications and realtime updates continue to work;
- logout clears cached data and protected routes redirect to login;
- no new high-severity Supabase advisor finding is introduced.

The remaining Supabase warnings are limited to intentionally exposed `SECURITY DEFINER` authorization helpers and the Auth leaked-password-protection setting. Those helpers are referenced directly by RLS policies and must be migrated to a non-exposed schema only as a coordinated policy migration, not by removing `EXECUTE` in isolation.

# Phase 5 — Full App Stability & Feature Verification

**Date:** 2026-09-06  
**Scope:** Student, Parent, Teacher, Admin portals; Supabase data integrity/RLS; CI/deployment; retired Messages UI.

## Verified automatically

- Latest `main` commit `260c6eb2110fca756c25c3dbe0d7a20fb4128108` has green GitHub CI and Production Check.
- CI passed production contract checks, audit regression tests, ESLint, TypeScript typecheck, production build, and changed-file formatting.
- Production Check passed typecheck and production bundle build.
- Live Supabase public tables all have RLS enabled.
- Live table grants are limited to `authenticated`; no `anon` table grants were returned.
- The 21 inspected foreign-key relationships currently have zero orphan rows.
- No duplicate groups were found for batch-student memberships, batch-teacher assignments, subject names, or active timetable slots.
- Live timetable contains three active entries for the current batch, each carrying `subject_names = ['English','Social Studies']` and the backwards-compatible combined `subject_name`.
- Core role policies remain scoped: admin mutations on management tables, student/parent/teacher reads constrained by profile, batch, membership, or ownership rules.
- Retired Messages UI remains suppressed in Student/Teacher/Parent shared AppBars while notification controls remain enabled.
- Phase 5 regression contracts were added in `test/phase5-stability-contract.test.mjs`.

## Important live data observation

`academic_years` currently contains zero rows. Existing `batches` and `timetable_entries` do not currently require a non-null academic-year row, so this is not blocking the active timetable path. It should be populated before introducing workflows that require an explicit academic-year selector or constraint.

## Browser-only acceptance still required

The repository and database tooling cannot provide a real authenticated browser session for this project. Final release acceptance therefore still needs human/browser verification of:

- Student login and dashboard navigation.
- Parent linked-child navigation.
- Teacher dashboard and teacher-scoped actions.
- Admin CRUD click-through, especially timetable edit/delete.
- Student/Parent timetable display showing both English and Social Studies.
- Refresh/re-login persistence.
- Negative-access tests using separate real accounts.
- Real material download and push-notification behavior where device/browser APIs are involved.

These items are intentionally marked unverified rather than being claimed as passed.

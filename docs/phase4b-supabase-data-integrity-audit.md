# Phase 4B — Supabase / Data-Integrity Audit

Date: 2026-09-01
Project: Learner's Guide (`efnxjfzyqbdulpjhffsm`)
Status: Complete — audit findings recorded; no destructive data changes made.

## 1. Database baseline

The production Supabase project is `Learner's Guide`, region `ap-northeast-1`, PostgreSQL 17.6.1.084, and currently reports `ACTIVE_HEALTHY`.

All inspected application tables in `public` have RLS enabled.

Key current row counts:

| Area | Rows |
| --- | ---: |
| users | 25 |
| students | 10 |
| teachers | 1 |
| batches | 1 |
| batch_students | 10 |
| batch_teachers | 1 |
| timetable_entries | 3 |
| attendance | 15 |
| homework | 0 |
| materials | 41 |
| material_folders | 22 |
| examschedule | 3 |
| tests | 3 |
| test_results | 20 |
| fees | 1 |
| parent_student_links | 10 |
| notifications | 325 |

## 2. Duplicate-data checks

No duplicate groups were found for:

- attendance by student/date/status
- tests by batch/title/subject/date/marks
- exam schedules by title/subject/class/section/date
- student SID
- parent/student relationship keys
- batch/student relationship keys
- test_result test/student pairs
- duplicate timetable rows using the same batch/teacher/subject/day/time signature

The database itself therefore does **not** contain the previously observed six-test duplication. The production database currently contains exactly 3 rows in `tests` and 3 rows in `examschedule`. UI aggregation between those sources remains a separate application-layer concern.

## 3. Referential-integrity checks

No orphan rows were found for:

- batch_students → students
- batch_teachers → teachers
- timetable_entries → batches
- timetable_entries → teachers
- tests → batches
- test_results → tests
- test_results → students
- materials → material_folders
- parent_student_links → students
- fees → students
- attendance → students

The schema also contains explicit primary keys, unique constraints, and foreign keys for these relationships.

## 4. Student/batch consistency

All 10 active students currently have exactly one active batch membership with `left_at IS NULL`.

No active student had a class/section mismatch with the active batch relationship.

## 5. Business-rule validation

No invalid records were found for:

- attendance status
- negative test marks
- test marks greater than total marks
- test status
- fee status
- batch membership status
- batch teacher status
- timetable start/end times

## 6. Study Materials integrity

There are 22 folders and 41 material rows.

No orphaned folder references or self-parent folder cycles were found. Every material assigned to a folder currently points to an existing folder, and every checked folder has non-empty `access_standards`.

The material hierarchy contains repeated subject names under different parent folders, which is valid hierarchical data and not itself duplication.

## 7. Canonical data relationships

The current schema strongly favors these canonical relationships:

`students → batch_students → batches`

`batches → timetable_entries`

`batches → tests → test_results`

`students → attendance`

`students → fees`

`students ↔ parent_student_links ↔ auth.users`

`material_folders → materials`

Those relationships are backed by foreign keys and should remain the application's source of truth.

## 8. Important security finding for Phase 4C

The Supabase Security Advisor currently reports WARN findings for many `public` relations being visible to the `authenticated` role through pg_graphql introspection, plus many `SECURITY DEFINER` functions executable by `authenticated`.

The most important observation is that many of the executable helper functions are owned by `postgres`, including access-control helpers such as:

- `app_role()`
- `current_ref()`
- `current_role()`
- `student_can_access_batch(...)`
- `student_can_access_material(...)`
- `student_can_access_material_folder(...)`
- `teacher_can_access_batch(...)`
- `teacher_can_access_student(...)`
- `parent_can_access_batch(...)`
- `parent_can_access_student(...)`
- `get_student_tests()`
- `get_student_test_results()`

These should **not** be revoked or converted blindly because current application policies depend on several of them. Previous project history shows an earlier permission hardening caused production 403 failures. Phase 4C must map each function to its callers/policies before changing grants or security-definer behavior.

Supabase's current guidance confirms that exposed `SECURITY DEFINER` functions should only remain callable by authenticated users when that exposure is deliberate and the function validates inputs; otherwise `EXECUTE` should be revoked or the function moved to a non-exposed schema. RLS remains the row-level authorization boundary for direct table access.

## 9. Anonymous privilege observation

The database currently has broad legacy `anon` table privileges on a subset of administrative/relationship tables. This is a security concern even though RLS is enabled. It must be reviewed in Phase 4C against actual application requirements before revocation.

## 10. Action taken in Phase 4B

No rows were deleted, modified, or backfilled.

No schema migrations were applied.

The purpose of this phase was to establish a verified data-integrity baseline and identify safe, evidence-based candidates for the security phase without repeating the previous RLS/permission regression.

## 11. Acceptance criteria

Phase 4B is considered complete because:

- production Supabase project was inspected directly;
- tables, keys, relationships, and row counts were verified;
- duplicate and orphan scans returned zero findings for the tested invariants;
- student/batch consistency was verified;
- test-result integrity was verified;
- study-material folder references and access metadata were checked;
- security-advisor findings were captured for Phase 4C;
- no destructive database changes were introduced.

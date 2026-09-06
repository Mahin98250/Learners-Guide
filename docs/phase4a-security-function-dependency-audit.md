# Learner's Guide — Phase 4A Security Function Dependency Audit

Date: 2026-09-06
Scope: the 15 SECURITY DEFINER/RLS helpers carried in the current RLS execution contract.

## Decision summary

The safe execution boundary is **authenticated only** for 13 active helpers. These helpers are referenced by current RLS/storage policies and therefore must retain authenticated EXECUTE.

Two helpers are legacy-only and have no current portal policy dependency found in the repository search: `student_can_access_material_folder(...)` and `teacher_can_access_material_class(...)`. Their authenticated EXECUTE is removed. Their function bodies are left intact so this security change does not alter schema behavior or historical migration compatibility.

The 13 active helpers remain SECURITY DEFINER because their authorization graph reads protected tables or `auth.users` while being evaluated from RLS/storage policy predicates. Changing them to SECURITY INVOKER would require a separate authorization redesign and role-by-role regression test.

## Function-to-policy dependency map

| Function | Current dependency | Portal coverage | SECURITY DEFINER | API EXECUTE |
| --- | --- | --- | --- | --- |
| `app_role()` | Admin/role checks across batches, timetable, memberships, students, attendance, materials/folders, announcements and other role-aware policies | Admin, Teacher, Student, Parent | Yes | authenticated only |
| `current_ref()` | Identity/ref checks in student/teacher/parent policy predicates and folder management | Admin-adjacent identity plumbing, Teacher, Student, Parent | Yes | authenticated only |
| `current_role()` | Legacy/current teacher/student/attendance policy role checks; delegates to `app_role()` | Teacher plus shared policy paths | Yes | authenticated only |
| `parent_can_access_student(text)` | `students_parent_linked_read`, `batch_students_parent_linked_read`, `attendance_parent_linked_read`, `fees_parent_linked_read`, `marks_parent_linked_read`; also used by `parent_can_access_batch` | Parent | Yes | authenticated only |
| `parent_can_access_batch(text)` | Parent timetable/homework/material scope policies | Parent | Yes | authenticated only |
| `teacher_can_access_student(text,text)` | `batch_students_teacher_read`, `students_select`, `attendance_read`, scoped attendance writes | Teacher | Yes | authenticated only |
| `teacher_can_access_batch(text,text)` | Homework/material reads and teacher-scoped inserts/updates/deletes; legacy material read path | Teacher | Yes | authenticated only |
| `student_can_access_batch(text,text)` | Legacy un-foldered homework/material read authorization | Student/Parent | Yes | authenticated only |
| `student_can_access_material(text,text,text)` | `materials_select_authenticated` for un-foldered legacy materials | Student/Parent | Yes | authenticated only |
| `student_can_access_material_folder(uuid,text)` | Historical folder-tree policy path; current standard-scoped folder policy uses `material_folder_standard_accessible` instead | No current portal dependency found | N/A for active path | revoked for all API roles |
| `teacher_can_access_material_class(text)` | Historical teacher material-class helper; current policy uses `teacher_material_folder_accessible` / `teacher_can_access_batch` | No current portal dependency found | N/A for active path | revoked for all API roles |
| `homework_row_readable(text,text,text,text,text)` | `homework_read` RLS predicate | Admin, Teacher, Student, Parent | Yes | authenticated only |
| `homework_storage_readable(text)` | `homework_storage_read` on `storage.objects` | Admin, Teacher, Student, Parent | Yes | authenticated only |
| `material_row_readable(text,text,text)` | Homework/material legacy teacher/student/parent read paths and storage material reads | Teacher, Student, Parent | Yes | authenticated only |
| `material_folder_standard_accessible(uuid,text)` | `material_folders_authorized_read`/current `material_folders_select` and folder-based `materials` read policy | Student, Parent | Yes | authenticated only |

## Why the 13 active helpers stay SECURITY DEFINER

`app_role()` and `current_ref()` read `auth.users` and role/ref metadata that normal application roles should not directly traverse. The access helpers then walk authorization relationships such as parent-to-student, teacher-to-batch, batch-to-student, material folders, and homework/material ownership while being called from RLS predicates. SECURITY DEFINER keeps those authorization checks from recursively depending on the same caller-facing RLS boundaries.

`current_role()` is kept consistent with the existing role-resolution contract rather than being changed independently during this hardening pass. This avoids repeating the earlier authenticated-EXECUTE regression while preserving the current policy graph.

## API execution hardening applied

The new Phase 4A migration:

1. Revokes `EXECUTE` from `public` and `anon` for all 13 active helpers.
2. Re-grants `EXECUTE` only to `authenticated` for those 13 helpers.
3. Fully revokes `EXECUTE` from `public`, `anon`, and `authenticated` for the two legacy helpers with no current portal dependency.
4. Runs an in-database post-change verification block that asserts function existence and the expected authenticated/anonymous execution contract.

## Regression protection

`test/security-function-contract.test.mjs` is added to CI via the existing `npm test` script. It checks that:

- all 15 helpers remain accounted for;
- all 13 active helpers retain authenticated execution and lose anonymous/public execution;
- the two legacy helpers remain fully API-restricted;
- the migration contains database-side privilege verification; and
- the repository still contains the active authorization graph for the 13 helpers.

This is a source-level guard, not a substitute for real authenticated browser testing. Final portal acceptance must still exercise Admin, Teacher, Student, and Parent sessions in the deployed environment.

## Deployment gate

Do not treat the Phase 4A change as fully production-accepted until the migration has applied successfully and the four-role smoke test confirms login, navigation, reads, scoped writes, homework/material access, downloads, and logout behavior.

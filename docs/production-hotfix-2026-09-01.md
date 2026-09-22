# Production Hotfix — 2026-09-01

## Scope
Four-portal production stabilization: Admin, Teacher, Student, Parent.

## Active architecture reviewed
- `/app` routes authenticated Teacher, Student and Parent users.
- `/admin` is the dedicated authenticated Admin route.
- Student currently uses `StudentApp` re-exported from `StudentAppFixed`.
- Parent currently uses `ParentApp` from `parentWorkflows.jsx`.
- Teacher currently uses `TeacherAppWithHomeworkFiles`.
- Admin currently uses `AdminWithDrive` through the dedicated `/admin` route.

## High-confidence root causes addressed

The recent mobile regressions were caused by responsive rules acting on shell structure too broadly and by browser/PWA restoration interacting with a brittle layout boundary. The stable architecture is a single mobile Shell with a header, scrollable content viewport, and bottom navigation.

The current responsive foundation now keeps the shell fluid, prevents horizontal overflow, and avoids rewriting arbitrary descendant flex containers. Student, Teacher and Parent mobile content receives bottom clearance for a viewport-fixed navigation bar.

## Parent portal improvements

- compact mobile header boundary;
- continuous indigo/lilac background with restrained depth;
- readable hierarchy and spacing;
- constrained KPI/action cards;
- safe text wrapping;
- viewport-fixed bottom navigation with safe-area support;
- bottom content clearance so the last item is reachable;
- scoped CSS so Parent styling does not leak into other portals.

The real Mahin logo remains owned by the shared `LGLogo` implementation.

## Admin lifecycle fix

The dedicated `/admin` route now re-checks the current authenticated admin session after a browser visibility/focus restore when the session has not been synchronized recently. This avoids leaving a stale admin session snapshot after returning from another app or tab.

## PWA/cache fix

Service-worker cache generation is now `mahin-v33`. JavaScript and CSS continue to prefer fresh network assets when online, while Supabase REST/Auth/Functions requests are not handled by the static asset cache path. The cache generation bump forces devices that still hold the previous PWA shell/assets to activate the current production bundle.

## Student assessment integrity fix

Student exams/tests now use a normalized assessment key based on title, subject, and date. Matching schedule copies are suppressed in favor of the batch-scoped `tests` record, and repeated test rows with the same assessment key are rendered once. This keeps the student-facing list aligned with the authoritative batch test data without changing database records.

## Supabase/data boundary

No destructive database or schema changes were made in this hotfix. Supabase remains the source of truth for authenticated data.

Earlier Phase 4B checks verified clean key relationships and counts for the current project, including 10 students, 1 teacher, 1 batch, 10 active student memberships, 1 batch-teacher relationship, 3 timetable entries, 15 attendance rows, 3 tests, 20 test results, 41 materials, 1 fee row, and 10 active parent-student links.

## Deployment verification

The latest changes are pushed directly to `main` and trigger both repository CI and the production-check workflow. The repository CI run for the assessment-integrity change completed successfully, including changed-file formatting, TypeScript typecheck, and production build.

## Final acceptance boundary

Repository and deployment checks cannot substitute for real-device acceptance. Before client handoff, test all four roles on a real Android/iOS device and desktop browser:

- switch to another app/tab and return;
- refresh and restore an existing tab;
- verify zero unintended horizontal scrolling;
- verify bottom navigation remains fixed for mobile portals;
- verify long study-material names and download actions;
- verify Student exams do not duplicate presentation rows;
- verify Parent Home, Attendance, Homework, Results, More, Classes, Tests, Materials, Fees;
- verify Teacher dashboard, attendance, homework/material workflows;
- verify Admin dashboard and management pages;
- verify login/logout/session restoration.

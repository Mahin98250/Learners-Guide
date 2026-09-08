# Learner's Guide — Phase 2 Student Production Completion

**Date:** 2026-09-08
**Status:** In progress

## Scope

Phase 2 completes the Student production portal using Supabase as the source of truth while preserving the product decision that Messages, Marks Overview, Student Results, and AI Chat remain retired/disabled.

The existing Phase 2 baseline covers announcements/news, timetable, attendance, homework, study materials, upcoming exams, fees, and notifications.

## Findings at Phase 2 kickoff

1. A Student announcements component existed but was not wired into the canonical Student experience.
2. The existing announcements query hard-coded a small target list, which could omit valid batch-targeted announcements. Audience visibility should remain an RLS responsibility rather than being reimplemented in the client.
3. `FEATURE_FLAGS.studentResults` was inconsistent with the documented product decision and was set to `true` in the repository.
4. Student timetable loading already uses the shared Supabase-backed timetable loader and active batch membership.
5. Student homework/materials/exams flows already use Supabase and have empty/error states; remaining acceptance work is verification rather than broad rewrites.

## Implemented

- Added `StudentAnnouncements` as a dedicated Student announcements/news view.
- The announcements view loads through the existing RLS boundary instead of client-side target authorization rules.
- Added loading, empty, and error states.
- Added an Announcements & News entry from the Student home experience.
- Corrected `FEATURE_FLAGS.studentResults` to `false` so the documented retired feature remains disabled.
- Added Phase 2 source-level regression contracts.

## Remaining Phase 2 gate

- Verify Student login and refresh/re-login persistence in the deployed environment.
- Verify timetable is limited to the active Student batch/class/section.
- Verify attendance and fees are limited to the authenticated Student.
- Verify homework and materials remain batch/class/section scoped.
- Verify upcoming exams are limited to the Student class/section.
- Verify announcements include valid batch-targeted rows and exclude unauthorized audiences.
- Verify notifications are scoped to the authenticated user.
- Verify material download behavior.
- Verify Student A cannot access Student B data.
- Run CI, Production Check, typecheck, lint, and production build.

## Safety rules

- No profile-photo work.
- No database reset or destructive data changes.
- No reintroduction of retired Messages, Marks Overview, Student Results, or AI Chat.
- No localStorage-only replacement for Supabase-backed production data.
- No broad refactor of legacy Student/Parent implementations.

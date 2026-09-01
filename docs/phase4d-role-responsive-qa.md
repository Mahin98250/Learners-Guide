# Phase 4D — Role-by-Role Responsive & Production QA

Date: 2026-09-01
Repository: Mahin98250/Learners-Guide

## Objective

Validate the production application against the active shell contract across Student, Teacher, Parent, and Admin without changing the authoritative Supabase data model.

## QA contract

Every mobile portal must satisfy all of the following:

- use the available viewport width;
- never create unintended horizontal scrolling;
- keep the shared header visually bounded;
- keep fixed bottom navigation inside the viewport and reserve content clearance;
- remain stable after browser back/forward, refresh, tab switch, app switch, visibility restore, and reopening an existing tab;
- preserve the real Learner's Guide logo from the shared `LGLogo` implementation;
- wrap long titles, PDF names, notes, and labels instead of widening the page;
- keep primary actions reachable without clipping;
- render authoritative Supabase data once, without presentation-level duplication;
- show actionable error states instead of blank/Vercel fallback screens.

## Student matrix

### Home
- profile/header alignment;
- today's schedule;
- notification/install prompts do not cover content;
- bottom navigation fixed;
- return-from-other-tab lifecycle.

### Schedule
- all weekdays readable;
- no timetable card overflow;
- current-day emphasis;
- bottom content reachable.

### Materials
- folder tree loads from Supabase;
- long material names wrap within the card;
- View and Download remain reachable;
- final material card is fully visible above navigation;
- no horizontal scrolling.

### Exams / Tests
- authoritative tests render once;
- schedule copies do not create duplicate presentation rows;
- dates, totals, and notes remain readable;
- results remain tied to the correct assessment.

### Attendance / Homework / Fees / Results
- data loads after navigation and refresh;
- no stale role/layout state after returning from another tab;
- empty/error/loading states are bounded and readable.

## Teacher matrix

### Dashboard / Schedule
- assigned timetable only;
- active batch/subject scope preserved;
- no layout collapse on narrow devices.

### Attendance
- attendance opens only for an active scheduled lecture;
- student list is scoped to the active batch;
- Present / Absent / Leave controls stay within the card;
- Save persists to Supabase;
- refresh shows the saved state;
- attendance primary-key generation is database-backed (`gen_random_uuid()`) with the browser UUID retained only as compatibility fallback.

### Homework / Materials
- teacher scope is enforced;
- study-material folders and files load;
- upload/read/download actions remain reachable;
- long file names wrap;
- storage failures show an actionable error.

## Parent matrix

- simple Home overview;
- linked child selection;
- Attendance, Homework, Results, Classes, Tests, Materials, Fees and More all use the linked student scope;
- no parent CSS leaks into other portals;
- bottom navigation and safe-area spacing remain correct;
- return-from-other-app/tab does not produce a split or crushed layout.

## Admin matrix

- `/admin` remains a dedicated authenticated route;
- session is rechecked after visibility/focus restoration when stale;
- dashboard, students, teachers, batches, attendance, homework, exams, materials, announcements, accounts and search load within the admin shell;
- RLS failures are surfaced as actionable errors rather than silent empty states.

## Data integrity checks

Current production baseline from the Phase 4B audit:

- 10 students;
- 1 teacher;
- 1 batch;
- 10 active student memberships;
- 1 batch-teacher relationship;
- 3 timetable entries;
- 15 attendance rows;
- 3 tests;
- 20 test results;
- 41 materials;
- 1 fee row;
- 10 active parent-student links.

The attendance table now has a database default of `gen_random_uuid()` for its non-null primary key. This prevents future attendance writers from depending on a browser-generated ID.

## Production acceptance sequence

1. Login as each role.
2. Open every primary navigation destination.
3. Refresh while a destination is open.
4. Switch to another browser tab/app and return.
5. Use browser back/forward where supported.
6. Resize desktop browser through narrow mobile widths.
7. Verify zero unintended horizontal scrolling.
8. Verify the last scrollable item is fully reachable above fixed navigation.
9. Verify long content wraps rather than widening the page.
10. Verify mutations persist after refresh.
11. Verify duplicate-looking records are not duplicated by presentation logic.
12. Check production build/typecheck/lint before release.

## Known boundary

Repository inspection and Supabase checks can validate architecture, schema, policies, and code paths. Real Android/iOS acceptance still requires a real device/browser session with representative Student, Teacher, Parent, and Admin accounts.

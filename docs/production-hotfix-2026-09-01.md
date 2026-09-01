# Production Hotfix — 2026-09-01

## Scope
Four-portal production stabilization: Admin, Teacher, Student, Parent.

## Root cause found
The previous mobile recovery CSS used structural selectors under `.portal-parent` as if the portal content element were the shared application shell. This caused the parent hero/grid children to be treated as shell header/content/navigation, producing collapsed cards, clipped text, and mixed layouts after restoring a browser tab. A second global rule also forced widths onto every direct child of the shell during mobile recovery.

## Fixes applied
- Replaced the global mobile recovery rules with a narrow shell-only contract.
- Removed broad descendant width/min-width overrides that could distort Student, Teacher, Parent, or Admin layouts.
- Rebuilt the Parent visual layer with safe, role-scoped selectors.
- Added a continuous indigo/lilac page background for Parent.
- Redesigned the Parent dashboard hero, KPI cards, shortcuts, panels, and spacing.
- Reduced the Parent mobile header height while retaining the real Learner's Guide logo/AppBar.
- Made Parent bottom navigation viewport-fixed and added content clearance for it.
- Added safe responsive rules for narrow phones and desktop layouts.

## Supabase baseline
Live project: `efnxjfzyqbdulpjhffsm`.

Current verified counts include 10 students, 1 teacher, 1 batch, 10 active batch-student relationships, 1 batch-teacher relationship, 3 timetable entries, 15 attendance rows, 3 tests, 20 test results, 41 materials, 1 fee row, and 10 parent-student links.

The live database has RLS policies covering the four role scopes. No destructive data changes or schema changes were made in this hotfix.

## Verification status
- Vercel deployment for the hotfix commit completed successfully.
- Browser/device role acceptance is still required for final release sign-off because authenticated four-role UI interactions cannot be fully simulated through repository/database tooling alone.

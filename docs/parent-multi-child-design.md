# Parent multi-child design

## Decision

Use one parent account with many active `parent_student_links`. The parent selects one child as the active context; every child-specific page is filtered to that child. A parent must not need a separate login for each child.

## Parent experience

- One login for the parent.
- Show all active linked children.
- Select one child as the active child.
- Show the selected child's class, section and Student ID.
- Keep Home, Attendance, Homework, Results, Tests, Classes/Timetable, Fees and Analytics scoped to the selected child.
- Switching child changes the active context without logging out.
- With more than one child, show the child switcher; with one child, keep the experience simple.
- If there are no active links, show a clear empty state.

## Data isolation

- Load active links for the authenticated parent account.
- Treat the resulting student IDs as the allowed child set.
- Use RLS as the final authorization boundary; UI filtering is not a security boundary.
- Never combine two children's attendance, fees, results, homework, tests, timetable or analytics into a child-specific view.
- Child-specific notifications/announcements must follow the same parent-child authorization rules.

## Multiple children

Example: Parent A -> Student A and Student B. The parent sees both children in the selector. Student A's dashboard contains only Student A data; switching to Student B replaces that context with Student B data.

## Parent relationship lifecycle

- Adding another child adds another active link; no second parent account is needed.
- Removing a relationship should make the link inactive rather than requiring historical student records to be deleted.
- The same student may be linked to more than one parent account when the institute permits it.

## Current implementation status

The active parent route already implements the core multi-child model: it reads active `parent_student_links`, loads all linked student IDs, keeps `selectedId`, exposes a selector when there are multiple children, and derives child-scoped attendance, fees, results, homework, tests and timetable. This document records the intended contract so future changes do not regress it.

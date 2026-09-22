# Mahin — full web app build

Rebuild the Claude artifact as a real multi-page app: three role apps (Teacher, Student, Parent), the same purple-gradient mobile UI, logo, animations, bottom tab bars, and every screen that exists today.

## What gets built

**Auth (secure, replacing the plain-text `users` table login)**
- Public role picker (Teacher / Student / Parent) then login / signup, same visual design.
- Real accounts with hashed passwords managed by the auth service. Signup collects name, phone and password; a `profiles` table stores name, phone, role and class/section and links to the student or teacher record.
- Roles live in a separate `user_roles` table (never on the profile) and are enforced by database policies.
- Session persists across reloads; sign-out clears it. Existing artifact passwords cannot carry over, so accounts are re-created on first signup.

**Teacher app** — Home (today's classes), Schedule, Attendance (mark per student), Homework (create/assign with PDF attachment), Materials/Notes (upload plus PDF viewer), Marks (enter and edit), Analytics (bar charts).

**Student app** — Home, Timetable, Homework, Exam Schedule, Attendance summary, Marks with charts, Fees, Announcements, Materials.

**Parent app** — Home (child summary), Attendance, Homework, Marks, Fees, News/Announcements.

**Shared** — App bar with notifications panel, in-app messaging panel, bottom navigation, cards/badges/buttons, ripple and float animations, PDF upload and viewer.

The AI Study Assistant is left out of this build, as agreed.

## Data

Reuses your existing project (`efnxjfzyqbdulpjhffsm`) so current rows keep working. Table shapes stay as they are: `students`, `teachers`, `timetable`, `batches`, `attendance`, `homework`, `materials`, `announcements`, `fees`, `marks`, `messages`, `notifications`, `examschedule`.

Note: connecting that project to this app is a one-time step you do from the integrations panel — I can't attach it myself. Until it's connected I'll build against the same schema so it drops straight in.

Security work on those tables:
- Row-level security on every table with role-scoped rules: teachers write only their own classes' attendance/homework/marks; students and parents read only their own (or their child's) rows; fees and marks are never readable across families.
- Grants issued for each table so the app can reach them.
- All writes validated with Zod on both client and server.

## Technical notes

- TanStack Start routes: public `/` role picker, `/auth` login and signup, protected `/teacher/*`, `/student/*`, `/parent/*` under the authenticated layout.
- Design tokens (indigo/gold/green palette, Poppins) moved into `src/styles.css` as semantic tokens; components use tokens rather than inline hex.
- The artifact's `localStorage` cache layer is replaced by TanStack Query caching; reads go through server functions where policies require the signed-in identity.
- The logo is extracted from the artifact's inline base64 into a hosted asset.
- Data writes go through validated server functions; no browser-side writes outside policy-approved paths.

## Sequencing

1. Connect the existing backend, auth scaffolding, profiles/roles, RLS and grants.
2. Design system, shared UI components, role select / login / signup.
3. Teacher app tabs.
4. Student app tabs.
5. Parent app tabs.
6. Notifications, messaging, PDF handling, polish and SEO metadata.
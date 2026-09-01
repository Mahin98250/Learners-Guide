# Phase 4A — Architecture & Repository Audit

Date: 2026-09-01
Repository: Mahin98250/Learners-Guide

## Scope

Phase 4A establishes the production architecture baseline before database/security/QA work. It records the current routing, shared UI shell, portal boundaries, build validation entry points, and identified technical-debt risks.

## Current architecture

- React 19 + TypeScript + Vite.
- TanStack Router owns application routing.
- `/app` resolves the authenticated role and mounts the role portal inside a shared `.lg-app-shell` wrapper.
- Student, Teacher, and Parent use the shared `Shell` and `AppBar` from `src/lg/ui.jsx`.
- Admin is mounted through the admin-specific application stack and keeps a desktop/tablet-oriented layout.
- Supabase is the application backend and authoritative source for production portal workflows.

## Canonical application entrypoints

- `src/main.tsx` — React startup, router bootstrap, error boundary, service worker registration, offline-material startup.
- `src/routes/app.tsx` — authenticated dashboard route and role-to-portal dispatch.
- `src/lg/ui.jsx` — shared LG logo, AppBar, Shell, cards, navigation, and common visual primitives.
- `src/mobile.css` — global responsive foundation.
- `src/production-mobile.css` — current production responsive hardening/portal presentation layer.
- `src/lg/student.jsx` — Student portal.
- `src/lg/teacher.jsx`, `src/lg/teacherWorkflows.jsx`, `src/lg/teacherHomeworkApp.jsx` — Teacher portal/workflows.
- `src/lg/parentWorkflows.jsx` — active Parent portal implementation.
- `src/admin/*` and `src/routes/admin.tsx` — Admin portal.
- `public/sw.js` — service worker/PWA caching.

## Layout contract

The intended hierarchy is:

`viewport → html/body/#root → .lg-app-shell → role portal → Shell → header/content/navigation`

Mobile portals must remain a vertical app frame, use the available viewport width, prevent horizontal overflow, and reserve scroll space above fixed bottom navigation. Portal-specific content should not change the shared shell's flex direction.

## Stable-reference baseline

Known stable visual reference:

`d0d3d6b894f560a6923e4c8960c196bca06453fd`

Current main remains ahead of this baseline because of intentional production/data/security changes. Responsive work must preserve the stable shell contract rather than reintroducing broad descendant selectors or unrelated `:has()` layout overrides.

## Current technical-debt observations

1. There are multiple historical Student/Parent implementations in the repository, including `parent.jsx`, `parentWorkflows.jsx`, `parentWorkflows.safe.jsx`, and `StudentAppFixed.jsx`. Only actively imported modules should be considered canonical; legacy copies should not be modified casually.
2. `src/main.tsx` currently includes mobile restoration recovery logic. It should remain narrowly scoped to page lifecycle recovery and must not become a second layout system.
3. `src/mobile.css` and `src/production-mobile.css` together form the active responsive stack. Future changes should first remove/replace conflicting rules rather than append more global patches.
4. `src/lg/ui.jsx` contains the real Learner's Guide logo and shared Shell/AppBar. Branding should continue to use `LOGO_IMG_SRC`; do not substitute generated or temporary artwork.
5. `package.json` exposes the production gates `npm run typecheck`, `npm run build`, and `npm run lint`.

## Phase 4A acceptance criteria

- Architecture boundaries documented.
- Active entrypoints identified.
- Mobile shell contract documented.
- Stable reference commit recorded.
- Known duplicate/legacy implementation risk recorded.
- Build/typecheck/lint entry points recorded.
- No database schema or RLS changes made in Phase 4A.

## Next phases

- Phase 4B: Supabase/data-integrity audit.
- Phase 4C: authentication/RLS/security audit.
- Phase 4D: full responsive and role-by-role QA matrix.
- Phase 4E: performance/PWA hardening.
- Phase 4F: institute end-to-end simulation.
- Phase 4G: final production gate.

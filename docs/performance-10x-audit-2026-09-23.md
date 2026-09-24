# 10X Performance Audit — Phase 10+

Date: 2026-09-23

## Scope

This audit targets startup latency, first interactive frame, initial JavaScript transfer, unnecessary browser work, repeat network work, and large static assets. It preserves the existing multi-tenant security model and keeps the institute portals on the shared data plane.

## High-impact findings and fixes

### 1. HTML branding payload
The old `index.html` inlined the same large JPEG data URL twice for the favicon and Apple touch icon. The audit replaces those data URLs with the existing `pwa-icon.svg`.

Observed source size:
- old `index.html`: 18,022 bytes
- audited `index.html`: 2,963 bytes

This is a source-size reduction of 15,059 bytes before transfer compression.

### 2. PWA manifest payload
The manifest also embedded a large base64 JPEG. It now references `pwa-icon.svg`.

Observed source size:
- old manifest: 8,073 bytes
- audited manifest: 545 bytes

### 3. Runtime logo payload
`LOGO_IMG_SRC` previously contained the same base64 JPEG inside the JavaScript module. It now points at the external SVG asset using Vite's runtime base URL.

This keeps the logo cacheable as a normal static asset and removes the large data string from the JavaScript source.

### 4. Unused static binary
The repository contained an unreferenced 806,821-byte PNG under `public/`. Code search returned no references, and the file was removed from the audit branch.

### 5. Student startup bundle
The canonical Student portal now loads `StudentAppFixed` directly instead of going through the legacy re-export.

Heavy secondary student workflow code was split into a separate lazy chunk:
- homework/materials: `StudentSecondaryPages.jsx`
- exams/results: existing `studentResults.jsx`
- attendance: existing `studentAttendance.jsx`
- notifications panel: existing `panels.jsx`

Observed source-size shift:
- old `StudentAppFixed.jsx`: 15,552 bytes
- audited `StudentAppFixed.jsx`: 3,363 bytes

The moved secondary module is 12,938 bytes, but it is no longer part of the first Student shell evaluation path.

### 6. Teacher startup bundle
Teacher secondary workflows are now lazy-loaded:
- materials
- tests/results
- announcements
- notifications

Teacher homework upload/compression was split into `TeacherHomeworkPage.jsx` and lazy-loaded.

Observed source-size shift:
- old `teacherHomeworkApp.jsx`: 15,414 bytes
- audited `teacherHomeworkApp.jsx`: 2,082 bytes

### 7. Login-shell critical path
Tenant branding/domain resolution no longer blocks removal of the login/session loading shell. It still runs immediately and updates branding when it completes, but session restoration can finish independently.

### 8. Parent secondary-data deferral
The Parent portal keeps the dashboard metrics on a small summary payload, while full attendance, homework, timetable and fee records are fetched only when their corresponding section is opened. This reduces startup response payload and database/result materialization for common dashboard visits.

### 9. Notification badge query

The Admin notification badge previously selected every unread notification row just to calculate a count. It now requests an exact server-side count with `head: true`, avoiding row payload transfer.

## Existing optimizations retained

- Supabase connection preconnect and DNS prefetch.
- 140ms startup overlay timing.
- 250ms Owner directory search debounce.
- stale-response protection for Owner directory requests.
- Owner status-count cache with in-flight promise deduplication.
- keyset pagination and bounded control-plane reads.
- forward-only database indexes for Owner directory/detail lookups.
- lazy Owner legacy operations.
- removed 30-second background polling from the legacy Owner operations surface.
- shared tenant/user-scoped read caching and request coalescing.

## Performance correctness rule

No optimization here changes tenant authorization boundaries. Any future optimization should keep server-side tenant scoping authoritative; browser-side filtering is not an authorization control.

## Verification

This document records source-level audit findings. Browser-level Core Web Vitals, network waterfall, bundle gzip/brotli transfer sizes, and device-specific TTFB/FCP/LCP should be measured against a deployed build before claiming numeric real-world latency targets.
## Phase 11 — regression guardrails

The production build now has an automated performance budget check in CI. It measures raw, gzip and Brotli sizes for generated JavaScript and CSS assets and protects the HTML/PWA shell from large regressions.

Current guardrails:
- dist/index.html ≤ 4 KiB
- dist/manifest.webmanifest ≤ 1 KiB
- largest JavaScript chunk ≤ 700 KiB raw
- total JavaScript ≤ 2 MiB gzip
- total CSS ≤ 350 KiB gzip
- HTML data-URI payload ≤ 4 KiB

These are regression ceilings, not claimed real-world latency measurements. The deployed-browser validation called out below remains the source of truth for Core Web Vitals, TTFB, FCP and LCP.

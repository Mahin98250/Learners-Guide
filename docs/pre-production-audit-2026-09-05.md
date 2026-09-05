# Learner's Guide — Pre-Production Audit

Date: 2026-09-05
Branch: `perf/portal-query-dedup-2026-09-01`
PR: #30

## Scope

This audit covers the production path end to end:

- Frontend and route/runtime loading
- Shared API/query/data layer
- Supabase schema and relational integrity
- RLS and database function execution
- Storage policies and file delivery
- Edge Functions and authentication
- Performance and query volume
- Automated tests and static checks
- CI/CD and production contract checks
- Production documentation and operational handover

Findings and changes are handled in this order:

1. Critical bugs
2. Security
3. Data integrity
4. Performance
5. Reliability
6. UX
7. Tests
8. Cleanup

## Critical bugs

- No anonymous CRUD access remains on the public application tables. This was verified against the live project privileges.
- The shared timetable loader now scopes the database query by signed-in role before retrieving timetable rows and uses an explicit projection instead of a wildcard read.
- Shared portal reads use an explicit per-table projection and in-flight request deduplication.
- Production contract checks remain enabled in CI.
- Real authenticated browser/device verification is still a required final acceptance gate because CI cannot prove role-specific rendered behavior.

## Security

- All public application tables have RLS enabled.
- Anonymous table SELECT/INSERT/UPDATE/DELETE privileges are disabled across the application tables.
- Anonymous execution was removed from the legacy timetable helper functions in the phase-5 hardening work.
- The live security advisor still reports authenticated execution for SECURITY DEFINER helper functions used by RLS. These functions are part of the current authorization design and should not be blindly revoked because the policies depend on them.
- Supabase leaked-password protection is still reported as disabled. This requires an Auth configuration change outside the repository migration path.
- Homework file delivery performs explicit bearer-token validation and role/ref-based authorization before reading storage.
- Web-push subscribe/unsubscribe operations authenticate the caller; dispatch is protected by the internal push secret.

## Data integrity

- A live foreign-key constraint now enforces `batch_teachers.subject_id -> subjects.id ON DELETE RESTRICT`.
- Current production checks show no orphan rows for batch membership, batch-teacher assignment, test results, homework batch references, material batch references, material teacher references, marks teacher references, or timetable subject references.
- Current production data also has zero duplicate active timetable slots from the existing conflict guard.
- Historical notification rows include references to deleted Auth users. These were not converted to a foreign key because the rows are historical rather than evidence of current broken application data.
- Legacy compatibility columns/tables (array-backed batch IDs, camelCase compatibility fields, legacy timetable/marks identifiers) remain intentionally preserved and are not removed as part of this audit.

## Performance

- Shared portal requests are deduplicated while in flight.
- Large wildcard portal reads were replaced with field projections.
- The timetable path now performs scoped database filtering before enrichment queries.
- Supabase performance advisor reports only unused-index INFO notices; no required portal access-path index is currently missing.
- Edge Function review identified bounded full-user pagination in authentication/recovery/provisioning paths as a future scale concern; no blind schema change was made because the current account model needs to remain compatible.

## Reliability

- Successful writes update local cache only after a successful Supabase response.
- The application documents Supabase as the source of truth and localStorage as cache/offline support.
- An offline-reliability gap was identified: authentication contains offline-identity support, while the shared data loader still assumes an online Supabase read path. This remains a targeted follow-up fix rather than being hidden behind a fake success state.
- CI now runs ESLint in addition to production contract checks, typecheck, and build.

## UX

- Existing responsive/role QA remains the source of truth for real-device acceptance.
- Automated source review found no need to claim mobile acceptance without exercising the rendered application.
- Three ESLint warnings remain non-blocking: one Fast Refresh export warning and two React hook dependency warnings in admin analytics. They should be cleaned during the next focused UX/code-quality pass.

## Tests and CI

- There is no application test framework or `test` script currently present in the repository.
- CI now runs `eslint .`, production contract checks, `tsc --noEmit`, and `vite build`.
- Latest CI and Production Check runs on the current PR head pass after restoring the complete Vite type/build dependencies.
- A dedicated browser/E2E suite is still missing and is the largest automation gap for role-specific regression coverage.

## Current production gate

### Green

- Production contract checks
- ESLint (warnings only)
- Typecheck
- Production build
- Live RLS on public application tables
- Anonymous CRUD privilege removal
- Live schema/data integrity checks described above
- Storage authorization review

### Still required before merge

- Real authenticated smoke test for admin, teacher, student, and parent
- Real mobile/tablet responsive acceptance
- Confirmation that login, refresh, navigation, mutations, uploads/downloads, and role scoping behave correctly in the deployed environment
- Enable leaked-password protection in Supabase Auth configuration

## Audit decision

Do not merge PR #30 solely from automated checks. The code and database have materially stronger production controls, but browser/device acceptance remains a genuine requirement.

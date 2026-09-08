# Learner's Guide — Phase 1 Production Runtime Stabilization

Date: 2026-09-08
Base: `main` @ `ce7c54908cb72890877966e3c416ab2fb9ba1e8d`
Status: In progress

## Objective
Stabilize the existing production application before adding major new features. Phase 1 focuses on concrete runtime failures, stale/legacy behavior that can cause incorrect production results, and release verification. It does not redesign the architecture or add the future Quiz system.

## Verified baseline

- `main` is green in both CI and Production Check after the latest announcement RLS fix.
- Announcement INSERT/UPDATE/DELETE are protected by authenticated-admin RLS policies.
- Parent portal query projections and batch-scoped material loading are already implemented.
- Authentication refreshes the current Supabase Auth user before constructing the active portal identity.
- Production contract checks reject wildcard reads in the shared data layer and enforce several scoped-query invariants.

## Phase 1 findings

### P1 — Student duplicate-ID write behavior needs correction
`src/lg/data.js` currently handles a duplicate student SID (`23505`) by looking up the existing student and returning that existing row as though the insert succeeded. This can make an attempted new-student creation appear successful while actually reusing another student's record. The correct production behavior is to surface a clear duplicate-ID error and never silently reuse another record.

Severity: High data-integrity risk.

### P1 — Local-cache-to-database destructive sync must remain unused
`src/lg/data.js` contains `sdb()` logic that deletes database rows that are absent from a localStorage-derived list. That pattern is unsafe for partial/stale/role-scoped datasets. Phase 1 will verify there are no production callers before considering removal/deprecation. No destructive cache-to-database synchronization should be permitted in the live portal path.

Severity: High potential data-loss risk if invoked with partial data.

### P1 — Error UX must not expose raw backend implementation details
Several shared write paths currently throw errors containing raw Supabase error messages after logging them. Phase 1 will audit user-facing call sites so expected database/RLS failures become safe, actionable messages while diagnostic details remain available for engineering logs.

Severity: Medium reliability/UX risk.

### P1 — Admin analytics is still a direct, broad multi-table read path
The admin analytics page independently requests several complete datasets for dashboard calculations. This is not currently a correctness failure, but it is a production-runtime risk as institute data grows. Phase 1 will keep this on the stabilization backlog and avoid coupling it to unrelated refactors.

Severity: Medium scalability risk.

### P2 — Offline model is not end-to-end
Authentication has offline-session support, while shared portal data still depends on online Supabase reads. The app should not present unsupported data operations as offline-capable.

Severity: Medium reliability gap; targeted for a later reliability pass unless it causes a current production failure.

## Phase 1 completion gate

A Phase 1 implementation is complete only when:

1. No known P0/P1 data-integrity/runtime defect remains in existing supported workflows.
2. Duplicate student identifiers cannot silently reuse an existing record.
3. No live workflow performs destructive synchronization from stale/partial local cache state.
4. User-facing errors are safe and actionable.
5. CI and Production Check are green on every Phase 1 PR.
6. Main remains deployable with no regression to Admin, Teacher, Student, or Parent workflows.

## Explicitly out of scope

- Quiz system
- Profile photos
- Large UI redesigns
- Destructive schema cleanup
- New major product features

## Next implementation order

1. Fix duplicate student SID handling at the shared write boundary.
2. Prove/remove any active `sdb()` production callers.
3. Audit user-facing database error propagation.
4. Re-run production contract checks, regression tests, typecheck, build, and production workflow.
5. Re-audit the live deployment after the PR is merged.

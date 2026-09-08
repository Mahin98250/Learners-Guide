# Phase 1 Runtime Findings

Current baseline: `main` @ `a92a65e2b0ff659a85967eeef5d8b87e9a3f2d7a`.

## Findings confirmed from source review

1. Student duplicate SID handling in `src/lg/data.js` is unsafe: a unique-constraint conflict can cause the shared insert function to return the existing student row instead of failing. This can make a create operation silently target the wrong existing record.
2. `sdb()` contains destructive database deletion based on the difference between localStorage and the supplied row list. No active call site was found by repository text search, but the function itself is unsafe for partial or stale datasets and must not be used by production workflows.
3. The live application is green in CI and Production Check, but those checks do not replace authenticated browser/device acceptance.
4. The live Supabase Security Advisor still reports 20 authenticated-callable SECURITY DEFINER functions and leaked-password protection disabled; those belong to the dedicated Phase 2 security hardening pass and should not be mixed into the Phase 1 bug-fix branch.
5. The current shared data layer already uses explicit projections, in-flight request deduplication, scoped timetable loading, and cache invalidation on auth changes.

## Phase 1 rule
Fix concrete runtime/data-integrity defects without broad refactoring. Each code change must have a regression check and pass CI + Production Check before merge.

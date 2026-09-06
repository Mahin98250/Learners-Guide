# Performance Phase 6 — Baseline

## Scope
- Portal data loading
- Duplicate request prevention
- Query result size
- Database indexes and RLS-sensitive access paths
- Regression verification without changing product behavior

## Initial live observations
- Shared `gdb()` already prevents identical requests while the same request is in flight.
- `hydrateForRole()` still starts many table reads in parallel for each portal.
- Several portal screens also issue their own direct Supabase queries.
- Database statistics show high sequential-scan activity on `notifications`, `material_folders`, `students`, `batch_students`, and `users`.
- Current dataset is still small, so sequential scans are not automatically a defect; indexes must match real query patterns.
- Existing FK/query indexes are already present for many high-value access paths, including batch/student, attendance, timetable, test results, and notifications.

## Next implementation targets
1. Add session/request-scope result caching around shared reads without serving stale mutation data.
2. Audit direct portal queries for repeated institute-wide reads and add explicit filters where safe.
3. Review the most frequently called SQL statements once query statistics are available through the connected observability tooling.
4. Add focused performance regression contracts.
5. Re-run CI and production checks.

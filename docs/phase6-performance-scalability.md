# Phase 6 — Performance & Scalability Implementation

Date: 2026-09-22
Repository: Mahin98250/Mahin

## Objective

Reduce repeated database work and improve multi-institute query efficiency without changing portal behavior.

## Completed

### 1. Shared read caching
- Shared `gdb()` cache keys now include table, active institute, and authenticated user.
- This prevents cached results from crossing institute or user boundaries.
- Concurrent reads continue to coalesce through the in-flight request map.
- Mutations invalidate all scoped cache entries for the affected table by prefix, so shared writes do not leave stale cached table results.

### 2. Authenticated institute-context caching
- `getCurrentInstituteContext()` now uses a 5-second in-memory cache plus an in-flight request map.
- Cache keys include authenticated user, hostname, and preferred institute.
- Authentication changes clear the context cache.

### 3. Direct portal query audit
Explicit `institute_id` filters were added to repeated direct reads in:
- student portal
- parent portal
- student runtime homework/material/profile reads
- leave access lookup

The shared data layer already applies tenant scoping to the supported tenant tables.

The legacy `public.users` table is intentionally not treated as a tenant-column table because the live schema does not contain `institute_id`; its existing account-directory authorization remains unchanged.

### 4. Database indexes
Focused composite indexes were added for observed multi-tenant access paths:
- unread notifications by institute/user/time
- material folders by institute/parent/name
- batch membership by institute/student/status
- batch membership by institute/batch/status
- homework by institute/batch/time
- test results by institute/student/test
- attendance by institute/student/date
- active timetable entries by institute/batch/day/time
- active timetable entries by institute/teacher/day/time

Targeted tables were analyzed after index creation.

## Live verification

The production database showed existing indexes on the main portal access paths and the new Phase 6 composite indexes were confirmed present after migration. Current query statistics also show that much of the historical execution-time sample is dominated by migration/DDL and trigger setup statements rather than steady-state portal traffic, so no claim is made that a specific index reduced a measured production latency yet.

## Regression protection

`test/phase6-performance-scalability-contract.test.mjs` checks:
- scoped shared-cache keys
- cache invalidation behavior
- context cache/coalescing
- explicit tenant filters on direct portal reads
- separation of the non-tenant `users` table
- presence of the focused composite indexes

## Verification gate

Phase 6 is complete when CI, Production Check, Production Checks, and GitHub Pages deployment are green for the merged commit.

# Multi-Institute Phase 3B — Tenant Boundary Enforcement

The database now has a hard tenant boundary across the current institute-owned tables while keeping the existing feature-level role policies intact.

## How it works

- Every tenant-owned table has a PostgreSQL restrictive RLS policy requiring an active institute membership or an active platform membership.
- A shared trigger fills institute_id automatically when the authenticated user has exactly one active institute membership.
- When a user belongs to multiple institutes, writes without an explicit institute_id are rejected. This prevents accidental cross-institute writes.
- Existing rows cannot be moved from one institute to another by an ordinary member.
- Platform provisioning can assign an existing person to an institute role through a protected function.

## Production verification

At rollout time, every existing row in the migrated tenant-owned tables was checked for a missing institute_id. The result was zero null tenant IDs across 760 existing rows.

## Next

The application should now make the selected institute explicit in people, academics and administration workflows, then progressively replace legacy global-role checks with the permission model.

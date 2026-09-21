# Multi-Institute Phase 2 — Permissions and Control Plane

Phase 2 adds the authorization model needed before the first additional institute can be enabled.

## Added

- A canonical permission catalog.
- Tenant-local system roles.
- Role-to-permission mappings.
- Per-membership allow/deny overrides.
- Platform settings storage.
- Platform/institute audit log storage.
- Secure helpers for platform membership and institute permission checks.
- Safe read policies for the new control-plane tables.

## Important security behavior

Permission evaluation requires an active institute membership, an active person, and an active role. A membership-level `deny` wins over a role grant or an `allow` override.

The role/permission model is additive. Existing production RLS on legacy education tables is intentionally not replaced yet.

## System roles

`institute_owner`, `institute_admin`, `academic_admin`, `teacher`, `accountant`, `receptionist`, `content_manager`, `student`, `parent`, and a temporary `staff` compatibility role.

## Next

The next migration will make the control-plane CRUD usable through a protected platform-owner surface and add a server-side institute provisioning workflow. Legacy education tables will then be converted to required `institute_id` plus tenant-aware RLS in controlled batches.

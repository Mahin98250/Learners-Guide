# Multi-Institute Phase 4 — Tenant Workspace

Phase 4 starts the migration of the existing administration/data layer from implicit global access to an explicit institute workspace.

## Added

- A reusable `InstituteWorkspaceProvider` and `useInstituteWorkspace()` hook.
- Persistent active-institute selection for users who belong to multiple institutes.
- An admin workspace gate that blocks the legacy admin portal until an active institute membership is resolved.
- Admin shell branding from the active institute.
- Centralized tenant scoping in the legacy query layer.
- Centralized tenant scoping in the legacy mutation layer.
- Tenant-aware account membership synchronization through protected database functions.
- Tenant-safe delete behavior: remove only the selected institute membership first; delete the global Auth account only when no active institute memberships remain.

## Important transition behavior

The current application still retains legacy authentication metadata and feature-level role checks. Phase 4 does not claim to have replaced those checks.

The new workspace context is an application-level explicit selector, while the database continues to enforce the restrictive membership boundary. Existing legacy tables remain compatible during the staged migration.

## Verification target

Before enabling the second institute for real users, each remaining admin/academic write workflow should pass an explicit institute context through its query/mutation path and the remaining global-role checks should be migrated to membership permissions.
# Phase 9 — Multi-Tenant Architecture Foundation

Date: 2026-09-22
Repository: Mahin98250/Mahin

## Goal

Extend the existing Mahin institute application into a scalable multi-tenant platform without rebuilding or duplicating the working Student, Parent, Teacher, and Institute Admin portals.

Phase 9 is an additive architecture phase. Existing institute workflows remain the data-plane application for each tenant. The platform/Owner surface is the control plane around those tenants.

## Repository audit baseline

The repository already contains a substantial tenant foundation:

- `src/lg/tenant.ts` resolves the current institute from verified hostname, preferred workspace, or the user's only active membership.
- `src/lg/tenant-context.tsx` provides the shared `InstituteWorkspaceProvider` and blocks institute application access until a valid membership is selected.
- `src/lg/data/queries.js` and `src/lg/data/mutations.js` apply tenant scoping to the existing institute-owned tables and include the institute in shared-cache keys.
- The Admin route mounts `InstituteWorkspaceProvider`/`InstituteWorkspaceGate` before the existing Admin application.
- Teacher, Parent, Student, and Admin implementations already use the shared tenant context in their newer tenant-aware code paths.
- `src/platform/PlatformOwnerPortal.tsx` is separated from the institute application and operates as the platform control plane.
- The database already contains `institutes`, `people`, `institute_memberships`, `institute_roles`, `institute_role_permissions`, `institute_settings`, `institute_domains`, feature entitlement tables, and audit tables.
- Tenant-owned education tables already have an `institute_id` boundary with restrictive RLS and write-time tenant validation.
- Provisioning already creates an institute plus settings and baseline roles/permissions atomically.

## Canonical architecture

```
                         PLATFORM CONTROL PLANE
                                  |
                          Platform Owner / Ops
                                  |
                  +---------------+----------------+
                  |                                |
            Tenant registry                   Tenant operations
            lifecycle/domain                entitlements/audit
                  |
        +---------+----------+-------------------+
        |                    |                   |
   Institute A           Institute B         Institute N
        |                    |                   |
   Existing portal      Existing portal     Existing portal
   Student/Parent       Student/Parent      Student/Parent
   Teacher/Admin        Teacher/Admin       Teacher/Admin
        |                    |                   |
        +--------------------+-------------------+
                         Shared data plane
                     (tenant-isolated rows)
```

### One codebase and one database

Phase 9 keeps the current shared application and shared Supabase database.

There is no per-institute codebase, no per-institute database, and no duplicate Student/Parent/Teacher feature stack.

Tenant isolation is a data-access property enforced by PostgreSQL RLS plus tenant validation, not a UI convention.

## Layer boundaries

### 1. Platform / control plane

Responsible for:

- tenant lifecycle
- tenant provisioning
- domain and URL routing
- tenant-level feature entitlements
- platform/operator memberships
- tenant administrator onboarding
- platform audit and operational controls

Platform users must stay outside the normal institute workspace flow.

### 2. Identity layer

Canonical identity is:

`auth.users -> people -> institute_memberships -> institute_roles`

The legacy `public.users` table remains a compatibility bridge where existing authentication/account flows require it. Phase 9 must not treat it as the new tenant source of truth.

### 3. Tenant workspace layer

The shared tenant resolver is the only client-side source of the active institute context.

Resolution priority is:

1. verified hostname mapping
2. explicitly selected preferred institute
3. the only active institute membership
4. otherwise require workspace selection/block access

A hostname can identify a tenant, but it never grants authorization by itself. Membership and database policy remain authoritative.

### 4. Existing institute application / data plane

This is the existing application and must remain intact.

It owns:

- students
- parents/guardians
- teachers
- batches
- timetable
- attendance
- homework
- materials
- assessments/results
- fees
- announcements
- leave
- notifications
- reports
- institute-specific administration

Phase 9 should reuse these features rather than create parallel implementations in the Owner area.

## Request and authorization pipeline

For an institute request:

```
Authenticated session
      ↓
Resolve institute workspace
      ↓
Require active institute membership
      ↓
Check institute permission
      ↓
Run existing feature code
      ↓
PostgreSQL RLS + tenant trigger enforce boundary
```

For a platform request:

```
Authenticated session
      ↓
Require Owner/platform identity
      ↓
Require AAL2 for privileged platform operations
      ↓
Run protected platform RPC
      ↓
Audit mutation
```

## Non-negotiable invariants

1. Every institute-owned row remains bound to exactly one `institute_id`.
2. An authenticated institute user cannot read or mutate another institute's rows.
3. An existing row cannot be moved from one institute to another through normal authenticated writes.
4. A hostname never substitutes for authorization.
5. Existing portal permissions remain enforced.
6. Platform operators may manage tenants without being treated as an ordinary tenant member.
7. No new feature in Phase 9 should bypass the existing tenant resolver, permission system, or RLS.
8. Existing portal behavior must remain unchanged unless a change is required to consume the shared tenant contract.
9. Cache keys must include tenant and user identity whenever data can differ by either.
10. Large control-plane collections must not be loaded completely into the browser.

## Main scalability gap found

The current security architecture is much further along than the current control-plane read architecture.

The Owner portal currently performs broad reads such as:

- all institutes
- all domains
- platform audit history
- all institute feature entitlements

The People & Roles panel also loads the global people directory for the selected institute.

This is safe only while the data set is small. As the number of institutes and people grows, browser payload size, query work, rendering cost, and memory use will grow unnecessarily.

Phase 9 therefore focuses first on **bounded, tenant-aware control-plane reads**, not on rewriting working institute features.

## Phase 9 read architecture

### Tenant catalog

Use a protected platform RPC for the Owner tenant directory.

Properties:

- server-side search
- server-side status filtering
- bounded result size
- keyset/cursor pagination
- stable ordering by `created_at` + `id`
- no client-side full-table filtering requirement

Separate status-count query:

- total
- trial
- active
- suspended
- archived

The count query is separate from the page query so the directory itself never needs to materialize every tenant.

### Tenant details

When an Owner opens one institute, fetch its detail records on demand:

- settings
- primary/secondary domain information
- lifecycle state
- relevant feature entitlements
- administrator/membership summary

Do not preload every institute's detail payload.

### Audit

Audit becomes an institute-filterable, bounded feed.

The default screen shows a recent window. Older records are loaded only when requested.

### Domains

Domain records are loaded as a bounded list, preferably filtered by institute or domain status rather than globally materializing the entire domain table.

### People & Roles

The existing institute membership model remains the source of truth.

The control-plane UI should eventually query:

- memberships for the selected institute
- people needed for assignment/search
- roles for the selected institute

instead of loading the complete global person table every time.

## Caching rules

Client caches must be scoped by:

`tenant + authenticated user + resource`

The current shared data layer already follows this pattern for institute reads.

Phase 9 must extend the same principle to control-plane resources rather than introducing a second cache system with weaker isolation.

## Provisioning and lifecycle

Institute provisioning remains atomic.

The lifecycle is:

```
provisioned
    ↓
trial
    ↓
active
    ↓
suspended (temporary)
    ↓
archived (terminal operational state)
```

Provisioning must produce a usable tenant boundary before the tenant is handed to an institute administrator.

Existing onboarding/invitation functions remain the handoff mechanism.

## What Phase 9 must not do

Do not:

- duplicate Student portal code for Owner use
- duplicate Parent portal code for Owner use
- duplicate Teacher workflows for Owner use
- create per-tenant databases
- create per-tenant repositories
- replace the existing `tenant.ts` resolver
- replace the existing Admin workspace provider
- weaken RLS to make Owner tooling easier
- load entire large tenant collections just to filter them in React
- move business logic into the Owner UI that belongs in existing institute services

## Implementation sequence

### Phase 9A — Control-plane read boundary

Introduce protected, bounded tenant-directory/query functions and a typed client helper.

### Phase 9B — Owner lazy loading

Change the Owner screen so first paint loads only the information needed for the first view. Tenant details, feature entitlements, domains, people/roles, and audit data become independently bounded reads.

### Phase 9C — Tenant handoff

Make the post-provisioning path explicit:

`provision tenant -> establish domain -> invite admin -> admin enters tenant workspace`

No manual database manipulation should be required for normal onboarding.

### Phase 9D — Observability

Track platform and tenant operational events through the existing audit system without mixing tenant business records with platform control-plane state.

### Phase 9E — Scale regression protection

Add contract tests for:

- tenant isolation
- bounded platform queries
- pagination/cursors
- no cross-tenant cache reuse
- preservation of existing portal entry points
- protected platform mutations

## Definition of done

Phase 9 is not complete merely because the Owner page looks correct.

It is complete when:

- the existing portals continue to use their current tenant-aware architecture;
- the platform can operate many institutes without loading every tenant into the browser;
- tenant reads and writes remain RLS-enforced;
- provisioning and admin handoff work through protected operations;
- the CI/test suite protects the architecture from regressions;
- no existing institute feature has been rewritten unnecessarily.


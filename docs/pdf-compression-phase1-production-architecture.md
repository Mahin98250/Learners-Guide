# PDF Compression — Phase 1 Production Architecture

## Goal

Move PDF optimization out of the browser and establish a production-safe server-side control plane for a multi-tenant commercial product.

## Phase 1 boundaries

- Browser performs upload and displays progress.
- A server-side Edge Function authenticates the caller and enqueues a compression job.
- Every job belongs to a tenant and records the authenticated requester.
- A private `pdf-compression-tmp` storage bucket is reserved for server-only staging.
- Job state is immutable to normal authenticated clients; worker/service-role code owns processing state.
- The compression engine is intentionally **not** selected in this phase because commercial licensing is still unresolved.
- Existing homework/material storage remains the source of truth until the worker pipeline is implemented.

## Data model

`compression_tenants`
- One logical institute/customer boundary.
- `status` supports suspension/closure without deleting historical jobs.

`compression_tenant_memberships`
- Explicit user-to-tenant membership.
- Membership is the authorization boundary for compression jobs.

`pdf_compression_jobs`
- One immutable request record per compression attempt.
- Stores tenant, requester, source object, profile, lifecycle state, sizes, page count, engine and error details.
- Workers can update state using the service role; browsers can only enqueue and read jobs allowed by RLS.

## Processing contract for Phase 2

1. Authorize user and tenant.
2. Copy source PDF into private tenant/job staging path.
3. Validate source PDF and enforce resource limits.
4. Run commercially licensed compression engine.
5. Validate output.
6. Compare output with original.
7. If output is valid and smaller, replace/copy the final object.
8. Otherwise keep the original.
9. Delete staging objects.
10. Mark job terminal state.

## Safety invariants

- A compression failure must never delete the original.
- A larger output must never replace the original.
- Cross-tenant job reads are denied by RLS.
- Client code cannot mark a job `optimized` or change its engine/result.
- Service credentials never enter browser code.
- The temporary bucket is private.
- Compression is an optimization, not a prerequisite for successful document storage.

## Not yet production-complete

This phase does **not** claim that PDF compression is production-ready. The commercial compression engine, worker execution, strong PDF validation suite, cleanup guarantees, observability and real PDF fixtures are Phase 2+ work.

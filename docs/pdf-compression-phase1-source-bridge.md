# PDF Compression — Phase 1.1 Source Bridge

## Purpose

Phase 1 created a compression-specific tenant boundary. Phase 1.1 now connects that boundary to the **existing Learner's Guide PDF records** without pretending that the application already has a first-class SaaS institute table.

## Current bridge

An administrator-owned active compression tenant may bind an existing PDF source from:

- `homework.storage_path`
- `materials.storage_path`

The binding is stored in `compression_tenant_sources`.

Where available, `source_record_id` records the matching homework/materials row ID as an additional integrity check.

## Security rules

- Only an authenticated administrator who is an **owner** of the compression tenant can create, update, or delete a source binding.
- The tenant must be active.
- A source path must already exist in the selected application table.
- When `source_record_id` is provided, it must match the same row as the storage path.
- Normal tenant operators can read bound sources but cannot manufacture bindings.
- The compression job Edge Function still performs its own tenant-membership and source-binding checks before creating a job.

## Why this is not the final SaaS tenant model

The live application currently has role-aware institute data but does not have a first-class `institutes`, `organizations`, or `tenant_id` field shared by its core records.

Therefore this bridge is intentionally narrow. It is safe for the current single-institute architecture and leaves a clean migration path to a future shared tenant registry.

## Phase 2 handoff

When a first-class SaaS tenant registry is introduced, migrate:

1. compression tenant -> real application tenant ID
2. source binding -> real tenant-owned source record
3. user membership -> application tenant membership

Do not copy this compression-specific tenant as a permanent second tenant system.

# PDF Compression — Phase 2

## What is now complete

Phase 2 moves PDF compression out of the browser and into a server-side Supabase Edge Function.

### Upload flow

1. Browser uploads the original PDF.
2. Browser creates the normal homework/material record.
3. Browser enqueues a pdf_compression_jobs row through the authenticated Edge Function.
4. The function verifies the caller, source object, and compression tenant.
5. The function starts server-side processing with EdgeRuntime.waitUntil.
6. The original PDF is copied into the private pdf-compression-tmp bucket.
7. The MIT-licensed @cantoo/pdf-lib engine validates and structurally rewrites the PDF with object-stream compression.
8. The candidate is validated again, including page-count preservation.
9. The source object is checked for concurrent changes.
10. Only a valid candidate that is strictly smaller replaces the original.
11. Job metadata and application file_size are updated.
12. Temporary staging files are deleted in finally.

## Engine and licensing

The Phase 2 engine is @cantoo/pdf-lib@2.11.0, licensed under MIT.

This is deliberately not the AGPL Ghostscript WASM package previously tested in the project.

The current engine is a content-preserving structural optimizer. It does not claim iLovePDF-style raster downsampling of scanned/image-heavy PDFs. That stronger image recompression stage requires a separate production engine decision, such as a commercially licensed Ghostscript deployment or another licensed/native processing service.

## Safety guarantees

- Original upload is created before compression starts.
- Compression failures leave the original untouched.
- Larger/equal candidates never replace the original.
- Source changes during processing prevent replacement.
- Cross-tenant job reads remain protected by RLS.
- Internal worker authentication uses Supabase secret-key mode.
- Secret credentials never enter browser code.
- Temporary files live in a private bucket and are cleaned up.
- PDF page count must remain unchanged.
- XFA preservation is requested during load/validation.
- A failed job can be retried by an authenticated administrator who owns the compression tenant.

## Resource boundary

Supabase Edge Functions have hosted memory/CPU/time limits. The current pipeline therefore keeps a 50 MB PDF processing limit aligned with the application's existing upload limits and processes one job at a time per background invocation. Supabase documents a 256 MB memory limit and a 150-second wall-clock limit on Free plans / 400 seconds on paid plans.

For a future high-volume SaaS deployment, very large or CPU-heavy PDFs should move from Edge Functions to a dedicated worker runtime while keeping this same job contract and storage safety invariants.

## Multi-tenant handoff

The compression tenant is still a bridge for the current single-institute application. The final SaaS architecture should replace it with the application's first-class institute/customer tenant ID rather than maintaining two independent tenant registries.

## Phase 2 boundary

Phase 2 is complete as the server-side safe compression pipeline.

A future Phase 3 can add true image/raster recompression and quality profiles without changing the job, tenant, storage, or safety contracts.
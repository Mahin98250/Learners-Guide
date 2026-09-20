-- Phase 3: real raster/image recompression telemetry and stable attempt numbering.
alter table public.pdf_compression_jobs
  add column if not exists image_count integer not null default 0,
  add column if not exists image_recompressed_count integer not null default 0,
  add column if not exists raster_original_bytes bigint not null default 0,
  add column if not exists raster_final_bytes bigint not null default 0;

-- Phase 2 retry increments attempts. Keep the first attempt numbered 1 and
-- preserve that number when a queued job is claimed by a worker.
update public.pdf_compression_jobs
set attempt_count = 1
where attempt_count = 0;

alter table public.pdf_compression_jobs
  alter column attempt_count set default 1;

create index if not exists idx_pdf_compression_jobs_processing
  on public.pdf_compression_jobs (status, started_at)
  where status = 'processing';

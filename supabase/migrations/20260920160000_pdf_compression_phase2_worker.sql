-- Phase 2: production server-side PDF compression execution state.
alter table public.pdf_compression_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists worker_id text,
  add column if not exists source_object_updated_at timestamptz;

create index if not exists idx_pdf_compression_jobs_queue
  on public.pdf_compression_jobs (status, created_at)
  where status = 'queued';

-- Allow a safe retry of a failed job without letting browsers mutate the lifecycle.
create or replace function public.retry_pdf_compression_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tenant_id uuid;
  v_allowed boolean;
begin
  select tenant_id into v_tenant_id
  from public.pdf_compression_jobs
  where id = p_job_id
    and status = 'failed';

  if v_tenant_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = v_tenant_id
      and m.user_id = auth.uid()
      and m.membership_role = 'owner'
  ) and public.app_role() = 'admin'
  into v_allowed;

  if not v_allowed then
    return false;
  end if;

  update public.pdf_compression_jobs
  set status = 'queued',
      started_at = null,
      completed_at = null,
      worker_id = null,
      error_code = null,
      error_message = null,
      attempt_count = attempt_count + 1
  where id = p_job_id
    and status = 'failed';

  return found;
end;
$$;

revoke all on function public.retry_pdf_compression_job(uuid) from public;
grant execute on function public.retry_pdf_compression_job(uuid) to authenticated;

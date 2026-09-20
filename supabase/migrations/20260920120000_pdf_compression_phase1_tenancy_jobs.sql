-- Phase 1: production PDF compression tenancy and job boundary.
-- This migration creates the control plane only. No compression engine is installed here.

create table if not exists public.compression_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compression_tenant_memberships (
  tenant_id uuid not null references public.compression_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'operator' check (membership_role in ('owner','operator')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.pdf_compression_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.compression_tenants(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  source_bucket text not null check (source_bucket in ('homework','materials')),
  source_path text not null,
  temp_input_path text,
  temp_output_path text,
  status text not null default 'queued' check (
    status in ('queued','processing','optimized','original-kept','failed','cancelled')
  ),
  profile text not null default 'recommended' check (
    profile in ('recommended','extreme','less')
  ),
  engine text,
  original_size bigint,
  final_size bigint,
  page_count integer,
  savings_bytes bigint generated always as (
    case
      when original_size is not null and final_size is not null and original_size > final_size
      then original_size - final_size
      else 0
    end
  ) stored,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_pdf_compression_jobs_tenant_created
  on public.pdf_compression_jobs (tenant_id, created_at desc);

create index if not exists idx_pdf_compression_jobs_status_created
  on public.pdf_compression_jobs (status, created_at);

create index if not exists idx_pdf_compression_jobs_requested_by
  on public.pdf_compression_jobs (requested_by, created_at desc);

alter table public.compression_tenants enable row level security;
alter table public.compression_tenant_memberships enable row level security;
alter table public.pdf_compression_jobs enable row level security;

drop policy if exists compression_tenants_member_read on public.compression_tenants;
create policy compression_tenants_member_read
on public.compression_tenants
for select to authenticated
using (
  exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenants.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists compression_tenant_memberships_member_read on public.compression_tenant_memberships;
create policy compression_tenant_memberships_member_read
on public.compression_tenant_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_memberships.tenant_id
      and m.user_id = auth.uid()
      and m.membership_role in ('owner','operator')
  )
);

drop policy if exists pdf_compression_jobs_member_read on public.pdf_compression_jobs;
create policy pdf_compression_jobs_member_read
on public.pdf_compression_jobs
for select to authenticated
using (
  exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = pdf_compression_jobs.tenant_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists pdf_compression_jobs_member_insert on public.pdf_compression_jobs;
create policy pdf_compression_jobs_member_insert
on public.pdf_compression_jobs
for insert to authenticated
with check (
  requested_by = auth.uid()
  and exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = pdf_compression_jobs.tenant_id
      and m.user_id = auth.uid()
  )
);

-- The browser must not mutate job state after enqueueing.
-- Worker/service-role operations bypass RLS.
revoke update, delete on public.pdf_compression_jobs from authenticated;
revoke insert, update, delete on public.compression_tenants from authenticated;
revoke insert, update, delete on public.compression_tenant_memberships from authenticated;

-- Private staging bucket. No client-facing storage policy is created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pdf-compression-tmp',
  'pdf-compression-tmp',
  false,
  104857600,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 104857600,
    allowed_mime_types = array['application/pdf']::text[];

create or replace function public.create_compression_tenant(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tenant_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if public.app_role() <> 'admin' then
    raise exception 'Only administrators can create compression tenants';
  end if;

  if v_name = '' or v_slug = '' or v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Invalid tenant name or slug';
  end if;

  insert into public.compression_tenants (name, slug, created_by)
  values (v_name, v_slug, auth.uid())
  returning id into v_tenant_id;

  insert into public.compression_tenant_memberships (tenant_id, user_id, membership_role)
  values (v_tenant_id, auth.uid(), 'owner');

  return v_tenant_id;
end;
$$;

revoke all on function public.create_compression_tenant(text, text) from public;
grant execute on function public.create_compression_tenant(text, text) to authenticated;

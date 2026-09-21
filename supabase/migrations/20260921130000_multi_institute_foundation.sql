-- Multi-institute foundation, Phase 1.
--
-- Additive rollout:
--   * creates platform/institute identity tables;
--   * adds nullable institute_id to legacy institute-owned tables;
--   * backfills existing Learner's Guide data into the original institute;
--   * leaves current RLS unchanged until the application is tenant-aware.
--
-- Phase 2 will make institute_id required and switch RLS to membership + permissions.

create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('trial','active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutes_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  status text not null default 'active'
    check (status in ('active','inactive','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  role text not null
    check (role in ('platform_owner','platform_support','platform_operations','platform_billing','platform_auditor')),
  status text not null default 'active'
    check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_id, role)
);

create table if not exists public.institute_memberships (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role text not null,
  status text not null default 'active'
    check (status in ('active','invited','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, person_id)
);

create table if not exists public.institute_settings (
  institute_id uuid primary key references public.institutes(id) on delete cascade,
  display_name text,
  short_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  login_title text,
  powered_by_enabled boolean not null default true,
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institute_domains (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  hostname text not null unique,
  domain_type text not null
    check (domain_type in ('default_subdomain','custom')),
  status text not null default 'pending'
    check (status in ('pending','verified','disabled')),
  verification_method text
    check (verification_method is null or verification_method in ('dns_txt','dns_cname','manual')),
  verification_token text,
  verified_at timestamptz,
  tls_status text not null default 'pending'
    check (tls_status in ('pending','provisioning','active','failed')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institute_domains_hostname_normalized check (hostname = lower(trim(hostname))),
  constraint institute_domains_hostname_format check (hostname !~ '^[^\s/]+://')
);

create unique index if not exists institute_domains_one_primary_per_institute
  on public.institute_domains (institute_id)
  where is_primary = true;

create index if not exists institute_memberships_person_idx
  on public.institute_memberships (person_id, status);

create index if not exists institute_memberships_institute_role_idx
  on public.institute_memberships (institute_id, role, status);

create index if not exists institute_domains_institute_idx
  on public.institute_domains (institute_id, status);

create or replace function public.lg_platform_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists institutes_set_updated_at on public.institutes;
create trigger institutes_set_updated_at
before update on public.institutes
for each row execute function public.lg_platform_updated_at();

drop trigger if exists people_set_updated_at on public.people;
create trigger people_set_updated_at
before update on public.people
for each row execute function public.lg_platform_updated_at();

drop trigger if exists platform_memberships_set_updated_at on public.platform_memberships;
create trigger platform_memberships_set_updated_at
before update on public.platform_memberships
for each row execute function public.lg_platform_updated_at();

drop trigger if exists institute_memberships_set_updated_at on public.institute_memberships;
create trigger institute_memberships_set_updated_at
before update on public.institute_memberships
for each row execute function public.lg_platform_updated_at();

drop trigger if exists institute_settings_set_updated_at on public.institute_settings;
create trigger institute_settings_set_updated_at
before update on public.institute_settings
for each row execute function public.lg_platform_updated_at();

drop trigger if exists institute_domains_set_updated_at on public.institute_domains;
create trigger institute_domains_set_updated_at
before update on public.institute_domains
for each row execute function public.lg_platform_updated_at();

alter table public.institutes enable row level security;
alter table public.people enable row level security;
alter table public.platform_memberships enable row level security;
alter table public.institute_memberships enable row level security;
alter table public.institute_settings enable row level security;
alter table public.institute_domains enable row level security;

insert into public.institutes (name, slug, status)
values ('Learner''s Guide', 'learners-guide', 'active')
on conflict (slug) do update
set name = excluded.name,
    status = excluded.status,
    updated_at = now();

insert into public.institute_settings (institute_id, display_name, short_name)
select id, name, 'Learner''s Guide'
from public.institutes
where slug = 'learners-guide'
on conflict (institute_id) do nothing;

insert into public.people (auth_id, display_name, email, phone)
select
  u.auth_id,
  u.name,
  u.email,
  u.phone
from public.users u
where u.auth_id is not null
on conflict (auth_id) do update
set display_name = excluded.display_name,
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now();

insert into public.institute_memberships (institute_id, person_id, role, status)
select
  i.id,
  p.id,
  case lower(u.role)
    when 'admin' then 'institute_admin'
    when 'teacher' then 'teacher'
    when 'student' then 'student'
    when 'parent' then 'parent'
    else 'staff'
  end,
  case lower(coalesce(u.status, 'active'))
    when 'active' then 'active'
    when 'inactive' then 'suspended'
    when 'suspended' then 'suspended'
    else 'active'
  end
from public.users u
join public.people p on p.auth_id = u.auth_id
cross join public.institutes i
where i.slug = 'learners-guide'
  and u.auth_id is not null
on conflict (institute_id, person_id) do update
set role = excluded.role,
    status = excluded.status,
    updated_at = now();

create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.people p
  where p.auth_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_institute_ids()
returns table (institute_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.institute_id
  from public.institute_memberships m
  join public.people p on p.id = m.person_id
  where p.auth_id = auth.uid()
    and m.status = 'active'
  union
  select i.id
  from public.institutes i
  join public.platform_memberships pm on pm.auth_id = auth.uid()
  where pm.status = 'active';
$$;

create or replace function public.resolve_institute_domain(p_hostname text)
returns table (
  institute_id uuid,
  slug text,
  name text,
  status text,
  display_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  login_title text,
  powered_by_enabled boolean,
  timezone text,
  locale text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    i.id,
    i.slug,
    i.name,
    i.status,
    coalesce(s.display_name, i.name),
    s.logo_url,
    s.favicon_url,
    s.primary_color,
    s.secondary_color,
    s.login_title,
    coalesce(s.powered_by_enabled, true),
    coalesce(s.timezone, 'Asia/Kolkata'),
    coalesce(s.locale, 'en-IN')
  from public.institute_domains d
  join public.institutes i on i.id = d.institute_id
  left join public.institute_settings s on s.institute_id = i.id
  where lower(trim(d.hostname)) = lower(trim(coalesce(p_hostname, '')))
    and d.status = 'verified'
    and d.tls_status in ('active', 'provisioning')
    and i.status in ('trial', 'active')
  limit 1;
$$;

revoke all on function public.current_person_id() from public, anon;
grant execute on function public.current_person_id() to authenticated;

revoke all on function public.current_institute_ids() from public, anon;
grant execute on function public.current_institute_ids() to authenticated;

revoke all on function public.resolve_institute_domain(text) from public;
grant execute on function public.resolve_institute_domain(text) to anon, authenticated;

do $$
declare
  v_institute_id uuid;
  v_table text;
  v_tables text[] := array[
    'academic_years',
    'announcements',
    'attendance',
    'batch_students',
    'batch_teachers',
    'batches',
    'examschedule',
    'fees',
    'homework',
    'leave_requests',
    'marks',
    'material_folders',
    'materials',
    'messages',
    'notifications',
    'parent_student_links',
    'rooms',
    'students',
    'subjects',
    'teachers',
    'test_results',
    'tests',
    'timetable',
    'timetable_entries'
  ];
begin
  select id into v_institute_id
  from public.institutes
  where slug = 'learners-guide';

  foreach v_table in array v_tables loop
    execute format(
      'alter table public.%I add column if not exists institute_id uuid references public.institutes(id)',
      v_table
    );
    execute format(
      'create index if not exists %I on public.%I (institute_id)',
      'idx_' || v_table || '_institute_id',
      v_table
    );
    execute format(
      'update public.%I set institute_id = $1 where institute_id is null',
      v_table
    ) using v_institute_id;
  end loop;
end $$;

comment on column public.users.auth_id is 'Legacy identity bridge. New tenant-aware identity uses public.people + public.institute_memberships.';
comment on column public.students.institute_id is 'Tenant boundary staged in Phase 1; Phase 2 will make this required and RLS-authoritative.';
comment on column public.teachers.institute_id is 'Tenant boundary staged in Phase 1; Phase 2 will make this required and RLS-authoritative.';

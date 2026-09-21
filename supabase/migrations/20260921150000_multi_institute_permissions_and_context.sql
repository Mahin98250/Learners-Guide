-- Multi-institute Phase 2: canonical permissions, tenant roles and control-plane audit.

create table if not exists public.permissions (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.institute_roles (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  role_key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  status text not null default 'active'
    check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, role_key)
);

create table if not exists public.institute_role_permissions (
  role_id uuid not null references public.institute_roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_code)
);

create table if not exists public.institute_membership_permission_overrides (
  membership_id uuid not null references public.institute_memberships(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  created_at timestamptz not null default now(),
  primary key (membership_id, permission_code)
);

create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  product_name text,
  legal_name text,
  public_website_url text,
  default_app_domain text,
  support_email text,
  default_timezone text not null default 'Asia/Kolkata',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform','institute')),
  institute_id uuid references public.institutes(id) on delete set null,
  actor_auth_id uuid references auth.users(id) on delete set null,
  actor_person_id uuid references public.people(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists institute_roles_institute_status_idx
  on public.institute_roles (institute_id, status, role_key);
create index if not exists institute_role_permissions_permission_idx
  on public.institute_role_permissions (permission_code);
create index if not exists institute_membership_permission_overrides_permission_idx
  on public.institute_membership_permission_overrides (permission_code);
create index if not exists audit_logs_institute_created_idx
  on public.audit_logs (institute_id, created_at desc);
create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_auth_id, created_at desc);
create index if not exists audit_logs_scope_created_idx
  on public.audit_logs (scope, created_at desc);

drop trigger if exists institute_roles_set_updated_at on public.institute_roles;
create trigger institute_roles_set_updated_at before update on public.institute_roles
for each row execute function public.lg_platform_updated_at();

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at before update on public.platform_settings
for each row execute function public.lg_platform_updated_at();

alter table public.permissions enable row level security;
alter table public.institute_roles enable row level security;
alter table public.institute_role_permissions enable row level security;
alter table public.institute_membership_permission_overrides enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

insert into public.permissions (code, name, description) values
  ('institute.read_settings', 'View institute settings', 'Read institute identity, branding and configuration.'),
  ('institute.manage_settings', 'Manage institute settings', 'Change institute identity, branding and operational settings.'),
  ('people.read', 'View people', 'View people records within the institute.'),
  ('people.manage', 'Manage people', 'Create, update and deactivate institute people.'),
  ('students.read', 'View students', 'View student records and enrollments.'),
  ('students.manage', 'Manage students', 'Create, update and archive student records.'),
  ('teachers.read', 'View teachers', 'View teacher records and assignments.'),
  ('teachers.manage', 'Manage teachers', 'Create, update and archive teacher records.'),
  ('guardians.read', 'View guardians', 'View guardian profiles and links.'),
  ('guardians.manage', 'Manage guardians', 'Create and manage guardian links.'),
  ('academics.read', 'View academics', 'Read academic years, programs, batches and subjects.'),
  ('academics.manage', 'Manage academics', 'Create and manage academic structure.'),
  ('attendance.read', 'View attendance', 'Read attendance records within permitted scope.'),
  ('attendance.manage', 'Manage attendance', 'Create and correct attendance records.'),
  ('homework.read', 'View homework', 'Read homework within permitted academic scope.'),
  ('homework.manage', 'Manage homework', 'Create, edit and delete homework.'),
  ('materials.read', 'View materials', 'Read learning materials within permitted scope.'),
  ('materials.manage', 'Manage materials', 'Create and manage learning materials.'),
  ('assessments.read', 'View assessments', 'Read tests, exams and results.'),
  ('assessments.manage', 'Manage assessments', 'Create tests, exams and enter/update results.'),
  ('fees.read', 'View fees', 'Read fee records and statuses.'),
  ('fees.manage', 'Manage fees', 'Create, update and reconcile fee records.'),
  ('timetable.read', 'View timetable', 'Read timetable information.'),
  ('timetable.manage', 'Manage timetable', 'Create and manage timetable entries.'),
  ('announcements.read', 'View announcements', 'Read institute announcements.'),
  ('announcements.manage', 'Manage announcements', 'Create and manage announcements.'),
  ('reports.read', 'View reports', 'Read institute reports and analytics.'),
  ('domains.read', 'View domains', 'View institute portal domain configuration.'),
  ('domains.manage', 'Manage domains', 'Add, verify, disable and select portal domains.'),
  ('audit.read', 'View audit logs', 'Read audit events visible to institute administrators.')
on conflict (code) do update set name = excluded.name, description = excluded.description;

create or replace function public.seed_institute_defaults(p_institute_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.institute_roles (institute_id, role_key, name, description, is_system) values
    (p_institute_id, 'institute_owner', 'Institute Owner', 'Full control of this institute workspace.', true),
    (p_institute_id, 'institute_admin', 'Institute Admin', 'Administrative management of the institute.', true),
    (p_institute_id, 'academic_admin', 'Academic Admin', 'Academic structure, attendance and assessment administration.', true),
    (p_institute_id, 'teacher', 'Teacher', 'Teaching and assigned academic workflows.', true),
    (p_institute_id, 'accountant', 'Accountant', 'Institute fee and financial workflows.', true),
    (p_institute_id, 'receptionist', 'Receptionist', 'Front-office people and basic institute operations.', true),
    (p_institute_id, 'content_manager', 'Content Manager', 'Learning materials and announcements.', true),
    (p_institute_id, 'student', 'Student', 'Student self-service access.', true),
    (p_institute_id, 'parent', 'Parent', 'Parent access to linked student information.', true),
    (p_institute_id, 'staff', 'Staff', 'General staff access placeholder for legacy accounts.', true)
  on conflict (institute_id, role_key) do update
  set name = excluded.name, description = excluded.description, is_system = true, status = 'active', updated_at = now();

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r cross join public.permissions p
  where r.institute_id = p_institute_id and r.role_key = 'institute_owner' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r cross join public.permissions p
  where r.institute_id = p_institute_id and r.role_key = 'institute_admin' and p.code <> 'audit.read' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array[
    'institute.read_settings','people.read','students.read','teachers.read','guardians.read',
    'academics.read','academics.manage','attendance.read','attendance.manage','homework.read',
    'homework.manage','materials.read','materials.manage','assessments.read','assessments.manage',
    'timetable.read','timetable.manage','announcements.read','announcements.manage','reports.read'
  ])
  where r.institute_id = p_institute_id and r.role_key = 'academic_admin' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array[
    'students.read','attendance.read','attendance.manage','homework.read','homework.manage',
    'materials.read','materials.manage','assessments.read','assessments.manage','timetable.read',
    'announcements.read','reports.read'
  ])
  where r.institute_id = p_institute_id and r.role_key = 'teacher' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array['institute.read_settings','fees.read','fees.manage','reports.read'])
  where r.institute_id = p_institute_id and r.role_key = 'accountant' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array['people.read','students.read','guardians.read','announcements.read'])
  where r.institute_id = p_institute_id and r.role_key = 'receptionist' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array[
    'institute.read_settings','materials.read','materials.manage','announcements.read','announcements.manage','reports.read'
  ])
  where r.institute_id = p_institute_id and r.role_key = 'content_manager' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array[
    'institute.read_settings','timetable.read','attendance.read','homework.read','materials.read',
    'assessments.read','fees.read','announcements.read'
  ])
  where r.institute_id = p_institute_id and r.role_key = 'student' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array[
    'institute.read_settings','timetable.read','attendance.read','homework.read','materials.read',
    'assessments.read','fees.read','announcements.read','reports.read'
  ])
  where r.institute_id = p_institute_id and r.role_key = 'parent' on conflict do nothing;

  insert into public.institute_role_permissions (role_id, permission_code)
  select r.id, p.code from public.institute_roles r
  join public.permissions p on p.code = any(array[
    'people.read','students.read','teachers.read','academics.read','attendance.read','homework.read',
    'materials.read','assessments.read','fees.read','timetable.read','announcements.read','reports.read'
  ])
  where r.institute_id = p_institute_id and r.role_key = 'staff' on conflict do nothing;
end;
$$;

select public.seed_institute_defaults(id) from public.institutes;

alter table public.institute_memberships add column if not exists role_id uuid references public.institute_roles(id);
update public.institute_memberships m
set role_id = r.id from public.institute_roles r
where m.institute_id = r.institute_id and m.role = r.role_key and m.role_id is null;

create index if not exists institute_memberships_role_id_idx on public.institute_memberships (role_id, status);

create or replace function public.current_platform_roles()
returns table (role text) language sql stable security definer set search_path = public, pg_temp
as $$ select pm.role from public.platform_memberships pm where pm.auth_id = auth.uid() and pm.status = 'active' $$;

create or replace function public.is_platform_member()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.platform_memberships pm where pm.auth_id = auth.uid() and pm.status = 'active') $$;

create or replace function public.user_is_institute_member(p_institute_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.institute_memberships m join public.people p on p.id = m.person_id
    where m.institute_id = p_institute_id and m.status = 'active' and p.auth_id = auth.uid() and p.status = 'active'
  )
$$;

create or replace function public.user_has_institute_permission(p_institute_id uuid, p_permission_code text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.institute_memberships m
    join public.people p on p.id = m.person_id
    join public.institute_roles r on r.id = m.role_id
    where m.institute_id = p_institute_id
      and m.status = 'active'
      and p.auth_id = auth.uid()
      and p.status = 'active'
      and r.status = 'active'
      and (
        exists (select 1 from public.institute_role_permissions rp where rp.role_id = r.id and rp.permission_code = p_permission_code)
        or exists (
          select 1 from public.institute_membership_permission_overrides o
          where o.membership_id = m.id and o.permission_code = p_permission_code and o.effect = 'allow'
        )
      )
      and not exists (
        select 1 from public.institute_membership_permission_overrides o
        where o.membership_id = m.id and o.permission_code = p_permission_code and o.effect = 'deny'
      )
  );
$$;

revoke all on function public.seed_institute_defaults(uuid) from public, anon, authenticated;
revoke all on function public.current_platform_roles() from public, anon;
grant execute on function public.current_platform_roles() to authenticated;
revoke all on function public.is_platform_member() from public, anon;
grant execute on function public.is_platform_member() to authenticated;
revoke all on function public.user_is_institute_member(uuid) from public, anon;
grant execute on function public.user_is_institute_member(uuid) to authenticated;
revoke all on function public.user_has_institute_permission(uuid, text) from public, anon;
grant execute on function public.user_has_institute_permission(uuid, text) to authenticated;

drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions for select to authenticated using (true);

drop policy if exists institute_roles_member_read on public.institute_roles;
create policy institute_roles_member_read on public.institute_roles for select to authenticated
using (public.user_is_institute_member(institute_id) or public.is_platform_member());

drop policy if exists institute_role_permissions_member_read on public.institute_role_permissions;
create policy institute_role_permissions_member_read on public.institute_role_permissions for select to authenticated
using (exists (select 1 from public.institute_roles r where r.id = role_id and (public.user_is_institute_member(r.institute_id) or public.is_platform_member())));

drop policy if exists institute_membership_permission_overrides_member_read on public.institute_membership_permission_overrides;
create policy institute_membership_permission_overrides_member_read on public.institute_membership_permission_overrides for select to authenticated
using (exists (
  select 1 from public.institute_memberships m
  where m.id = membership_id and (public.user_is_institute_member(m.institute_id) or public.is_platform_member())
));

drop policy if exists platform_settings_platform_read on public.platform_settings;
create policy platform_settings_platform_read on public.platform_settings for select to authenticated using (public.is_platform_member());

drop policy if exists audit_logs_platform_or_institute_read on public.audit_logs;
create policy audit_logs_platform_or_institute_read on public.audit_logs for select to authenticated using (
  public.is_platform_member()
  or (institute_id is not null and public.user_has_institute_permission(institute_id, 'audit.read'))
);

drop policy if exists institutes_member_read on public.institutes;
create policy institutes_member_read on public.institutes for select to authenticated
using (public.user_is_institute_member(id) or public.is_platform_member());

drop policy if exists people_self_read on public.people;
create policy people_self_read on public.people for select to authenticated
using (auth_id = auth.uid() or public.is_platform_member());

drop policy if exists institute_memberships_self_or_platform_read on public.institute_memberships;
create policy institute_memberships_self_or_platform_read on public.institute_memberships for select to authenticated
using (
  public.is_platform_member()
  or exists (select 1 from public.people p where p.id = person_id and p.auth_id = auth.uid())
);

drop policy if exists institute_settings_member_read on public.institute_settings;
create policy institute_settings_member_read on public.institute_settings for select to authenticated
using (public.user_is_institute_member(institute_id) or public.is_platform_member());

drop policy if exists institute_domains_platform_read on public.institute_domains;
create policy institute_domains_platform_read on public.institute_domains for select to authenticated using (public.is_platform_member());

drop policy if exists platform_memberships_platform_read on public.platform_memberships;
create policy platform_memberships_platform_read on public.platform_memberships for select to authenticated using (public.is_platform_member());

comment on table public.permissions is 'Canonical tenant permission catalog.';
comment on table public.institute_roles is 'Tenant-local system and future custom roles.';
comment on table public.audit_logs is 'Audit stream for platform and institute operations.';

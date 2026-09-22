-- Phase 7: Notifications & Integrations Center.
-- Adds institute-scoped delivery configuration and notification defaults without
-- storing provider secrets in browser-readable tables.

create table if not exists public.institute_notification_integrations (
  institute_id uuid not null references public.institutes(id) on delete cascade,
  provider_code text not null check (provider_code in ('in_app','web_push','email','whatsapp','sms')),
  enabled boolean not null default false,
  secret_configured boolean not null default false,
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (institute_id, provider_code)
);

create table if not exists public.institute_notification_preferences (
  institute_id uuid not null references public.institutes(id) on delete cascade,
  role_key text not null,
  event_type text not null,
  in_app boolean not null default true,
  push boolean not null default false,
  email boolean not null default false,
  whatsapp boolean not null default false,
  sms boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (institute_id, role_key, event_type)
);

create index if not exists institute_notification_preferences_event_idx
  on public.institute_notification_preferences (institute_id, event_type, role_key);

alter table public.institute_notification_integrations enable row level security;
alter table public.institute_notification_preferences enable row level security;

insert into public.permissions(code,name,description) values
  ('notifications.read','View notification settings','View institute notification delivery and preference settings.'),
  ('notifications.manage','Manage notifications','Manage institute notification delivery and preference settings.'),
  ('integrations.read','View integrations','View configured communication integrations.'),
  ('integrations.manage','Manage integrations','Manage communication integration configuration and availability.')
on conflict (code) do update set name=excluded.name,description=excluded.description;

-- Existing system roles receive the new permissions through this additive baseline.
insert into public.institute_role_permissions(role_id,permission_code)
select r.id,p.code
from public.institute_roles r
join public.permissions p on p.code in ('notifications.read','notifications.manage','integrations.read','integrations.manage')
where r.role_key in ('institute_owner','institute_admin')
on conflict do nothing;

drop policy if exists institute_notification_integrations_read on public.institute_notification_integrations;
create policy institute_notification_integrations_read
on public.institute_notification_integrations
for select to authenticated
using (
  public.is_platform_member()
  or public.user_has_institute_permission(institute_id,'integrations.read')
);

drop policy if exists institute_notification_integrations_insert on public.institute_notification_integrations;
create policy institute_notification_integrations_insert
on public.institute_notification_integrations
for insert to authenticated
with check (
  public.user_has_institute_permission(institute_id,'integrations.manage')
);

drop policy if exists institute_notification_integrations_update on public.institute_notification_integrations;
create policy institute_notification_integrations_update
on public.institute_notification_integrations
for update to authenticated
using (public.user_has_institute_permission(institute_id,'integrations.manage'))
with check (public.user_has_institute_permission(institute_id,'integrations.manage'));

drop policy if exists institute_notification_integrations_delete on public.institute_notification_integrations;
create policy institute_notification_integrations_delete
on public.institute_notification_integrations
for delete to authenticated
using (public.user_has_institute_permission(institute_id,'integrations.manage'));

drop policy if exists institute_notification_preferences_read on public.institute_notification_preferences;
create policy institute_notification_preferences_read
on public.institute_notification_preferences
for select to authenticated
using (
  public.is_platform_member()
  or public.user_has_institute_permission(institute_id,'notifications.read')
);

drop policy if exists institute_notification_preferences_insert on public.institute_notification_preferences;
create policy institute_notification_preferences_insert
on public.institute_notification_preferences
for insert to authenticated
with check (public.user_has_institute_permission(institute_id,'notifications.manage'));

drop policy if exists institute_notification_preferences_update on public.institute_notification_preferences;
create policy institute_notification_preferences_update
on public.institute_notification_preferences
for update to authenticated
using (public.user_has_institute_permission(institute_id,'notifications.manage'))
with check (public.user_has_institute_permission(institute_id,'notifications.manage'));

drop policy if exists institute_notification_preferences_delete on public.institute_notification_preferences;
create policy institute_notification_preferences_delete
on public.institute_notification_preferences
for delete to authenticated
using (public.user_has_institute_permission(institute_id,'notifications.manage'));

-- Seed every existing and future tenant with explicit channel records.
insert into public.institute_notification_integrations(institute_id,provider_code,enabled,secret_configured,display_name,config)
select i.id,x.provider_code,x.enabled,x.secret_configured,x.display_name,x.config
from public.institutes i
cross join (values
  ('in_app',true,true,'In-app notifications','{}'::jsonb),
  ('web_push',true,true,'Browser push','{}'::jsonb),
  ('email',false,false,'Email','{}'::jsonb),
  ('whatsapp',false,false,'WhatsApp','{}'::jsonb),
  ('sms',false,false,'SMS','{}'::jsonb)
) x(provider_code,enabled,secret_configured,display_name,config)
on conflict (institute_id,provider_code) do nothing;

-- Seed current event types with safe defaults. Provider credentials are never
-- placed in this table.
insert into public.institute_notification_preferences(institute_id,role_key,event_type,in_app,push,email,whatsapp,sms)
select i.id,r.role_key,e.event_type,
       true,
       case when e.event_type in ('announcement','homework','material','attendance','timetable','message') then true else false end,
       false,false,false
from public.institutes i
cross join (values ('student'),('parent'),('teacher'),('admin')) r(role_key)
cross join (values ('announcement'),('homework'),('material'),('attendance'),('timetable'),('message')) e(event_type)
on conflict (institute_id,role_key,event_type) do nothing;

-- New tenants created through the protected provisioning RPC also get the same
-- baseline configuration.
create or replace function public.seed_institute_defaults(p_institute_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $
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
  insert into public.institute_notification_integrations(institute_id,provider_code,enabled,secret_configured,display_name,config)
  select p_institute_id,x.provider_code,x.enabled,x.secret_configured,x.display_name,x.config
  from (values
    ('in_app',true,true,'In-app notifications','{}'::jsonb),
    ('web_push',true,true,'Browser push','{}'::jsonb),
    ('email',false,false,'Email','{}'::jsonb),
    ('whatsapp',false,false,'WhatsApp','{}'::jsonb),
    ('sms',false,false,'SMS','{}'::jsonb)
  ) x(provider_code,enabled,secret_configured,display_name,config)
  on conflict (institute_id,provider_code) do nothing;

  insert into public.institute_notification_preferences(institute_id,role_key,event_type,in_app,push,email,whatsapp,sms)
  select p_institute_id,r.role_key,e.event_type,true,true,false,false,false
  from (values ('student'),('parent'),('teacher'),('admin')) r(role_key)
  cross join (values ('announcement'),('homework'),('material'),('attendance'),('timetable'),('message')) e(event_type)
  on conflict (institute_id,role_key,event_type) do nothing;
end;
$;

revoke all on function public.seed_institute_defaults(uuid) from public, anon, authenticated;

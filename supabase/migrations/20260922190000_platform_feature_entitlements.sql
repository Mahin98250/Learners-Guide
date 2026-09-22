-- Platform feature entitlements: tenant-level module switches managed only by the
-- authenticated, MFA-verified platform owner.
--
-- This is intentionally additive. Existing institutes are seeded with every
-- currently supported feature enabled so no existing workflow is disabled.

create table if not exists public.platform_features (
  code text primary key,
  name text not null,
  description text not null,
  category text not null default 'core',
  sort_order integer not null default 100,
  depends_on text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institute_feature_entitlements (
  institute_id uuid not null references public.institutes(id) on delete cascade,
  feature_code text not null references public.platform_features(code) on delete cascade,
  enabled boolean not null default true,
  configured_at timestamptz not null default now(),
  configured_by uuid references auth.users(id) on delete set null,
  primary key (institute_id, feature_code)
);

create index if not exists institute_feature_entitlements_feature_idx
  on public.institute_feature_entitlements (feature_code, enabled);

alter table public.platform_features enable row level security;
alter table public.institute_feature_entitlements enable row level security;

insert into public.platform_features(code,name,description,category,sort_order,depends_on) values
  ('students','Students','Student records, enrollment and student profiles.','core',10,'{}'),
  ('teachers','Teachers','Teacher records, assignments and staff teaching workflows.','core',20,'{}'),
  ('academics','Academics','Academic years, batches, subjects and academic structure.','core',30,'{}'),
  ('guardians','Guardians','Parent/guardian profiles and student relationships.','core',40,'{students}'),
  ('attendance','Attendance','Daily attendance, corrections and attendance reporting.','operations',50,'{students,academics}'),
  ('homework','Homework','Homework creation, tracking and student submission workflows.','learning',60,'{students,academics}'),
  ('materials','Materials','Learning material folders and resources.','learning',70,'{academics}'),
  ('assessments','Assessments','Tests, exams, marks and results.','learning',80,'{students,academics}'),
  ('timetable','Timetable','Class schedules, rooms and timetable entries.','operations',90,'{academics}'),
  ('fees','Fees','Fee records, balances and payment status workflows.','finance',100,'{students}'),
  ('announcements','Announcements','Institute announcements and communications.','communication',110,'{}'),
  ('reports','Reports','Institute analytics and operational reports.','analytics',120,'{}'),
  ('notifications','Notifications','In-app notification delivery and notification preferences.','communication',130,'{}'),
  ('parent_portal','Parent Portal','Parent access to linked student information.','portals',140,'{students,guardians}')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  sort_order = excluded.sort_order,
  depends_on = excluded.depends_on,
  status = excluded.status,
  updated_at = now();

insert into public.institute_feature_entitlements (institute_id, feature_code, enabled)
select i.id, f.code, true
from public.institutes i
cross join public.platform_features f
where f.status = 'active'
on conflict (institute_id, feature_code) do nothing;

drop policy if exists platform_features_authenticated_read on public.platform_features;
create policy platform_features_authenticated_read on public.platform_features
for select to authenticated using (status = 'active');

drop policy if exists institute_feature_entitlements_platform_read on public.institute_feature_entitlements;
create policy institute_feature_entitlements_platform_read on public.institute_feature_entitlements
for select to authenticated using (public.is_platform_member());

create or replace function public.institute_feature_enabled(
  p_institute_id uuid,
  p_feature_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.institute_feature_entitlements e
    join public.platform_features f on f.code = e.feature_code
    where e.institute_id = p_institute_id
      and e.feature_code = lower(trim(p_feature_code))
      and e.enabled = true
      and f.status = 'active'
  );
$$;

revoke all on function public.institute_feature_enabled(uuid,text) from public, anon;
grant execute on function public.institute_feature_enabled(uuid,text) to authenticated;

create or replace function public.platform_set_feature_enabled(
  p_institute_id uuid,
  p_feature_code text,
  p_enabled boolean
)
returns public.institute_feature_entitlements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := lower(trim(p_feature_code));
  v_row public.institute_feature_entitlements;
  v_dependency text;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;

  if not exists (
    select 1 from public.institutes
    where id = p_institute_id and status <> 'archived'
  ) then
    raise exception 'Institute not found';
  end if;

  if not exists (
    select 1 from public.platform_features
    where code = v_code and status = 'active'
  ) then
    raise exception 'Feature not found';
  end if;

  if p_enabled then
    foreach v_dependency in array (
      select depends_on from public.platform_features where code = v_code
    ) loop
      if not public.institute_feature_enabled(p_institute_id, v_dependency) then
        raise exception 'Enable dependency "%" before enabling feature "%"', v_dependency, v_code;
      end if;
    end loop;
  else
    if exists (
      select 1
      from public.platform_features f
      join public.institute_feature_entitlements e
        on e.feature_code = f.code and e.institute_id = p_institute_id and e.enabled
      where v_code = any(f.depends_on)
    ) then
      raise exception 'Disable dependent features before disabling "%"', v_code;
    end if;
  end if;

  insert into public.institute_feature_entitlements(
    institute_id, feature_code, enabled, configured_at, configured_by
  )
  values (
    p_institute_id, v_code, p_enabled, now(), auth.uid()
  )
  on conflict (institute_id, feature_code) do update
    set enabled = excluded.enabled,
        configured_at = now(),
        configured_by = auth.uid()
  returning * into v_row;

  insert into public.audit_logs(
    scope, institute_id, actor_auth_id, action, entity_type, entity_id, summary, metadata
  )
  values(
    'platform',
    p_institute_id,
    auth.uid(),
    case when p_enabled then 'feature.enabled' else 'feature.disabled' end,
    'institute_feature_entitlement',
    p_institute_id::text || ':' || v_code,
    case when p_enabled then 'Institute feature enabled.' else 'Institute feature disabled.' end,
    jsonb_build_object('feature_code', v_code, 'enabled', p_enabled)
  );

  return v_row;
end;
$$;

revoke all on function public.platform_set_feature_enabled(uuid,text,boolean) from public, anon;
grant execute on function public.platform_set_feature_enabled(uuid,text,boolean) to authenticated;

-- Extend the protected institute provisioning transaction so newly-created
-- tenants receive the same no-surprise baseline as existing tenants.
create or replace function public.create_institute(
  p_name text,
  p_slug text,
  p_timezone text default 'Asia/Kolkata',
  p_locale text default 'en-IN'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_slug text;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;

  v_slug := lower(trim(p_slug));
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid institute slug';
  end if;
  if length(trim(p_name)) < 2 or length(trim(p_name)) > 180 then
    raise exception 'Invalid institute name';
  end if;

  insert into public.institutes (name, slug, status)
  values (trim(p_name), v_slug, 'trial')
  returning id into v_id;

  insert into public.institute_settings (institute_id, display_name, short_name, timezone, locale)
  values (
    v_id, trim(p_name), trim(p_name),
    coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata'),
    coalesce(nullif(trim(p_locale),''),'en-IN')
  );

  perform public.seed_institute_defaults(v_id);

  insert into public.institute_feature_entitlements (institute_id, feature_code, enabled)
  select v_id, f.code, true
  from public.platform_features f
  where f.status = 'active'
  on conflict (institute_id, feature_code) do nothing;

  insert into public.audit_logs (
    scope, institute_id, actor_auth_id, action, entity_type, entity_id, summary, metadata
  )
  values (
    'platform', v_id, auth.uid(), 'institute.created', 'institute', v_id::text,
    'Institute created from the platform control center.',
    jsonb_build_object('name', trim(p_name), 'slug', v_slug)
  );

  return v_id;
end;
$$;

revoke all on function public.create_institute(text,text,text,text) from public, anon;
grant execute on function public.create_institute(text,text,text,text) to authenticated;

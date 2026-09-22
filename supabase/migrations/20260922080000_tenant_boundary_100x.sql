-- Multi-tenant 100X hardening.
--
-- Goal:
--   1. Keep the one-codebase / one-database architecture.
--   2. Make institute_id an authoritative tenant boundary for education data.
--   3. Preserve existing role-specific policies while adding a restrictive
--      tenant policy that composes with them using AND semantics.
--   4. Automatically stamp a single-institute authenticated user's writes
--      when the client does not explicitly provide institute_id.
--
-- Supabase/Postgres support restrictive RLS policies. Existing permissive
-- policies remain responsible for role-specific access; the restrictive
-- policy below is the tenant boundary they cannot bypass.

create or replace function public.current_single_institute_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when count(*) = 1 then min(m.institute_id) else null end
  from public.institute_memberships m
  join public.people p on p.id = m.person_id
  where p.auth_id = auth.uid()
    and p.status = 'active'
    and m.status = 'active';
$$;

revoke all on function public.current_single_institute_id() from public, anon;
grant execute on function public.current_single_institute_id() to authenticated;

create or replace function public.set_and_validate_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_single uuid;
begin
  -- Trusted server-side jobs / service-role work can supply the tenant
  -- explicitly and bypass this authenticated-user defaulting path.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_platform_member() then
    if new.institute_id is null then
      raise exception 'Institute context is required for platform writes';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' and new.institute_id is null then
    v_single := public.current_single_institute_id();
    if v_single is null then
      raise exception 'Institute context is required. Select an institute before creating data.';
    end if;
    new.institute_id := v_single;
  end if;

  if new.institute_id is null then
    raise exception 'Institute context is required.';
  end if;

  if not public.user_is_institute_member(new.institute_id) then
    raise exception 'You do not belong to the selected institute.';
  end if;

  if tg_op = 'UPDATE' and old.institute_id is distinct from new.institute_id then
    raise exception 'Tenant cannot be changed on an existing record.';
  end if;

  return new;
end;
$$;

revoke all on function public.set_and_validate_tenant_id() from public, anon, authenticated;

do $$
declare
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
  foreach v_table in array v_tables loop
    execute format('alter table public.%I alter column institute_id set not null', v_table);

    execute format('drop policy if exists tenant_scope_%I on public.%I', v_table, v_table);
    execute format(
      'create policy tenant_scope_%I on public.%I as restrictive for all to authenticated using ((select public.user_is_institute_member(institute_id)) or (select public.is_platform_member())) with check ((select public.user_is_institute_member(institute_id)) or (select public.is_platform_member()))',
      v_table,
      v_table
    );

    execute format('drop trigger if exists tenant_stamp_%I on public.%I', v_table, v_table);
    execute format(
      'create trigger tenant_stamp_%I before insert or update on public.%I for each row execute function public.set_and_validate_tenant_id()',
      v_table,
      v_table
    );
  end loop;
end $$;

comment on function public.current_single_institute_id() is
  'Returns the active institute UUID when the authenticated person belongs to exactly one institute.';
comment on function public.set_and_validate_tenant_id() is
  'Tenant boundary trigger: stamps single-institute writes and prevents cross-institute moves for authenticated callers.';

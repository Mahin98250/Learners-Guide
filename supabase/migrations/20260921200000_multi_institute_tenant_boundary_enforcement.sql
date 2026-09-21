-- Multi-institute Phase 3B: enforce a hard tenant boundary while preserving legacy feature policies.

create or replace function public.enforce_institute_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership_count integer;
  v_membership_id uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.institute_id is null then
    select count(*), min(m.institute_id)
    into v_membership_count, v_membership_id
    from public.institute_memberships m
    join public.people p on p.id = m.person_id
    where p.auth_id = auth.uid()
      and p.status = 'active'
      and m.status = 'active';

    if v_membership_count = 1 then
      new.institute_id := v_membership_id;
    elsif v_membership_count > 1 then
      raise exception 'institute_id is required when the account belongs to multiple institutes';
    end if;
  end if;

  if new.institute_id is null then
    return new;
  end if;

  if public.is_platform_member() then
    return new;
  end if;

  if not public.user_is_institute_member(new.institute_id) then
    raise exception 'You are not a member of this institute';
  end if;

  if tg_op = 'UPDATE'
     and old.institute_id is not null
     and new.institute_id is distinct from old.institute_id then
    raise exception 'Changing an existing row between institutes is not permitted';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_institute_row() from public, anon, authenticated;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'academic_years','announcements','attendance','batch_students','batch_teachers',
    'batches','examschedule','fees','homework','leave_requests','marks',
    'material_folders','materials','messages','notifications','parent_student_links',
    'rooms','students','subjects','teachers','test_results','tests','timetable',
    'timetable_entries'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('drop trigger if exists %I on public.%I',
      'enforce_' || v_table || '_institute', v_table);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.enforce_institute_row()',
      'enforce_' || v_table || '_institute', v_table);

    execute format('drop policy if exists %I on public.%I',
      'tenant_boundary_' || v_table, v_table);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (public.user_is_institute_member(institute_id) or public.is_platform_member()) with check (public.user_is_institute_member(institute_id) or public.is_platform_member())',
      'tenant_boundary_' || v_table, v_table);

    execute format('create index if not exists %I on public.%I (institute_id)',
      'idx_' || v_table || '_institute_id', v_table);
  end loop;
end $$;

create or replace function public.assign_institute_membership(
  p_institute_id uuid,
  p_person_id uuid,
  p_role_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid;
  v_membership_id uuid;
begin
  if not public.is_platform_member() then
    raise exception 'Platform membership required';
  end if;

  select id into v_role_id
  from public.institute_roles
  where institute_id = p_institute_id
    and role_key = lower(trim(p_role_key))
    and status = 'active';

  if v_role_id is null then
    raise exception 'Institute role not found';
  end if;

  if not exists (
    select 1 from public.people
    where id = p_person_id
      and status in ('active','invited')
  ) then
    raise exception 'Person not found';
  end if;

  insert into public.institute_memberships (institute_id, person_id, role, role_id, status)
  values (p_institute_id, p_person_id, lower(trim(p_role_key)), v_role_id, 'active')
  on conflict (institute_id, person_id) do update
  set role = excluded.role,
      role_id = excluded.role_id,
      status = 'active',
      updated_at = now()
  returning id into v_membership_id;

  insert into public.audit_logs (
    scope, institute_id, actor_auth_id, actor_person_id,
    action, entity_type, entity_id, summary, metadata
  )
  values (
    'platform', p_institute_id, auth.uid(), public.current_person_id(),
    'membership.assigned', 'institute_membership', v_membership_id::text,
    'Institute membership assigned from the platform control center.',
    jsonb_build_object('person_id', p_person_id, 'role', lower(trim(p_role_key)))
  );

  return v_membership_id;
end;
$$;

revoke all on function public.assign_institute_membership(uuid, uuid, text) from public, anon;
grant execute on function public.assign_institute_membership(uuid, uuid, text) to authenticated;

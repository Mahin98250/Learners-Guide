-- Multi-institute Phase 4: tenant-scoped account membership synchronization.
-- Keeps legacy auth provisioning intact while making the resulting identity/membership tenant-aware.

create or replace function public.sync_institute_account_membership(
  p_institute_id uuid,
  p_auth_id uuid,
  p_role_key text,
  p_name text,
  p_email text,
  p_phone text,
  p_ref text default null
)
returns table (person_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_person_id uuid;
  v_caller_membership_id uuid;
  v_caller_role_id uuid;
  v_required_permission text;
  v_role_id uuid;
  v_person_id uuid;
  v_membership_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  p_role_key := lower(trim(p_role_key));
  if p_role_key not in ('student','parent','teacher') then raise exception 'Unsupported institute account role'; end if;
  v_required_permission := case when p_role_key = 'teacher' then 'teachers.manage' else 'students.manage' end;

  if not exists (select 1 from public.institutes where id = p_institute_id and status <> 'archived') then
    raise exception 'Institute not found';
  end if;

  select p.id, m.id, m.role_id into v_caller_person_id, v_caller_membership_id, v_caller_role_id
  from public.people p
  join public.institute_memberships m on m.person_id = p.id
  where p.auth_id = auth.uid() and p.status = 'active'
    and m.institute_id = p_institute_id and m.status = 'active'
  limit 1;
  if v_caller_person_id is null then raise exception 'Administrator is not assigned to this institute'; end if;

  if (
    not exists (select 1 from public.institute_role_permissions rp where rp.role_id = v_caller_role_id and rp.permission_code = v_required_permission)
    and not exists (select 1 from public.institute_membership_permission_overrides o where o.membership_id = v_caller_membership_id and o.permission_code = v_required_permission and o.effect = 'allow')
  ) or exists (
    select 1 from public.institute_membership_permission_overrides o where o.membership_id = v_caller_membership_id and o.permission_code = v_required_permission and o.effect = 'deny'
  ) then
    raise exception 'You do not have permission to manage this institute account';
  end if;

  select id into v_role_id from public.institute_roles
  where institute_id = p_institute_id and role_key = p_role_key and status = 'active'
  limit 1;
  if v_role_id is null then raise exception 'Institute role % is not configured', p_role_key; end if;

  select id into v_person_id from public.people where auth_id = p_auth_id limit 1;
  if v_person_id is null then
    insert into public.people (auth_id, display_name, email, phone, status)
    values (p_auth_id, nullif(trim(p_name), ''), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), 'active')
    returning id into v_person_id;
  else
    update public.people set display_name = nullif(trim(p_name), ''), email = nullif(trim(p_email), ''),
      phone = nullif(trim(p_phone), ''), status = 'active', updated_at = now()
    where id = v_person_id;
  end if;

  insert into public.institute_memberships (institute_id, person_id, role, role_id, status)
  values (p_institute_id, v_person_id, p_role_key, v_role_id, 'active')
  on conflict (institute_id, person_id) do update
    set role = excluded.role, role_id = excluded.role_id, status = 'active', updated_at = now()
  returning id into v_membership_id;

  if p_role_key = 'parent' and nullif(trim(p_ref), '') is not null then
    update public.parent_student_links
      set status = 'active', institute_id = p_institute_id
    where parent_auth_id = p_auth_id
      and student_id = trim(p_ref)
      and institute_id is null;

    if not found then
      insert into public.parent_student_links (parent_auth_id, student_id, status, institute_id)
      values (p_auth_id, trim(p_ref), 'active', p_institute_id)
      on conflict (parent_auth_id, student_id) do update
        set status = 'active', institute_id = excluded.institute_id;
    end if;
  end if;

  insert into public.audit_logs (
    scope, institute_id, actor_auth_id, actor_person_id, action, entity_type, entity_id, summary, metadata
  ) values (
    'institute', p_institute_id, auth.uid(), v_caller_person_id,
    'membership.account_synchronized', 'institute_membership', v_membership_id::text,
    'Tenant identity and membership synchronized after legacy authentication provisioning.',
    jsonb_build_object('auth_id', p_auth_id, 'role', p_role_key, 'ref', p_ref)
  );

  return query select v_person_id, v_membership_id;
end;
$$;

revoke all on function public.sync_institute_account_membership(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.sync_institute_account_membership(uuid, uuid, text, text, text, text, text) to authenticated;

create or replace function public.remove_institute_account_membership(
  p_institute_id uuid,
  p_auth_id uuid,
  p_role_key text
)
returns table (membership_removed boolean, remaining_memberships integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_person_id uuid;
  v_caller_membership_id uuid;
  v_caller_role_id uuid;
  v_required_permission text;
  v_person_id uuid;
  v_membership_id uuid;
  v_remaining integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  p_role_key := lower(trim(p_role_key));
  if p_role_key not in ('student','parent','teacher') then raise exception 'Unsupported institute account role'; end if;
  v_required_permission := case when p_role_key = 'teacher' then 'teachers.manage' else 'students.manage' end;

  select p.id, m.id, m.role_id into v_caller_person_id, v_caller_membership_id, v_caller_role_id
  from public.people p
  join public.institute_memberships m on m.person_id = p.id
  where p.auth_id = auth.uid() and p.status = 'active'
    and m.institute_id = p_institute_id and m.status = 'active'
  limit 1;
  if v_caller_person_id is null then raise exception 'Administrator is not assigned to this institute'; end if;

  if (
    not exists (select 1 from public.institute_role_permissions rp where rp.role_id = v_caller_role_id and rp.permission_code = v_required_permission)
    and not exists (select 1 from public.institute_membership_permission_overrides o where o.membership_id = v_caller_membership_id and o.permission_code = v_required_permission and o.effect = 'allow')
  ) or exists (
    select 1 from public.institute_membership_permission_overrides o where o.membership_id = v_caller_membership_id and o.permission_code = v_required_permission and o.effect = 'deny'
  ) then
    raise exception 'You do not have permission to manage this institute account';
  end if;

  select p.id into v_person_id from public.people p where p.auth_id = p_auth_id limit 1;
  if v_person_id is null then return query select false, 0; return; end if;

  select id into v_membership_id from public.institute_memberships
  where institute_id = p_institute_id and person_id = v_person_id and role = p_role_key and status = 'active'
  limit 1;

  if v_membership_id is null then
    select count(*)::integer into v_remaining from public.institute_memberships where person_id = v_person_id and status = 'active';
    return query select false, v_remaining;
    return;
  end if;

  update public.institute_memberships set status = 'removed', updated_at = now() where id = v_membership_id;
  select count(*)::integer into v_remaining from public.institute_memberships where person_id = v_person_id and status = 'active';

  insert into public.audit_logs (
    scope, institute_id, actor_auth_id, actor_person_id, action, entity_type, entity_id, summary, metadata
  ) values (
    'institute', p_institute_id, auth.uid(), v_caller_person_id,
    'membership.removed', 'institute_membership', v_membership_id::text,
    'Tenant account membership removed.',
    jsonb_build_object('auth_id', p_auth_id, 'role', p_role_key, 'remaining_memberships', v_remaining)
  );

  return query select true, v_remaining;
end;
$$;

revoke all on function public.remove_institute_account_membership(uuid, uuid, text) from public, anon;
grant execute on function public.remove_institute_account_membership(uuid, uuid, text) to authenticated;

comment on function public.sync_institute_account_membership(uuid, uuid, text, text, text, text, text) is 'Synchronize a provisioned legacy auth account into the selected institute identity and membership model.';
comment on function public.remove_institute_account_membership(uuid, uuid, text) is 'Remove only the selected institute membership before deciding whether a legacy auth account can be deleted.';

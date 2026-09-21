-- Fix membership removal state to a value allowed by the current status constraint.
-- This is intentionally a no-data-loss correction: only the terminal status value
-- is changed from the invalid legacy value "removed" to the existing "revoked".
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
  if p_auth_id = auth.uid() then raise exception 'You cannot remove your own institute membership through this workflow'; end if;
  p_role_key := lower(trim(p_role_key));
  if p_role_key not in ('student','parent','teacher') then raise exception 'Unsupported institute account role'; end if;
  v_required_permission := case when p_role_key = 'teacher' then 'teachers.manage' else 'students.manage' end;
  select p.id, m.id, m.role_id into v_caller_person_id, v_caller_membership_id, v_caller_role_id
  from public.people p join public.institute_memberships m on m.person_id = p.id
  where p.auth_id = auth.uid() and p.status = 'active' and m.institute_id = p_institute_id and m.status = 'active' limit 1;
  if v_caller_person_id is null then raise exception 'Administrator is not assigned to this institute'; end if;
  if (
    not exists (select 1 from public.institute_role_permissions rp where rp.role_id = v_caller_role_id and rp.permission_code = v_required_permission)
    and not exists (select 1 from public.institute_membership_permission_overrides o where o.membership_id = v_caller_membership_id and o.permission_code = v_required_permission and o.effect = 'allow')
  ) or exists (
    select 1 from public.institute_membership_permission_overrides o where o.membership_id = v_caller_membership_id and o.permission_code = v_required_permission and o.effect = 'deny'
  ) then raise exception 'You do not have permission to manage this institute account'; end if;
  select p.id into v_person_id from public.people p where p.auth_id = p_auth_id limit 1;
  if v_person_id is null then return query select false, 0; return; end if;
  select id into v_membership_id from public.institute_memberships where institute_id = p_institute_id and person_id = v_person_id and role = p_role_key and status = 'active' limit 1;
  if v_membership_id is null then
    select count(*)::integer into v_remaining from public.institute_memberships where person_id = v_person_id and status = 'active';
    return query select false, v_remaining; return;
  end if;
  update public.institute_memberships set status = 'revoked', updated_at = now() where id = v_membership_id;
  select count(*)::integer into v_remaining from public.institute_memberships where person_id = v_person_id and status = 'active';
  insert into public.audit_logs (scope, institute_id, actor_auth_id, actor_person_id, action, entity_type, entity_id, summary, metadata)
  values ('institute', p_institute_id, auth.uid(), v_caller_person_id, 'membership.removed', 'institute_membership', v_membership_id::text,
    'Tenant account membership removed.',
    jsonb_build_object('auth_id', p_auth_id, 'role', p_role_key, 'remaining_memberships', v_remaining));
  return query select true, v_remaining;
end;
$$;


create or replace function public.platform_remove_institute_membership(
  p_institute_id uuid, p_person_id uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_membership_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.platform_memberships pm where pm.auth_id=(select auth.uid()) and pm.status='active') then raise exception 'Platform membership required'; end if;
  select im.id into v_membership_id from public.institute_memberships im where im.institute_id=p_institute_id and im.person_id=p_person_id and im.status='active' limit 1;
  if v_membership_id is null then return false; end if;
  update public.institute_memberships set status='revoked',updated_at=now() where id=v_membership_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'membership.removed','institute_membership',v_membership_id::text,'Platform operator removed an institute membership.',jsonb_build_object('person_id',p_person_id));
  return true;
end;
$$;


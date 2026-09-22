-- Phase 1: People & Roles Control Center.
-- Platform-owner-only mutations for institute membership, custom roles and permissions.

create or replace function public.platform_assign_institute_membership(
  p_institute_id uuid, p_person_id uuid, p_role_key text
)
returns table (membership_id uuid, institute_id uuid, person_id uuid, role_key text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_role_id uuid;
  v_membership_id uuid;
  v_current_role text;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;

  p_role_key := lower(trim(p_role_key));
  if not exists (select 1 from public.institutes i where i.id=p_institute_id and i.status<>'archived') then
    raise exception 'Institute not found';
  end if;
  if not exists (select 1 from public.people p where p.id=p_person_id and p.status='active') then
    raise exception 'Person not found or inactive';
  end if;

  select ir.id into v_role_id
  from public.institute_roles ir
  where ir.institute_id=p_institute_id and ir.role_key=p_role_key and ir.status='active'
  limit 1;
  if v_role_id is null then raise exception 'Institute role % is not configured', p_role_key; end if;

  select im.role into v_current_role
  from public.institute_memberships im
  where im.institute_id=p_institute_id and im.person_id=p_person_id
  limit 1;

  if v_current_role='institute_owner'
     and p_role_key <> 'institute_owner'
     and (select count(*) from public.institute_memberships im
          where im.institute_id=p_institute_id
            and im.role='institute_owner'
            and im.status='active') <= 1 then
    raise exception 'The last institute owner cannot be demoted';
  end if;

  insert into public.institute_memberships(institute_id,person_id,role,role_id,status)
  values(p_institute_id,p_person_id,p_role_key,v_role_id,'active')
  on conflict(institute_id,person_id) do update
    set role=excluded.role,role_id=excluded.role_id,status='active',updated_at=now()
  returning id into v_membership_id;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'membership.role_changed','institute_membership',
    v_membership_id::text,'Institute membership role assigned from the People & Roles control center.',
    jsonb_build_object('person_id',p_person_id,'role',p_role_key));

  return query select v_membership_id,p_institute_id,p_person_id,p_role_key;
end;
$function$;

create or replace function public.platform_set_institute_membership_status(
  p_institute_id uuid, p_person_id uuid, p_status text
)
returns public.institute_memberships
language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.institute_memberships;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
  if p_status not in ('active','suspended','revoked') then
    raise exception 'Invalid membership status';
  end if;

  select im.* into v_row
  from public.institute_memberships im
  where im.institute_id=p_institute_id and im.person_id=p_person_id
  limit 1;
  if v_row.id is null then raise exception 'Membership not found'; end if;

  if v_row.role='institute_owner'
     and p_status <> 'active'
     and (select count(*) from public.institute_memberships im
          where im.institute_id=p_institute_id
            and im.role='institute_owner'
            and im.status='active') <= 1 then
    raise exception 'The last institute owner cannot be disabled';
  end if;

  update public.institute_memberships
     set status=p_status, updated_at=now()
   where id=v_row.id
   returning * into v_row;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'membership.status_changed','institute_membership',
    v_row.id::text,'Institute membership status changed from the People & Roles control center.',
    jsonb_build_object('person_id',p_person_id,'status',p_status));

  return v_row;
end;
$function$;

create or replace function public.platform_create_institute_role(
  p_institute_id uuid, p_role_key text, p_name text, p_description text default null
)
returns public.institute_roles
language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.institute_roles;
  v_key text := lower(trim(p_role_key));
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  if not exists (select 1 from public.institutes where id=p_institute_id and status<>'archived') then raise exception 'Institute not found'; end if;
  if v_key !~ '^[a-z][a-z0-9_]{2,48}$' then raise exception 'Invalid role key'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 100 then raise exception 'Invalid role name'; end if;
  if exists (select 1 from public.institute_roles where institute_id=p_institute_id and role_key=v_key) then raise exception 'Role key already exists'; end if;

  insert into public.institute_roles(institute_id,role_key,name,description,is_system,status)
  values(p_institute_id,v_key,trim(p_name),nullif(trim(coalesce(p_description,'')),''),false,'active')
  returning * into v_row;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'role.created','institute_role',v_row.id::text,
    'Custom institute role created.',jsonb_build_object('role_key',v_key,'name',v_row.name));

  return v_row;
end;
$function$;

create or replace function public.platform_set_role_permission(
  p_role_id uuid, p_permission_code text, p_enabled boolean
)
returns boolean
language plpgsql security definer set search_path = ''
as $function$
declare
  v_role public.institute_roles;
  v_code text := lower(trim(p_permission_code));
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;

  select r.* into v_role from public.institute_roles r where r.id=p_role_id;
  if v_role.id is null then raise exception 'Role not found'; end if;
  if v_role.is_system then raise exception 'System role permissions are managed by the platform baseline'; end if;
  if not exists (select 1 from public.permissions where code=v_code) then raise exception 'Permission not found'; end if;

  if p_enabled then
    insert into public.institute_role_permissions(role_id,permission_code)
    values(p_role_id,v_code) on conflict do nothing;
  else
    delete from public.institute_role_permissions
    where role_id=p_role_id and permission_code=v_code;
  end if;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_role.institute_id,(select auth.uid()),
    case when p_enabled then 'role.permission.granted' else 'role.permission.revoked' end,
    'institute_role',p_role_id::text,'Custom role permission changed.',
    jsonb_build_object('role_key',v_role.role_key,'permission_code',v_code,'enabled',p_enabled));

  return p_enabled;
end;
$function$;

create or replace function public.platform_archive_institute_role(p_role_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $function$
declare
  v_role public.institute_roles;
  v_members integer;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  select r.* into v_role from public.institute_roles r where r.id=p_role_id;
  if v_role.id is null then raise exception 'Role not found'; end if;
  if v_role.is_system then raise exception 'System roles cannot be archived'; end if;

  select count(*) into v_members from public.institute_memberships
  where role_id=p_role_id and status='active';
  if v_members > 0 then raise exception 'Reassign active members before archiving this role'; end if;

  update public.institute_roles set status='archived',updated_at=now() where id=p_role_id;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_role.institute_id,(select auth.uid()),'role.archived','institute_role',p_role_id::text,
    'Custom institute role archived.',jsonb_build_object('role_key',v_role.role_key));

  return true;
end;
$function$;

revoke all on function public.platform_assign_institute_membership(uuid,uuid,text) from public,anon;
revoke all on function public.platform_set_institute_membership_status(uuid,uuid,text) from public,anon;
revoke all on function public.platform_create_institute_role(uuid,text,text,text) from public,anon;
revoke all on function public.platform_set_role_permission(uuid,text,boolean) from public,anon;
revoke all on function public.platform_archive_institute_role(uuid) from public,anon;

grant execute on function public.platform_assign_institute_membership(uuid,uuid,text) to authenticated;
grant execute on function public.platform_set_institute_membership_status(uuid,uuid,text) to authenticated;
grant execute on function public.platform_create_institute_role(uuid,text,text,text) to authenticated;
grant execute on function public.platform_set_role_permission(uuid,text,boolean) to authenticated;
grant execute on function public.platform_archive_institute_role(uuid) to authenticated;

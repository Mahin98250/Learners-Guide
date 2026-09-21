-- Multi-institute Phase 5: platform-controlled institute membership administration.
create or replace function public.platform_assign_institute_membership(
  p_institute_id uuid, p_person_id uuid, p_role_key text
)
returns table (membership_id uuid, institute_id uuid, person_id uuid, role_key text)
language plpgsql security definer set search_path = ''
as $$
declare v_role_id uuid; v_membership_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.platform_memberships pm where pm.auth_id=(select auth.uid()) and pm.status='active') then raise exception 'Platform membership required'; end if;
  p_role_key := lower(trim(p_role_key));
  if not exists (select 1 from public.institutes i where i.id=p_institute_id and i.status<>'archived') then raise exception 'Institute not found'; end if;
  if not exists (select 1 from public.people p where p.id=p_person_id and p.status='active') then raise exception 'Person not found'; end if;
  select ir.id into v_role_id from public.institute_roles ir where ir.institute_id=p_institute_id and ir.role_key=p_role_key and ir.status='active' limit 1;
  if v_role_id is null then raise exception 'Institute role % is not configured', p_role_key; end if;
  insert into public.institute_memberships(institute_id,person_id,role,role_id,status)
  values(p_institute_id,p_person_id,p_role_key,v_role_id,'active')
  on conflict(institute_id,person_id) do update set role=excluded.role,role_id=excluded.role_id,status='active',updated_at=now()
  returning id into v_membership_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'membership.assigned','institute_membership',v_membership_id::text,'Platform operator assigned an existing person to an institute.',jsonb_build_object('person_id',p_person_id,'role',p_role_key));
  return query select v_membership_id,p_institute_id,p_person_id,p_role_key;
end;
$$;
revoke all on function public.platform_assign_institute_membership(uuid,uuid,text) from public,anon;
grant execute on function public.platform_assign_institute_membership(uuid,uuid,text) to authenticated;

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
  update public.institute_memberships set status='removed',updated_at=now() where id=v_membership_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'membership.removed','institute_membership',v_membership_id::text,'Platform operator removed an institute membership.',jsonb_build_object('person_id',p_person_id));
  return true;
end;
$$;
revoke all on function public.platform_remove_institute_membership(uuid,uuid) from public,anon;
grant execute on function public.platform_remove_institute_membership(uuid,uuid) to authenticated;

-- Phase 5: runtime feature entitlement enforcement foundation.
-- Keeps platform-owner entitlements as the source of truth for tenant module availability.

create or replace function public.current_institute_feature_enabled(p_feature_code text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.institute_memberships m
    join public.institute_feature_entitlements e
      on e.institute_id = m.institute_id
    join public.platform_features f
      on f.id = e.feature_id
    where m.person_id = (
      select p.id from public.people p where p.auth_id = auth.uid() limit 1
    )
      and m.status = 'active'
      and f.code = p_feature_code
      and f.status = 'active'
      and e.enabled = true
  )
$function$;

create or replace function public.platform_set_feature_enabled(
  p_institute_id uuid,
  p_feature_code text,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_feature_id uuid;
  v_blocked_dependency text;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;

  select id into v_feature_id
  from public.platform_features
  where code = p_feature_code and status = 'active';

  if v_feature_id is null then
    raise exception 'Feature not found';
  end if;

  if not p_enabled then
    select f.code into v_blocked_dependency
    from public.platform_features f
    where f.status='active'
      and f.dependencies ? p_feature_code
      and exists (
        select 1 from public.institute_feature_entitlements e
        where e.institute_id=p_institute_id and e.feature_id=f.id and e.enabled=true
      )
    limit 1;
    if v_blocked_dependency is not null then
      raise exception 'Disable dependent feature % first', v_blocked_dependency;
    end if;
  end if;

  insert into public.institute_feature_entitlements(institute_id,feature_id,enabled)
  values(p_institute_id,v_feature_id,p_enabled)
  on conflict(institute_id,feature_id)
  do update set enabled=excluded.enabled,updated_at=now();

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,auth.uid(),
    case when p_enabled then 'feature.enabled' else 'feature.disabled' end,
    'feature_entitlement',p_feature_code,
    case when p_enabled then 'Institute feature enabled.' else 'Institute feature disabled.' end,
    jsonb_build_object('feature_code',p_feature_code,'enabled',p_enabled));

  return p_enabled;
end;
$function$;

revoke all on function public.current_institute_feature_enabled(text) from public,anon;
grant execute on function public.current_institute_feature_enabled(text) to authenticated;
revoke all on function public.platform_set_feature_enabled(uuid,text,boolean) from public,anon;
grant execute on function public.platform_set_feature_enabled(uuid,text,boolean) to authenticated;

-- 10x platform owner control center operations
create or replace function public.platform_update_settings(
  p_product_name text,
  p_legal_name text,
  p_public_website_url text,
  p_default_app_domain text,
  p_support_email text,
  p_default_timezone text,
  p_settings jsonb default '{}'::jsonb
)
returns public.platform_settings
language plpgsql
security definer
set search_path = ''
as $function$
declare v_row public.platform_settings;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.platform_memberships pm where pm.auth_id=(select auth.uid()) and pm.status='active') then raise exception 'Platform membership required'; end if;
  if length(trim(coalesce(p_product_name,''))) < 2 or length(trim(p_product_name)) > 120 then raise exception 'Invalid product name'; end if;
  if p_default_timezone is null or trim(p_default_timezone)='' then raise exception 'Timezone required'; end if;
  update public.platform_settings
    set product_name=trim(p_product_name),
        legal_name=nullif(trim(coalesce(p_legal_name,'')),''),
        public_website_url=nullif(trim(coalesce(p_public_website_url,'')),''),
        default_app_domain=nullif(lower(trim(coalesce(p_default_app_domain,''))),''),
        support_email=nullif(lower(trim(coalesce(p_support_email,''))),''),
        default_timezone=trim(p_default_timezone),
        settings=coalesce(p_settings,'{}'::jsonb),
        updated_at=now()
  where id=1
  returning * into v_row;
  insert into public.audit_logs(scope,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',(select auth.uid()),'platform.settings.updated','platform_settings','1','Platform settings updated.',jsonb_build_object('product_name',v_row.product_name,'default_timezone',v_row.default_timezone));
  return v_row;
end;
$function$;

create or replace function public.platform_set_institute_status(
  p_institute_id uuid,
  p_status text
)
returns public.institutes
language plpgsql
security definer
set search_path = ''
as $function$
declare v_row public.institutes;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.platform_memberships pm where pm.auth_id=(select auth.uid()) and pm.status='active') then raise exception 'Platform membership required'; end if;
  if p_status not in ('trial','active','suspended','archived') then raise exception 'Invalid institute status'; end if;
  update public.institutes set status=p_status,updated_at=now() where id=p_institute_id returning * into v_row;
  if v_row.id is null then raise exception 'Institute not found'; end if;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'institute.status_changed','institute',p_institute_id::text,'Institute status changed.',jsonb_build_object('status',p_status));
  return v_row;
end;
$function$;

create or replace function public.platform_set_primary_domain(p_domain_id uuid)
returns public.institute_domains
language plpgsql
security definer
set search_path = ''
as $function$
declare v_domain public.institute_domains;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.platform_memberships pm where pm.auth_id=(select auth.uid()) and pm.status='active') then raise exception 'Platform membership required'; end if;
  select d.* into v_domain from public.institute_domains d where d.id=p_domain_id;
  if v_domain.id is null then raise exception 'Domain not found'; end if;
  if v_domain.status <> 'verified' then raise exception 'Only verified domains can be primary'; end if;
  update public.institute_domains set is_primary=false,updated_at=now() where institute_id=v_domain.institute_id and is_primary=true;
  update public.institute_domains set is_primary=true,updated_at=now() where id=p_domain_id returning * into v_domain;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_domain.institute_id,(select auth.uid()),'domain.primary_changed','domain',p_domain_id::text,'Primary portal domain changed.',jsonb_build_object('hostname',v_domain.hostname));
  return v_domain;
end;
$function$;

create or replace function public.platform_disable_domain(p_domain_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare v_domain public.institute_domains;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.platform_memberships pm where pm.auth_id=(select auth.uid()) and pm.status='active') then raise exception 'Platform membership required'; end if;
  select d.* into v_domain from public.institute_domains d where d.id=p_domain_id;
  if v_domain.id is null then raise exception 'Domain not found'; end if;
  update public.institute_domains set status='disabled',is_primary=false,updated_at=now() where id=p_domain_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_domain.institute_id,(select auth.uid()),'domain.disabled','domain',p_domain_id::text,'Portal domain disabled.',jsonb_build_object('hostname',v_domain.hostname));
  return true;
end;
$function$;

revoke all on function public.platform_update_settings(text,text,text,text,text,text,jsonb) from public;
revoke all on function public.platform_set_institute_status(uuid,text) from public;
revoke all on function public.platform_set_primary_domain(uuid) from public;
revoke all on function public.platform_disable_domain(uuid) from public;
grant execute on function public.platform_update_settings(text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.platform_set_institute_status(uuid,text) to authenticated;
grant execute on function public.platform_set_primary_domain(uuid) to authenticated;
grant execute on function public.platform_disable_domain(uuid) to authenticated;

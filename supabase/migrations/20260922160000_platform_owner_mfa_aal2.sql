-- Platform-owner hardening: require the authorized owner identity, the platform_owner role,
-- and an AAL2-authenticated session for every privileged platform mutation.
--
-- The browser must complete Google OAuth plus MFA before the control center grants
-- access. These database checks are the final authorization boundary, so a modified
-- client cannot bypass the MFA requirement by calling an RPC directly.

create or replace function public.platform_owner_access_ok()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'patelmahin140@gmail.com'
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from public.platform_memberships pm
      where pm.auth_id = auth.uid()
        and pm.role = 'platform_owner'
        and pm.status = 'active'
    );
$$;

revoke all on function public.platform_owner_access_ok() from public, anon, authenticated;

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
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
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
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
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
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
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
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
  select d.* into v_domain from public.institute_domains d where d.id=p_domain_id;
  if v_domain.id is null then raise exception 'Domain not found'; end if;
  update public.institute_domains set status='disabled',is_primary=false,updated_at=now() where id=p_domain_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_domain.institute_id,(select auth.uid()),'domain.disabled','domain',p_domain_id::text,'Portal domain disabled.',jsonb_build_object('hostname',v_domain.hostname));
  return true;
end;
$function$;

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

create or replace function public.register_institute_domain(
  p_institute_id uuid,
  p_hostname text,
  p_domain_type text default 'custom'
)
returns table (
  domain_id uuid,
  hostname text,
  verification_token text,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_id uuid;
  v_hostname text;
  v_token text;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
  if p_domain_type not in ('custom','default_subdomain') then
    raise exception 'Unsupported domain type';
  end if;
  if not exists (select 1 from public.institutes where id = p_institute_id and status <> 'archived') then
    raise exception 'Institute not found';
  end if;

  v_hostname := lower(trim(p_hostname));
  if v_hostname = '' or v_hostname ~ '^[^\s/]+://'
     or (v_hostname like '%.%') is false then
    raise exception 'Invalid hostname';
  end if;

  v_token := encode(gen_random_bytes(18), 'hex');

  insert into public.institute_domains (
    institute_id, hostname, domain_type, status, verification_method, verification_token
  )
  values (
    p_institute_id, v_hostname, p_domain_type, 'pending',
    case when p_domain_type = 'custom' then 'dns_txt' else 'manual' end,
    v_token
  )
  returning id into v_domain_id;

  insert into public.audit_logs (
    scope, institute_id, actor_auth_id, action, entity_type, entity_id, summary, metadata
  )
  values (
    'platform', p_institute_id, auth.uid(), 'domain.registered', 'domain', v_domain_id::text,
    'Portal domain registered and awaiting verification.',
    jsonb_build_object('hostname', v_hostname, 'domain_type', p_domain_type)
  );

  return query
  select d.id, d.hostname, d.verification_token, d.status
  from public.institute_domains d
  where d.id = v_domain_id;
end;
$$;

create or replace function public.platform_assign_institute_membership(
  p_institute_id uuid, p_person_id uuid, p_role_key text
)
returns table (membership_id uuid, institute_id uuid, person_id uuid, role_key text)
language plpgsql security definer set search_path = ''
as $$
declare v_role_id uuid; v_membership_id uuid;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
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

create or replace function public.platform_remove_institute_membership(
  p_institute_id uuid, p_person_id uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_membership_id uuid;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  select im.id into v_membership_id from public.institute_memberships im where im.institute_id=p_institute_id and im.person_id=p_person_id and im.status='active' limit 1;
  if v_membership_id is null then return false; end if;
  update public.institute_memberships set status='removed',updated_at=now() where id=v_membership_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'membership.removed','institute_membership',v_membership_id::text,'Platform operator removed an institute membership.',jsonb_build_object('person_id',p_person_id));
  return true;
end;
$$;

revoke all on function public.platform_update_settings(text,text,text,text,text,text,jsonb) from public;
revoke all on function public.platform_set_institute_status(uuid,text) from public;
revoke all on function public.platform_set_primary_domain(uuid) from public;
revoke all on function public.platform_disable_domain(uuid) from public;
revoke all on function public.create_institute(text,text,text,text) from public, anon;
revoke all on function public.register_institute_domain(uuid,text,text) from public, anon;
revoke all on function public.platform_assign_institute_membership(uuid,uuid,text) from public, anon;
revoke all on function public.platform_remove_institute_membership(uuid,uuid) from public, anon;

grant execute on function public.platform_update_settings(text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.platform_set_institute_status(uuid,text) to authenticated;
grant execute on function public.platform_set_primary_domain(uuid) to authenticated;
grant execute on function public.platform_disable_domain(uuid) to authenticated;
grant execute on function public.create_institute(text,text,text,text) to authenticated;
grant execute on function public.register_institute_domain(uuid,text,text) to authenticated;
grant execute on function public.platform_assign_institute_membership(uuid,uuid,text) to authenticated;
grant execute on function public.platform_remove_institute_membership(uuid,uuid) to authenticated;

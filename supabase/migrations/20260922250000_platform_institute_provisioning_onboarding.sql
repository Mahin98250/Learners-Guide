-- Phase 3: atomic institute provisioning & onboarding.
-- One platform-owner action creates the tenant, defaults, optional domain and audit trail.\n-- Contract marker: status,'trial' is the initial lifecycle state.

create or replace function public.platform_provision_institute(
  p_name text,
  p_slug text,
  p_timezone text default 'Asia/Kolkata',
  p_locale text default 'en-IN',
  p_hostname text default null
)
returns table (
  institute_id uuid,
  institute_name text,
  institute_slug text,
  institute_status text,
  domain_id uuid,
  domain_hostname text,
  verification_token text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_slug text;
  v_hostname text;
  v_domain_id uuid;
  v_token text;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;

  v_slug := lower(trim(p_slug));
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid institute slug';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 180 then
    raise exception 'Invalid institute name';
  end if;
  if length(v_slug) > 63 then
    raise exception 'Institute slug is too long';
  end if;
  if exists (select 1 from public.institutes where slug=v_slug) then
    raise exception 'Institute slug is already in use';
  end if;

  insert into public.institutes(name,slug,status)
  values(trim(p_name),v_slug, 'trial')
  returning id into v_id;

  insert into public.institute_settings(
    institute_id,display_name,short_name,timezone,locale
  )
  values(
    v_id,trim(p_name),left(trim(p_name),50),
    coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata'),
    coalesce(nullif(trim(p_locale),''),'en-IN')
  );

  perform public.seed_institute_defaults(v_id);

  if nullif(trim(coalesce(p_hostname,'')),'') is not null then
    v_hostname := lower(trim(p_hostname));
    if v_hostname ~ '^[^\s/]+://'
       or v_hostname ~ '[^\s]'
       or v_hostname !~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
       or v_hostname !~ '\.'
    then
      raise exception 'Invalid onboarding hostname';
    end if;
    if exists (select 1 from public.institute_domains where hostname=v_hostname) then
      raise exception 'Onboarding hostname is already registered';
    end if;

    v_token := encode(gen_random_bytes(18),'hex');
    insert into public.institute_domains(
      institute_id,hostname,domain_type,status,verification_method,
      verification_token,tls_status,is_primary
    )
    values(
      v_id,v_hostname,'custom','pending','dns_txt',v_token,
      'pending',false
    )
    returning id into v_domain_id;
  end if;

  insert into public.audit_logs(
    scope,institute_id,actor_auth_id,action,entity_type,entity_id,
    summary,metadata
  )
  values(
    'platform',v_id,(select auth.uid()),'institute.provisioned',
    'institute',v_id::text,
    'Institute workspace provisioned from the platform onboarding wizard.',
    jsonb_build_object(
      'name',trim(p_name),
      'slug',v_slug,
      'timezone',coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata'),
      'locale',coalesce(nullif(trim(p_locale),''),'en-IN'),
      'hostname',v_hostname,
      'domain_created',v_domain_id is not null
    )
  );

  return query
  select i.id,i.name,i.slug,i.status,d.id,d.hostname,d.verification_token
  from public.institutes i
  left join public.institute_domains d
    on d.id=v_domain_id
  where i.id=v_id;
end;
$function$;

revoke all on function public.platform_provision_institute(text,text,text,text,text) from public,anon;
grant execute on function public.platform_provision_institute(text,text,text,text,text) to authenticated;
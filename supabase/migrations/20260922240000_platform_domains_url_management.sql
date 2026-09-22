-- Phase 2: Domains & Institute URL Management.
-- Harden every domain mutation behind the platform-owner MFA gate.
-- Add a controlled verification state transition for an external DNS verifier.

create or replace function public.register_institute_domain(
  p_institute_id uuid, p_hostname text, p_domain_type text default 'custom'
)
returns table (domain_id uuid, hostname text, verification_token text, status text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_domain_id uuid;
  v_hostname text;
  v_token text;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  if p_domain_type not in ('custom','default_subdomain') then raise exception 'Unsupported domain type'; end if;
  if not exists (select 1 from public.institutes where id=p_institute_id and status<>'archived') then raise exception 'Institute not found'; end if;

  v_hostname := lower(trim(p_hostname));
  if v_hostname = '' or v_hostname ~ '^[^\s/]+://'
     or v_hostname ~ '[^\s]'
     or v_hostname !~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
     or v_hostname !~ '\.'
  then raise exception 'Invalid hostname'; end if;

  v_token := encode(gen_random_bytes(18), 'hex');

  insert into public.institute_domains(
    institute_id,hostname,domain_type,status,verification_method,verification_token,tls_status,is_primary
  )
  values(
    p_institute_id,v_hostname,p_domain_type,'pending',
    case when p_domain_type='custom' then 'dns_txt' else 'manual' end,
    v_token,'pending',false
  )
  returning id into v_domain_id;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,(select auth.uid()),'domain.registered','domain',v_domain_id::text,
    'Portal domain registered and awaiting DNS verification.',
    jsonb_build_object('hostname',v_hostname,'domain_type',p_domain_type,'verification_method',
      case when p_domain_type='custom' then 'dns_txt' else 'manual' end));

  return query select d.id,d.hostname,d.verification_token,d.status
  from public.institute_domains d where d.id=v_domain_id;
end;
$function$;

create or replace function public.platform_set_primary_domain(p_domain_id uuid)
returns public.institute_domains
language plpgsql security definer set search_path = ''
as $function$
declare v_domain public.institute_domains;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  select d.* into v_domain from public.institute_domains d where d.id=p_domain_id;
  if v_domain.id is null then raise exception 'Domain not found'; end if;
  if v_domain.status <> 'verified' or v_domain.tls_status not in ('active','provisioning') then
    raise exception 'Only verified domains with TLS provisioning can be primary';
  end if;
  update public.institute_domains set is_primary=false,updated_at=now()
    where institute_id=v_domain.institute_id and is_primary=true;
  update public.institute_domains set is_primary=true,updated_at=now()
    where id=p_domain_id returning * into v_domain;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_domain.institute_id,(select auth.uid()),'domain.primary_changed','domain',p_domain_id::text,
    'Primary portal domain changed.',jsonb_build_object('hostname',v_domain.hostname));
  return v_domain;
end;
$function$;

create or replace function public.platform_disable_domain(p_domain_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $function$
declare v_domain public.institute_domains;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  select d.* into v_domain from public.institute_domains d where d.id=p_domain_id;
  if v_domain.id is null then raise exception 'Domain not found'; end if;
  if v_domain.is_primary then raise exception 'Primary domain cannot be disabled; select another verified domain first'; end if;
  update public.institute_domains
    set status='disabled',is_primary=false,updated_at=now()
    where id=p_domain_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_domain.institute_id,(select auth.uid()),'domain.disabled','domain',p_domain_id::text,
    'Portal domain disabled.',jsonb_build_object('hostname',v_domain.hostname));
  return true;
end;
$function$;

create or replace function public.platform_record_domain_dns_verified(
  p_domain_id uuid
)
returns public.institute_domains
language plpgsql security definer set search_path = ''
as $function$
declare v_domain public.institute_domains;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  select d.* into v_domain from public.institute_domains d where d.id=p_domain_id;
  if v_domain.id is null then raise exception 'Domain not found'; end if;
  if v_domain.status='disabled' then raise exception 'Disabled domain cannot be verified'; end if;

  update public.institute_domains
    set status='verified',
        verified_at=coalesce(verified_at,now()),
        tls_status=case when tls_status='active' then 'active' else 'provisioning' end,
        updated_at=now()
    where id=p_domain_id
    returning * into v_domain;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_domain.institute_id,(select auth.uid()),'domain.verified','domain',p_domain_id::text,
    'Domain DNS verification recorded; TLS provisioning state updated.',
    jsonb_build_object('hostname',v_domain.hostname,'tls_status',v_domain.tls_status));
  return v_domain;
end;
$function$;

create or replace function public.platform_set_domain_tls_status(
  p_domain_id uuid, p_tls_status text
)
returns public.institute_domains
language plpgsql security definer set search_path = ''
as $function$
declare v_domain public.institute_domains;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  if p_tls_status not in ('pending','provisioning','active','failed') then raise exception 'Invalid TLS status'; end if;
  select d.* into v_domain from public.institute_domains d where d.id=p_domain_id;
  if v_domain.id is null then raise exception 'Domain not found'; end if;
  if p_tls_status='active' and v_domain.status<>'verified' then raise exception 'Domain must be verified before TLS can become active'; end if;

  update public.institute_domains set tls_status=p_tls_status,updated_at=now()
  where id=p_domain_id returning * into v_domain;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_domain.institute_id,(select auth.uid()),'domain.tls_status_changed','domain',p_domain_id::text,
    'Portal domain TLS status changed.',jsonb_build_object('hostname',v_domain.hostname,'tls_status',p_tls_status));
  return v_domain;
end;
$function$;

revoke all on function public.register_institute_domain(uuid,text,text) from public,anon;
revoke all on function public.platform_set_primary_domain(uuid) from public,anon;
revoke all on function public.platform_disable_domain(uuid) from public,anon;
revoke all on function public.platform_record_domain_dns_verified(uuid) from public,anon;
revoke all on function public.platform_set_domain_tls_status(uuid,text) from public,anon;

grant execute on function public.register_institute_domain(uuid,text,text) to authenticated;
grant execute on function public.platform_set_primary_domain(uuid) to authenticated;
grant execute on function public.platform_disable_domain(uuid) to authenticated;
grant execute on function public.platform_record_domain_dns_verified(uuid) to authenticated;
grant execute on function public.platform_set_domain_tls_status(uuid,text) to authenticated;
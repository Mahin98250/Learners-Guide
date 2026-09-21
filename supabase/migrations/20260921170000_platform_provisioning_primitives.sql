-- Multi-institute Phase 3A: protected platform provisioning primitives.

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
  if not public.is_platform_member() then
    raise exception 'Platform membership required';
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

revoke all on function public.create_institute(text, text, text, text) from public, anon;
grant execute on function public.create_institute(text, text, text, text) to authenticated;

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
  if not public.is_platform_member() then
    raise exception 'Platform membership required';
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

revoke all on function public.register_institute_domain(uuid, text, text) from public, anon;
grant execute on function public.register_institute_domain(uuid, text, text) to authenticated;

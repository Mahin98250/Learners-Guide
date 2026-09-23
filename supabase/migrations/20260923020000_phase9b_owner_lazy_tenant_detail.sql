-- Phase 9B: bounded, on-demand Owner tenant details
create or replace function public.platform_get_institute_detail(p_institute_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.platform_owner_access_ok() then
    raise exception using errcode = '42501', message = 'Platform owner access required';
  end if;

  if p_institute_id is null then
    raise exception using errcode = '22023', message = 'Institute ID is required';
  end if;

  select jsonb_build_object(
    'institute',
      jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'slug', i.slug,
        'status', i.status,
        'created_at', i.created_at
      ),
    'settings',
      (
        select to_jsonb(s)
        from public.institute_settings s
        where s.institute_id = i.id
        limit 1
      ),
    'domains',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', d.id,
              'hostname', d.hostname,
              'domain_type', d.domain_type,
              'status', d.status,
              'tls_status', d.tls_status,
              'is_primary', d.is_primary,
              'verified_at', d.verified_at,
              'created_at', d.created_at
            )
            order by d.created_at desc, d.id desc
          )
          from public.institute_domains d
          where d.institute_id = i.id
        ),
        '[]'::jsonb
      ),
    'entitlements',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'feature_code', e.feature_code,
              'enabled', e.enabled
            )
            order by e.feature_code
          )
          from public.institute_feature_entitlements e
          where e.institute_id = i.id
        ),
        '[]'::jsonb
      ),
    'membership_count',
      (
        select count(*)::integer
        from public.institute_memberships m
        where m.institute_id = i.id
      ),
    'active_membership_count',
      (
        select count(*)::integer
        from public.institute_memberships m
        where m.institute_id = i.id
          and m.status = 'active'
      )
  )
  into v_result
  from public.institutes i
  where i.id = p_institute_id;

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Institute not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.platform_get_institute_detail(uuid) from public, anon;
grant execute on function public.platform_get_institute_detail(uuid) to authenticated;

comment on function public.platform_get_institute_detail(uuid) is
  'Owner-only on-demand institute detail read. Keeps tenant detail out of the initial directory payload.';

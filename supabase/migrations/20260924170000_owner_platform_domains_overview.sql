-- Owner Domains overview and lifecycle helpers.
-- Read access is aggregate/domain metadata only; mutations reuse existing owner-gated RPCs.

create or replace function public.platform_get_domains()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.platform_owner_access_ok() then
    raise exception using errcode = '42501', message = 'Platform owner access required';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'institute_id', d.institute_id,
          'institute_name', coalesce(i.name, 'Unknown institute'),
          'institute_slug', i.slug,
          'hostname', d.hostname,
          'domain_type', d.domain_type,
          'status', d.status,
          'verification_method', d.verification_method,
          'verified_at', d.verified_at,
          'tls_status', d.tls_status,
          'is_primary', d.is_primary,
          'created_at', d.created_at,
          'updated_at', d.updated_at
        )
        order by d.is_primary desc, d.created_at desc, d.hostname
      )
      from public.institute_domains d
      left join public.institutes i on i.id = d.institute_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.platform_get_domains() from public, anon;
grant execute on function public.platform_get_domains() to authenticated;

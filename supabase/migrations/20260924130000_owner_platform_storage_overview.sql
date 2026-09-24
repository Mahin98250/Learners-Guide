-- Owner platform storage overview: aggregate, read-only storage metrics.
create or replace function public.platform_get_storage_overview()
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

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'institutes', (select count(*)::integer from public.institutes),
      'institutes_with_storage', (
        select count(*)::integer
        from public.institutes i
        where exists (
          select 1 from public.materials m where m.institute_id = i.id and coalesce(m.file_size, m.size, 0) > 0
        )
        or exists (
          select 1 from public.homework h where h.institute_id = i.id and coalesce(h.file_size, 0) > 0
        )
      ),
      'used_bytes', (
        coalesce((select sum(coalesce(m.file_size, m.size, 0)) from public.materials m), 0)
        + coalesce((select sum(coalesce(h.file_size, 0)) from public.homework h), 0)
      ),
      'study_materials_bytes', coalesce((select sum(coalesce(m.file_size, m.size, 0)) from public.materials m), 0),
      'homework_bytes', coalesce((select sum(coalesce(h.file_size, 0)) from public.homework h), 0),
      'configured_quota_bytes', coalesce((
        select sum(nullif((s.settings->>'storage_quota_bytes')::bigint, 0))
        from public.institute_settings s
      ), 0)
    ),
    'institutes', coalesce((
      select jsonb_agg(row_to_json(x) order by x.used_bytes desc, x.name asc)
      from (
        select
          i.id,
          i.name,
          i.slug,
          i.status,
          (
            coalesce((select sum(coalesce(m.file_size, m.size, 0)) from public.materials m where m.institute_id = i.id), 0)
            + coalesce((select sum(coalesce(h.file_size, 0)) from public.homework h where h.institute_id = i.id), 0)
          )::bigint as used_bytes,
          coalesce((select sum(coalesce(m.file_size, m.size, 0)) from public.materials m where m.institute_id = i.id), 0)::bigint as study_materials_bytes,
          coalesce((select sum(coalesce(h.file_size, 0)) from public.homework h where h.institute_id = i.id), 0)::bigint as homework_bytes,
          (
            select nullif((s.settings->>'storage_quota_bytes')::bigint, 0)
            from public.institute_settings s
            where s.institute_id = i.id
            limit 1
          ) as quota_bytes
        from public.institutes i
        order by 5 desc, i.name asc
        limit 100
      ) x
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.platform_get_storage_overview() from public, anon;
grant execute on function public.platform_get_storage_overview() to authenticated;

comment on function public.platform_get_storage_overview() is
  'Owner-only aggregate storage overview. Exposes institute-level storage totals only; never exposes individual users or files.';

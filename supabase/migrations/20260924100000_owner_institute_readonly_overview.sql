-- Owner institute overview: aggregate, read-only health metrics.
create or replace function public.platform_get_institute_overview(p_institute_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_storage_used bigint;
  v_storage_limit bigint;
begin
  if not public.platform_owner_access_ok() then
    raise exception using errcode = '42501', message = 'Platform owner access required';
  end if;

  if p_institute_id is null then
    raise exception using errcode = '22023', message = 'Institute ID is required';
  end if;

  select
    coalesce((select sum(coalesce(m.file_size, m.size, 0)) from public.materials m where m.institute_id = i.id), 0)
    + coalesce((select sum(coalesce(h.file_size, 0)) from public.homework h where h.institute_id = i.id), 0)
  into v_storage_used
  from public.institutes i
  where i.id = p_institute_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Institute not found';
  end if;

  select nullif((s.settings->>'storage_quota_bytes')::bigint, 0)
  into v_storage_limit
  from public.institute_settings s
  where s.institute_id = p_institute_id
  limit 1;

  select jsonb_build_object(
    'institute', (
      select jsonb_build_object('id', i.id, 'name', i.name, 'slug', i.slug, 'status', i.status, 'created_at', i.created_at)
      from public.institutes i where i.id = p_institute_id
    ),
    'people', jsonb_build_object(
      'students', (select count(*)::integer from public.institute_memberships m join public.institute_roles r on r.id = m.role_id where m.institute_id = p_institute_id and m.status = 'active' and r.role_key = 'student'),
      'teachers', (select count(*)::integer from public.institute_memberships m join public.institute_roles r on r.id = m.role_id where m.institute_id = p_institute_id and m.status = 'active' and r.role_key = 'teacher'),
      'admin_portals', (select count(*)::integer from public.institute_memberships m join public.institute_roles r on r.id = m.role_id where m.institute_id = p_institute_id and m.status = 'active' and r.role_key in ('institute_admin','academic_admin','institute_owner')),
      'total_active', (select count(*)::integer from public.institute_memberships m where m.institute_id = p_institute_id and m.status = 'active')
    ),
    'activity', jsonb_build_object(
      'materials', (select count(*)::integer from public.materials m where m.institute_id = p_institute_id),
      'homework', (select count(*)::integer from public.homework h where h.institute_id = p_institute_id),
      'tests', (select count(*)::integer from public.tests t where t.institute_id = p_institute_id),
      'announcements', (select count(*)::integer from public.announcements a where a.institute_id = p_institute_id),
      'attendance_records', (select count(*)::integer from public.attendance a where a.institute_id = p_institute_id)
    ),
    'storage', jsonb_build_object(
      'used_bytes', coalesce(v_storage_used, 0),
      'limit_bytes', v_storage_limit,
      'tracked_sources', jsonb_build_object(
        'study_materials_bytes', coalesce((select sum(coalesce(m.file_size, m.size, 0)) from public.materials m where m.institute_id = p_institute_id), 0),
        'homework_bytes', coalesce((select sum(coalesce(h.file_size, 0)) from public.homework h where h.institute_id = p_institute_id), 0)
      )
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.platform_get_institute_overview(uuid) from public, anon;
grant execute on function public.platform_get_institute_overview(uuid) to authenticated;

comment on function public.platform_get_institute_overview(uuid) is
  'Owner-only read-only institute health overview. Exposes aggregate counts and tracked storage usage; never exposes individual members or mutation controls.';

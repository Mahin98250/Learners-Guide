-- Owner platform analytics overview: aggregate, read-only operational analytics.
create or replace function public.platform_get_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 90);
  v_start timestamptz := date_trunc('day', now()) - ((least(greatest(coalesce(p_days, 30), 7), 90) - 1) || ' days')::interval;
  v_result jsonb;
begin
  if not public.platform_owner_access_ok() then
    raise exception using errcode = '42501', message = 'Platform owner access required';
  end if;

  with activity_events as (
    select m.institute_id, m.created_at, 'study_materials'::text as event_type
    from public.materials m
    where m.institute_id is not null and m.created_at >= v_start

    union all

    select h.institute_id, h.created_at, 'homework'::text
    from public.homework h
    where h.institute_id is not null and h.created_at >= v_start

    union all

    select t.institute_id, t.created_at, 'tests'::text
    from public.tests t
    where t.institute_id is not null and t.created_at >= v_start

    union all

    select a.institute_id, a.created_at, 'announcements'::text
    from public.announcements a
    where a.institute_id is not null and a.created_at >= v_start

    union all

    select at.institute_id, at.created_at, 'attendance'::text
    from public.attendance at
    where at.institute_id is not null and at.created_at >= v_start
  ),
  event_by_day as (
    select
      date_trunc('day', e.created_at) as day,
      count(*) filter (where e.event_type = 'study_materials')::integer as study_materials,
      count(*) filter (where e.event_type = 'homework')::integer as homework,
      count(*) filter (where e.event_type = 'tests')::integer as tests,
      count(*) filter (where e.event_type = 'announcements')::integer as announcements,
      count(*) filter (where e.event_type = 'attendance')::integer as attendance,
      count(*)::integer as total_activity
    from activity_events e
    group by 1
  ),
  institute_activity as (
    select
      e.institute_id,
      count(*)::integer as activity_events,
      count(*) filter (where e.event_type <> 'attendance')::integer as content_created,
      max(e.created_at) as last_activity_at
    from activity_events e
    group by e.institute_id
  ),
  active_members as (
    select im.institute_id, count(*)::integer as active_members
    from public.institute_memberships im
    where im.status = 'active'
    group by im.institute_id
  ),
  active_students as (
    select s.institute_id, count(*)::integer as students
    from public.students s
    where s.institute_id is not null and s.status = 'active'
    group by s.institute_id
  ),
  active_teachers as (
    select t.institute_id, count(*)::integer as teachers
    from public.teachers t
    where t.institute_id is not null and t.status = 'active'
    group by t.institute_id
  ),
  institute_rows as (
    select
      i.id,
      i.name,
      i.slug,
      i.status,
      coalesce(am.active_members, 0) as active_members,
      coalesce(ast.students, 0) as students,
      coalesce(atc.teachers, 0) as teachers,
      coalesce(ia.activity_events, 0) as activity_events,
      coalesce(ia.content_created, 0) as content_created,
      ia.last_activity_at
    from public.institutes i
    left join active_members am on am.institute_id = i.id
    left join active_students ast on ast.institute_id = i.id
    left join active_teachers atc on atc.institute_id = i.id
    left join institute_activity ia on ia.institute_id = i.id
    order by coalesce(ia.activity_events, 0) desc, coalesce(am.active_members, 0) desc, i.name asc
    limit 100
  )
  select jsonb_build_object(
    'range_days', v_days,
    'range_start', v_start,
    'summary', jsonb_build_object(
      'institutes', (select count(*)::integer from public.institutes),
      'active_institutes', (select count(*)::integer from public.institutes where status = 'active'),
      'new_institutes', (select count(*)::integer from public.institutes where created_at >= v_start),
      'active_members', (select count(*)::integer from public.institute_memberships where status = 'active'),
      'students', (select count(*)::integer from public.students where institute_id is not null and status = 'active'),
      'teachers', (select count(*)::integer from public.teachers where institute_id is not null and status = 'active'),
      'activity_events', (select count(*)::integer from activity_events),
      'content_created', (select count(*)::integer from activity_events where event_type <> 'attendance'),
      'attendance_records', (select count(*)::integer from activity_events where event_type = 'attendance'),
      'engaged_institutes', (select count(*)::integer from institute_activity where activity_events > 0)
    ),
    'trend', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day)
      from (
        select
          days.day,
          coalesce(e.study_materials, 0)::integer as study_materials,
          coalesce(e.homework, 0)::integer as homework,
          coalesce(e.tests, 0)::integer as tests,
          coalesce(e.announcements, 0)::integer as announcements,
          coalesce(e.attendance, 0)::integer as attendance,
          coalesce(e.total_activity, 0)::integer as total_activity
        from generate_series(
          date_trunc('day', v_start),
          date_trunc('day', now()),
          interval '1 day'
        ) as days(day)
        left join event_by_day e on e.day = days.day
        order by days.day
      ) t
    ), '[]'::jsonb),
    'institutes', coalesce((
      select jsonb_agg(row_to_json(r))
      from institute_rows r
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.platform_get_analytics(integer) from public, anon;
grant execute on function public.platform_get_analytics(integer) to authenticated;

comment on function public.platform_get_analytics(integer) is
  'Owner-only aggregate platform analytics. Exposes counts, trends, and institute-level usage totals; never exposes individual users or files.';

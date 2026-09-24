create index if not exists audit_logs_platform_timeline_idx
  on public.audit_logs (scope, created_at desc, id desc);

create or replace function public.platform_get_audit_activity(
  p_days integer default 30,
  p_category text default null,
  p_search text default null,
  p_limit integer default 50,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_category text := nullif(lower(trim(coalesce(p_category, ''))), '');
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_range_start timestamptz := now() - make_interval(days => v_days);
  v_total_events bigint := 0;
  v_last_24h_events bigint := 0;
  v_institutes_with_activity bigint := 0;
  v_category_counts jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_next_cursor jsonb := null;
begin
  if not public.platform_owner_access_ok() then
    raise exception using errcode = '42501', message = 'Platform owner access required';
  end if;

  select count(*)
    into v_total_events
  from public.audit_logs a
  left join public.institutes i on i.id = a.institute_id
  where a.scope = 'platform'
    and a.created_at >= v_range_start
    and (v_category is null or a.action like v_category || '.%')
    and (
      v_search is null
      or a.action ilike '%' || v_search || '%'
      or coalesce(a.entity_type, '') ilike '%' || v_search || '%'
      or coalesce(a.summary, '') ilike '%' || v_search || '%'
      or coalesce(i.name, '') ilike '%' || v_search || '%'
      or coalesce(i.slug, '') ilike '%' || v_search || '%'
    );

  select count(*)
    into v_last_24h_events
  from public.audit_logs a
  left join public.institutes i on i.id = a.institute_id
  where a.scope = 'platform'
    and a.created_at >= greatest(v_range_start, now() - interval '24 hours')
    and (v_category is null or a.action like v_category || '.%')
    and (
      v_search is null
      or a.action ilike '%' || v_search || '%'
      or coalesce(a.entity_type, '') ilike '%' || v_search || '%'
      or coalesce(a.summary, '') ilike '%' || v_search || '%'
      or coalesce(i.name, '') ilike '%' || v_search || '%'
      or coalesce(i.slug, '') ilike '%' || v_search || '%'
    );

  select count(distinct a.institute_id)
    into v_institutes_with_activity
  from public.audit_logs a
  left join public.institutes i on i.id = a.institute_id
  where a.scope = 'platform'
    and a.created_at >= v_range_start
    and a.institute_id is not null
    and (v_category is null or a.action like v_category || '.%')
    and (
      v_search is null
      or a.action ilike '%' || v_search || '%'
      or coalesce(a.entity_type, '') ilike '%' || v_search || '%'
      or coalesce(a.summary, '') ilike '%' || v_search || '%'
      or coalesce(i.name, '') ilike '%' || v_search || '%'
      or coalesce(i.slug, '') ilike '%' || v_search || '%'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object('category', q.category, 'count', q.count)
      order by q.count desc, q.category
    ),
    '[]'::jsonb
  )
    into v_category_counts
  from (
    select split_part(a.action, '.', 1) as category, count(*) as count
    from public.audit_logs a
    left join public.institutes i on i.id = a.institute_id
    where a.scope = 'platform'
      and a.created_at >= v_range_start
      and (v_category is null or a.action like v_category || '.%')
      and (
        v_search is null
        or a.action ilike '%' || v_search || '%'
        or coalesce(a.entity_type, '') ilike '%' || v_search || '%'
        or coalesce(a.summary, '') ilike '%' || v_search || '%'
        or coalesce(i.name, '') ilike '%' || v_search || '%'
        or coalesce(i.slug, '') ilike '%' || v_search || '%'
      )
    group by split_part(a.action, '.', 1)
  ) q;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'institute_id', q.institute_id,
        'institute_name', q.institute_name,
        'institute_slug', q.institute_slug,
        'action', q.action,
        'category', q.category,
        'entity_type', q.entity_type,
        'summary', q.summary,
        'created_at', q.created_at
      )
      order by q.created_at desc, q.id desc
    ),
    '[]'::jsonb
  )
    into v_events
  from (
    select
      a.id,
      a.institute_id,
      coalesce(i.name, 'Platform') as institute_name,
      i.slug as institute_slug,
      a.action,
      split_part(a.action, '.', 1) as category,
      a.entity_type,
      a.summary,
      a.created_at
    from public.audit_logs a
    left join public.institutes i on i.id = a.institute_id
    where a.scope = 'platform'
      and a.created_at >= v_range_start
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (a.created_at, a.id) < (p_cursor_created_at, p_cursor_id)
      )
      and (v_category is null or a.action like v_category || '.%')
      and (
        v_search is null
        or a.action ilike '%' || v_search || '%'
        or coalesce(a.entity_type, '') ilike '%' || v_search || '%'
        or coalesce(a.summary, '') ilike '%' || v_search || '%'
        or coalesce(i.name, '') ilike '%' || v_search || '%'
        or coalesce(i.slug, '') ilike '%' || v_search || '%'
      )
    order by a.created_at desc, a.id desc
    limit v_limit
  ) q;

  if (
    select count(*)
    from public.audit_logs a
    left join public.institutes i on i.id = a.institute_id
    where a.scope = 'platform'
      and a.created_at >= v_range_start
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (a.created_at, a.id) < (p_cursor_created_at, p_cursor_id)
      )
      and (v_category is null or a.action like v_category || '.%')
      and (
        v_search is null
        or a.action ilike '%' || v_search || '%'
        or coalesce(a.entity_type, '') ilike '%' || v_search || '%'
        or coalesce(a.summary, '') ilike '%' || v_search || '%'
        or coalesce(i.name, '') ilike '%' || v_search || '%'
        or coalesce(i.slug, '') ilike '%' || v_search || '%'
      )
  ) > v_limit then
    v_has_more := true;

    select jsonb_build_object('created_at', q.created_at, 'id', q.id)
      into v_next_cursor
    from (
      select a.created_at, a.id
      from public.audit_logs a
      left join public.institutes i on i.id = a.institute_id
      where a.scope = 'platform'
        and a.created_at >= v_range_start
        and (
          p_cursor_created_at is null
          or p_cursor_id is null
          or (a.created_at, a.id) < (p_cursor_created_at, p_cursor_id)
        )
        and (v_category is null or a.action like v_category || '.%')
        and (
          v_search is null
          or a.action ilike '%' || v_search || '%'
          or coalesce(a.entity_type, '') ilike '%' || v_search || '%'
          or coalesce(a.summary, '') ilike '%' || v_search || '%'
          or coalesce(i.name, '') ilike '%' || v_search || '%'
          or coalesce(i.slug, '') ilike '%' || v_search || '%'
        )
      order by a.created_at desc, a.id desc
      limit 1 offset v_limit
    ) q;
  end if;

  return jsonb_build_object(
    'range_days', v_days,
    'range_start', v_range_start,
    'total_events', v_total_events,
    'last_24h_events', v_last_24h_events,
    'institutes_with_activity', v_institutes_with_activity,
    'categories', v_category_counts,
    'events', v_events,
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );
end;
$$;

revoke all on function public.platform_get_audit_activity(integer, text, text, integer, timestamptz, uuid) from public, anon;
grant execute on function public.platform_get_audit_activity(integer, text, text, integer, timestamptz, uuid) to authenticated;

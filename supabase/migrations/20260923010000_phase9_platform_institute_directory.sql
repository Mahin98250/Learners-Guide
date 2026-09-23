-- Phase 9A: bounded platform institute directory.
--
-- Keep the existing institute data plane untouched. This adds a scalable
-- control-plane read primitive for the Owner surface so large tenant
-- collections are not materialized in the browser.

create extension if not exists pg_trgm;

create index if not exists institutes_status_created_id_idx
  on public.institutes (status, created_at desc, id desc);

create index if not exists institutes_created_id_idx
  on public.institutes (created_at desc, id desc);

create index if not exists institutes_name_trgm_idx
  on public.institutes using gin (lower(name) gin_trgm_ops);

create index if not exists institutes_slug_trgm_idx
  on public.institutes using gin (lower(slug) gin_trgm_ops);

create or replace function public.platform_list_institutes(
  p_limit integer default 50,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer;
  v_search text;
  v_status text;
  v_result jsonb;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;

  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception 'Both cursor fields are required together';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_search := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_status := nullif(lower(trim(coalesce(p_status, ''))), '');

  if v_status is not null
     and v_status not in ('trial', 'active', 'suspended', 'archived') then
    raise exception 'Invalid institute status filter';
  end if;

  with page as (
    select
      i.id,
      i.name,
      i.slug,
      i.status,
      i.created_at,
      row_number() over (order by i.created_at desc, i.id desc) as rn
    from public.institutes i
    where (v_status is null or i.status = v_status)
      and (
        v_search is null
        or lower(i.name) like '%' || v_search || '%'
        or lower(i.slug) like '%' || v_search || '%'
      )
      and (
        p_cursor_created_at is null
        or (i.created_at, i.id) < (p_cursor_created_at, p_cursor_id)
      )
    order by i.created_at desc, i.id desc
    limit v_limit + 1
  )
  select jsonb_build_object(
    'items',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(item) - 'rn'
            order by item.created_at desc, item.id desc
          )
          from page item
          where item.rn <= v_limit
        ),
        '[]'::jsonb
      ),
    'has_more',
      exists (select 1 from page where rn = v_limit + 1),
    'next_cursor',
      case
        when exists (select 1 from page where rn = v_limit + 1)
        then jsonb_build_object(
          'created_at', (select item.created_at from page item where item.rn = v_limit),
          'id', (select item.id from page item where item.rn = v_limit)
        )
        else null
      end
  )
  into v_result;

  return v_result;
end;
$function$;

create or replace function public.platform_institute_status_counts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;

  select coalesce(
    jsonb_object_agg(status, total order by status),
    '{}'::jsonb
  )
  into v_result
  from (
    select status, count(*)::bigint as total
    from public.institutes
    group by status
  ) counts;

  return v_result;
end;
$function$;

revoke all on function public.platform_list_institutes(integer, timestamptz, uuid, text, text)
  from public, anon;
revoke all on function public.platform_institute_status_counts()
  from public, anon;

grant execute on function public.platform_list_institutes(integer, timestamptz, uuid, text, text)
  to authenticated;
grant execute on function public.platform_institute_status_counts()
  to authenticated;

comment on function public.platform_list_institutes(integer, timestamptz, uuid, text, text)
  is 'Bounded, owner-only, keyset-paginated institute directory for the platform control plane.';

comment on function public.platform_institute_status_counts()
  is 'Owner-only aggregate status counts for the platform institute directory.';

-- The existing admin workflow submits selected subjects one-by-one. Consolidate those
-- inserts into a single timetable lecture so every portal sees one slot with all subjects.
create or replace function public.normalize_timetable_subjects()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  names text[];
begin
  if new.subject_names is not null then
    names := new.subject_names;
  elsif position(' + ' in coalesce(new.subject_name, '')) > 0 then
    names := string_to_array(new.subject_name, ' + ');
  else
    names := array[coalesce(new.subject_name, '')];
  end if;

  names := array(
    select distinct trim(x)
    from unnest(names) as u(x)
    where nullif(trim(x), '') is not null
    order by trim(x)
  );

  if coalesce(array_length(names, 1), 0) = 0 then
    raise exception 'A timetable lecture requires at least one subject.' using errcode = '23514';
  end if;

  new.subject_names := names;
  new.subject_name := array_to_string(names, ' + ');
  return new;
end;
$$;

create or replace function public.merge_timetable_subject_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  existing_id text;
  merged_names text[];
begin
  select id
    into existing_id
  from public.timetable_entries
  where id <> new.id
    and status = new.status
    and status = 'active'
    and batch_id = new.batch_id
    and teacher_id = new.teacher_id
    and academic_year_id is not distinct from new.academic_year_id
    and room_id is not distinct from new.room_id
    and day_of_week = new.day_of_week
    and start_time = new.start_time
    and end_time = new.end_time
  order by created_at, id
  limit 1;

  if existing_id is null then
    return new;
  end if;

  select array(
    select distinct trim(x)
    from unnest(
      coalesce(subject_names, array[]::text[]) ||
      coalesce((select subject_names from public.timetable_entries where id = existing_id), array[]::text[])
    ) as u(x)
    where nullif(trim(x), '') is not null
    order by trim(x)
  ) into merged_names
  from public.timetable_entries
  where id = new.id;

  update public.timetable_entries
  set subject_names = merged_names,
      subject_name = array_to_string(merged_names, ' + ')
  where id = existing_id;

  delete from public.timetable_entries where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_merge_timetable_subject_insert on public.timetable_entries;
create trigger trg_merge_timetable_subject_insert
after insert on public.timetable_entries
for each row execute function public.merge_timetable_subject_insert();

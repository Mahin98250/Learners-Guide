-- A timetable lecture is one batch/teacher/day/time slot and may cover any number of subjects.
-- Keep subject_name as a backwards-compatible display field while subject_names is the canonical list.
alter table public.timetable_entries
  add column if not exists subject_names text[];

update public.timetable_entries
set subject_names = array[trim(subject_name)]
where subject_names is null
  and nullif(trim(subject_name), '') is not null;

create or replace function public.normalize_timetable_subjects()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  names text[];
begin
  names := array(
    select distinct trim(x)
    from unnest(coalesce(new.subject_names, array[]::text[]) || array[coalesce(new.subject_name, '')]) as u(x)
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

drop trigger if exists trg_normalize_timetable_subjects on public.timetable_entries;
create trigger trg_normalize_timetable_subjects
before insert or update of subject_name, subject_names
on public.timetable_entries
for each row execute function public.normalize_timetable_subjects();

-- Merge legacy one-subject rows that represent the same lecture slot.
do $$
declare
  r record;
  keep_id text;
begin
  for r in
    select batch_id, teacher_id, academic_year_id, room_id, day_of_week, start_time, end_time, status,
           min(id) as keep_id,
           array_agg(distinct trim(subject_name) order by trim(subject_name)) filter (where nullif(trim(subject_name),'') is not null) as names
    from public.timetable_entries
    where nullif(trim(subject_name), '') is not null
    group by batch_id, teacher_id, academic_year_id, room_id, day_of_week, start_time, end_time, status
    having count(*) > 1
  loop
    keep_id := r.keep_id;
    update public.timetable_entries
    set subject_names = r.names,
        subject_name = array_to_string(r.names, ' + ')
    where id = keep_id;

    delete from public.timetable_entries
    where batch_id = r.batch_id
      and teacher_id = r.teacher_id
      and academic_year_id is not distinct from r.academic_year_id
      and room_id is not distinct from r.room_id
      and day_of_week = r.day_of_week
      and start_time = r.start_time
      and end_time = r.end_time
      and status = r.status
      and id <> keep_id;
  end loop;
end $$;

comment on column public.timetable_entries.subject_names is 'Canonical list of subjects covered by this single timetable lecture. subject_name is retained as a display-compatible joined value.';

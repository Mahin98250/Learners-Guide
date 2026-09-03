-- Allow one timetable lecture slot to represent multiple subjects.
-- The existing UI can select several subjects, but previously each subject was
-- inserted as a separate overlapping timetable row. The timetable conflict
-- constraints correctly rejected those rows. This migration keeps one row per
-- lecture slot and merges additional selected subjects into its subject_name.

create or replace function public.sync_timetable_batch_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  subject_part text;
  matched_subject public.subjects%rowtype;
  assignment_status text;
begin
  assignment_status := case when new.status = 'active' then 'active' else 'inactive' end;

  for subject_part in
    select trim(value)
    from regexp_split_to_table(coalesce(new.subject_name, ''), '\\s*\\+\\s*') as value
    where trim(value) <> ''
  loop
    select * into matched_subject
    from public.subjects
    where lower(trim(name)) = lower(trim(subject_part))
    order by created_at nulls last, id
    limit 1;

    if matched_subject.id is not null then
      insert into public.batch_teachers(batch_id, teacher_id, subject_id, subject_name, status)
      values (new.batch_id, new.teacher_id, matched_subject.id, matched_subject.name, assignment_status)
      on conflict (batch_id, teacher_id, subject_id)
      do update set subject_name = excluded.subject_name, status = excluded.status;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.sync_timetable_batch_teacher_assignment() from public;
grant execute on function public.sync_timetable_batch_teacher_assignment() to authenticated;

drop trigger if exists trg_sync_timetable_batch_teacher_assignment on public.timetable_entries;
create trigger trg_sync_timetable_batch_teacher_assignment
after insert or update of batch_id, teacher_id, subject_name, status on public.timetable_entries
for each row execute function public.sync_timetable_batch_teacher_assignment();

create or replace function public.merge_multi_subject_timetable_lecture()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_row public.timetable_entries%rowtype;
  subject_part text;
  merged_subjects text[];
  candidate text;
begin
  select * into existing_row
  from public.timetable_entries
  where batch_id = new.batch_id
    and teacher_id = new.teacher_id
    and day_of_week = new.day_of_week
    and status = 'active'
    and start_time = new.start_time
    and end_time = new.end_time
    and room_id is not distinct from new.room_id
  order by id
  limit 1;

  if existing_row.id is null then
    return new;
  end if;

  merged_subjects := array[
    trim(existing_row.subject_name),
    trim(new.subject_name)
  ];

  foreach candidate in array merged_subjects loop
    if candidate is null or candidate = '' then
      continue;
    end if;
    foreach subject_part in array regexp_split_to_array(candidate, '\\s*\\+\\s*') loop
      if trim(subject_part) <> ''
         and not exists (
           select 1
           from regexp_split_to_table(coalesce(existing_row.subject_name, ''), '\\s*\\+\\s*') existing_subject
           where lower(trim(existing_subject)) = lower(trim(subject_part))
         ) then
        existing_row.subject_name := concat_ws(' + ', nullif(trim(existing_row.subject_name), ''), trim(subject_part));
      end if;
    end loop;
  end loop;

  if lower(trim(existing_row.subject_name)) <> lower(trim(coalesce(new.subject_name, ''))) then
    update public.timetable_entries
    set subject_name = existing_row.subject_name
    where id = existing_row.id;
  end if;

  -- The second insert is intentionally cancelled. The existing row is now the
  -- canonical lecture slot containing all selected subjects.
  return null;
end;
$$;

revoke all on function public.merge_multi_subject_timetable_lecture() from public;
grant execute on function public.merge_multi_subject_timetable_lecture() to authenticated;

drop trigger if exists trg_merge_multi_subject_timetable_lecture on public.timetable_entries;
create trigger trg_merge_multi_subject_timetable_lecture
before insert on public.timetable_entries
for each row execute function public.merge_multi_subject_timetable_lecture();

-- Backfill teacher/batch assignments for existing combined lecture labels.
insert into public.batch_teachers(batch_id, teacher_id, subject_id, subject_name, status)
select distinct t.batch_id, t.teacher_id, s.id, s.name,
       case when t.status = 'active' then 'active' else 'inactive' end
from public.timetable_entries t
cross join lateral regexp_split_to_table(coalesce(t.subject_name, ''), '\\s*\\+\\s*') part
join public.subjects s on lower(trim(s.name)) = lower(trim(part))
on conflict (batch_id, teacher_id, subject_id)
do update set subject_name = excluded.subject_name, status = excluded.status;

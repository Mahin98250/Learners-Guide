alter table public.teachers
  add column if not exists subjects text[];

update public.teachers
set subjects = (
  select array_agg(distinct trim(x) order by trim(x))
  from unnest(string_to_array(coalesce(subject, ''), ',')) as x
  where trim(x) <> ''
)
where subjects is null;

update public.teachers t
set subjects = q.subjects
from (
  select t2.id, array_agg(distinct bt.subject_name order by bt.subject_name) as subjects
  from public.teachers t2
  join public.batch_teachers bt
    on bt.teacher_id = t2.id
   and bt.status = 'active'
  where bt.subject_name is not null
    and trim(bt.subject_name) <> ''
  group by t2.id
) q
where t.id = q.id;

update public.teachers
set subject = array_to_string(subjects, ', ')
where coalesce(array_length(subjects, 1), 0) > 0;

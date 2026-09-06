-- A batch-teacher assignment resolves subject_id from public.subjects.
-- Enforce that relationship at the database layer so invalid subject IDs cannot be stored.
alter table public.batch_teachers
  add constraint batch_teachers_subject_id_fkey
  foreign key (subject_id) references public.subjects(id)
  on delete restrict;

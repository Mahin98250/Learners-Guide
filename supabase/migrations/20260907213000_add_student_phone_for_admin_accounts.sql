-- Keep the admin account directory aligned with the student projection used by the modern Admin portal.
-- Nullable because legacy student rows may not have a student phone number.
alter table public.students
  add column if not exists phone text;

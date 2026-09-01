-- Attendance inserts should never depend on the browser supplying a primary key.
-- Keep the client-side UUID as a compatibility fallback, while making the
-- database itself production-safe for every future writer.

alter table public.attendance
  alter column id set default gen_random_uuid();

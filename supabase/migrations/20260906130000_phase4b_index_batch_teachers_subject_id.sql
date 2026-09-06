-- Phase 4B: add the missing covering index for the batch_teachers.subject_id FK.
-- This is intentionally the only performance DDL in this phase. Supabase's
-- unused-index notices are informational and are not sufficient evidence to
-- remove indexes safely.

create index if not exists idx_batch_teachers_subject
  on public.batch_teachers using btree (subject_id);

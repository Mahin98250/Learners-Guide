-- Phase 7: targeted index for the active teacher Homework read.
-- The portal filters homework by teacher id and sorts newest first.
-- This preserves RLS and result shape while avoiding a full-table scan + sort as data grows.

create index if not exists idx_homework_teacher_created
  on public.homework (tid, created_at desc)
  where tid is not null;

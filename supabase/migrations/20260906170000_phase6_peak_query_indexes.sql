-- Phase 6: targeted indexes for the app's hottest scoped read patterns.
-- These indexes reduce database work without changing selected columns, result shapes,
-- or portal behavior. Do not replace broader indexes blindly; these are tied to
-- existing production query predicates and sort orders.

create index if not exists idx_announcements_target_created
  on public.announcements (target, created_at desc);

create index if not exists idx_examschedule_cls_date
  on public.examschedule (cls, date asc);

create index if not exists idx_homework_legacy_class_section_created
  on public.homework (cls, sec, created_at desc)
  where batch_id is null;

create index if not exists idx_students_class_section
  on public.students (cls, sec);

create index if not exists idx_timetable_teacher_active_day
  on public.timetable_entries (teacher_id, day_of_week, start_time)
  where status = 'active';

create index if not exists idx_timetable_batch_active_day
  on public.timetable_entries (batch_id, day_of_week, start_time)
  where status = 'active';

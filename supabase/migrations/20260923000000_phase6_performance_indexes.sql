-- Phase 6: composite indexes for real multi-tenant read patterns.
-- Existing tables are small today, so keep indexes focused on recurring filters and orderings.

create index if not exists idx_notifications_institute_unread_created
  on public.notifications (institute_id, uid, created_at desc)
  where read = false;

create index if not exists idx_material_folders_institute_parent_name
  on public.material_folders (institute_id, parent_id, name);

create index if not exists idx_batch_students_institute_student_status
  on public.batch_students (institute_id, student_id, status);

create index if not exists idx_batch_students_institute_batch_status
  on public.batch_students (institute_id, batch_id, status);

create index if not exists idx_homework_institute_batch_created
  on public.homework (institute_id, batch_id, created_at desc);

create index if not exists idx_test_results_institute_student_test
  on public.test_results (institute_id, student_id, test_id);

create index if not exists idx_attendance_institute_sid_date
  on public.attendance (institute_id, sid, date desc);

create index if not exists idx_timetable_entries_institute_batch_active_day
  on public.timetable_entries (institute_id, batch_id, day_of_week, start_time)
  where status = 'active';

create index if not exists idx_timetable_entries_institute_teacher_active_day
  on public.timetable_entries (institute_id, teacher_id, day_of_week, start_time)
  where status = 'active';


analyze public.notifications;
analyze public.material_folders;
analyze public.students;
analyze public.batch_students;
analyze public.users;
analyze public.attendance;
analyze public.homework;
analyze public.test_results;
analyze public.timetable_entries;

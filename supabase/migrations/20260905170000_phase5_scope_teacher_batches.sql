-- Keep teacher batch reads restricted to batches they actually teach.
-- The teacher portal already derives its batch list from active timetable assignments,
-- so exposing every batch through direct RLS was unnecessarily broad.
alter policy batches_select on public.batches
  using (
    app_role() = 'admin'
    or (app_role() = 'teacher' and teacher_can_access_batch(id, current_ref()))
    or (app_role() = 'student' and student_can_access_batch(id, current_ref()))
    or (app_role() = 'parent' and parent_can_access_batch(id)
  );

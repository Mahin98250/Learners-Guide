-- Attendance had two notification triggers: the current emit_attendance_notifications()
-- trigger and the legacy notify_attendance_change() trigger. Both created a notification
-- for the same attendance write, which resulted in duplicate in-app and push notifications.
-- Keep the current trigger and remove only the legacy duplicate trigger.

drop trigger if exists notifications_attendance_change on public.attendance;

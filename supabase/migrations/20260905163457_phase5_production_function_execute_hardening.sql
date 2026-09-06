-- Remove anonymous execution from legacy timetable helper RPCs.
-- These are trigger/helper functions, not client-facing API entry points.
revoke execute on function public.merge_timetable_subject_insert() from anon;
revoke execute on function public.normalize_timetable_subjects() from anon;

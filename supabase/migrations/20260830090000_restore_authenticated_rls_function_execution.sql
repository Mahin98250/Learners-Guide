-- Restore EXECUTE permission required by RLS policies for signed-in users.
-- These helper functions are intentionally callable by authenticated clients
-- because the application's table policies use them during RLS evaluation.
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_ref() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_can_access_student(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_can_access_batch(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_student(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_batch(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_batch(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_material(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_material_folder(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_material_class(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homework_row_readable(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homework_storage_readable(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.material_row_readable(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.material_folder_standard_accessible(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.material_storage_object_readable(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_visible(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_test_results() TO authenticated;

-- These SECURITY DEFINER functions are not used by the browser application.
-- Student tests/results are read from the canonical RLS-protected tables.
revoke execute on function public.get_student_tests() from anon, authenticated, public;
revoke execute on function public.get_student_test_results() from anon, authenticated, public;

begin;

-- These SECURITY DEFINER routines are invoked by database triggers, not by
-- application RPC calls. Trigger execution does not require client EXECUTE
-- privilege, so exposing them to authenticated users is unnecessary API
-- surface.

revoke all on function public.repair_orphan_student_user_mirror() from public, anon, authenticated;
revoke all on function public.cleanup_student_account_mirrors_after_delete() from public, anon, authenticated;
revoke all on function public.validate_test_result_integrity() from public, anon, authenticated;

commit;

-- Security hardening: convert helper RPCs that do not need elevated
-- database privileges from SECURITY DEFINER to SECURITY INVOKER.
--
-- These helpers only read the caller's own/session-derived data. The live
-- policy graph was tested with an authenticated admin session before applying
-- this migration. Keep the RLS-critical helpers such as app_role(),
-- current_ref(), is_platform_member(), and user_is_institute_member() as
-- SECURITY DEFINER because they intentionally bridge protected tables.

alter function public.current_person_id() security invoker;
alter function public.current_platform_roles() security invoker;
alter function public.lg_is_admin() security invoker;

-- current_institute_ids() is not referenced by the current application or
-- policy graph, so keep the helper out of the client-callable API surface.
revoke execute on function public.current_institute_ids()
  from public, anon, authenticated;

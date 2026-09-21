-- Security hardening: reduce the exposed SECURITY DEFINER RPC surface.
--
-- These legacy/compression RPCs are not used by the current web application.
-- Keep service_role/postgres execution intact for trusted backend/admin workflows.
revoke execute on function public.assign_institute_membership(uuid, uuid, text)
  from public, anon, authenticated;

revoke execute on function public.create_compression_tenant(text, text)
  from public, anon, authenticated;

revoke execute on function public.retry_pdf_compression_job(uuid)
  from public, anon, authenticated;

-- Make future public-schema functions secure-by-default: callers must be
-- explicitly granted EXECUTE instead of inheriting PUBLIC/anon/authenticated.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

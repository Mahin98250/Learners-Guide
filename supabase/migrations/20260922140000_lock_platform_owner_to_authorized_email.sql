-- Owner panel hardening: bind platform-owner access to the single authorized
-- Google account requested for this deployment.
--
-- The UI exposes Google OAuth only. This database-side check prevents a different
-- authenticated account with an active platform membership from using the owner
-- RPC surface through a modified client.

create or replace function public.current_platform_roles()
returns table (role text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select pm.role
  from public.platform_memberships pm
  where pm.auth_id = auth.uid()
    and pm.status = 'active'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'patelmahin140@gmail.com'
$$;

revoke execute on function public.current_platform_roles() from public, anon;
grant execute on function public.current_platform_roles() to authenticated;

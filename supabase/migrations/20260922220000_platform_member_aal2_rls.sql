-- Owner/control-plane hardening: an active platform membership must also have
-- an AAL2 session before it can satisfy platform-level RLS policies.
--
-- This closes the gap where a valid Google session at AAL1 could read
-- platform-scoped rows before completing the Owner MFA challenge.

create or replace function public.is_platform_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from public.platform_memberships pm
      where pm.auth_id = auth.uid()
        and pm.status = 'active'
    );
$$;

revoke all on function public.is_platform_member() from public, anon;
grant execute on function public.is_platform_member() to authenticated;

-- Security hardening: make Supabase Auth app_metadata the sole role source.
--
-- The current production state has a role in app_metadata for all Auth users,
-- and the application already treats app_metadata.role as the server-managed
-- authorization source. Removing the legacy public.users fallback prevents a
-- legacy mirror row from influencing RLS authorization.

create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select u.raw_app_meta_data ->> 'role'
       from auth.users u
      where u.id = auth.uid()),
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );
$$;

revoke all on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

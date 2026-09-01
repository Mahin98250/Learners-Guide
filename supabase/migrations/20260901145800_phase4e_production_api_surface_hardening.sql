-- Production API surface hardening for Learner's Guide.
-- The app uses Supabase REST/PostgREST, Auth, Storage and Realtime; it has no
-- application GraphQL client. Remove the unused pg_graphql endpoint so schema
-- introspection cannot disclose application tables to signed-in users.
drop extension if exists pg_graphql;

-- Keep future public-schema functions opt-in for API exposure. Existing,
-- explicitly granted functions are intentionally preserved because several are
-- required by RLS policies in the live portals.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

-- The app has no anonymous database table workflow. Keep future tables closed
-- to anon by default while leaving existing authenticated grants untouched.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon;

notify pgrst, 'reload config';

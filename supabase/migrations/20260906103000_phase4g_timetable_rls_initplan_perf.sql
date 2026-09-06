create or replace function public.lg_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.lg_is_admin() from public, anon;
grant execute on function public.lg_is_admin() to authenticated;

drop policy if exists timetable_entries_update on public.timetable_entries;
create policy timetable_entries_update
on public.timetable_entries
for update
to authenticated
using ((select public.lg_is_admin()))
with check ((select public.lg_is_admin()));

drop policy if exists timetable_entries_delete on public.timetable_entries;
create policy timetable_entries_delete
on public.timetable_entries
for delete
to authenticated
using ((select public.lg_is_admin()));

-- Timetable fixes: admin mutation authorization + current multi-subject data repair.
-- Live application of this migration is performed separately in Supabase.

drop policy if exists timetable_entries_update on public.timetable_entries;
create policy timetable_entries_update
  on public.timetable_entries
  for update
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

drop policy if exists timetable_entries_delete on public.timetable_entries;
create policy timetable_entries_delete
  on public.timetable_entries
  for delete
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

update public.timetable_entries
set subject_names = array['English','Social Studies']::text[],
    subject_name = 'English + Social Studies',
    updated_at = now()
where id in ('tt-1786983960239-2-zl0qj','tt-1786983960862-4-wyp4n','tt-1786983961220-6-2e2n6');

-- Guard the admin mutation contract and multi-subject representation.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='timetable_entries'
      and policyname='timetable_entries_update' and cmd='UPDATE'
      and 'authenticated' = any(roles)
  ) then raise exception 'Timetable update policy missing'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='timetable_entries'
      and policyname='timetable_entries_delete' and cmd='DELETE'
      and 'authenticated' = any(roles)
  ) then raise exception 'Timetable delete policy missing'; end if;
end;
$$;

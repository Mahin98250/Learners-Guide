-- PERFORMANCE-ONLY: keep timetable admin mutation authorization statement-cached.
-- This is intentionally identical to the live Phase 4G contract so schema history
-- documents the verification pass without changing authorization semantics.
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

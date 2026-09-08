-- Restore secure admin CRUD for announcements.
-- Audience visibility remains governed by the existing SELECT policy.

alter table public.announcements enable row level security;

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
for insert to authenticated
with check (public.app_role() = 'admin');

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
for update to authenticated
using (public.app_role() = 'admin')
with check (public.app_role() = 'admin');

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
for delete to authenticated
using (public.app_role() = 'admin');

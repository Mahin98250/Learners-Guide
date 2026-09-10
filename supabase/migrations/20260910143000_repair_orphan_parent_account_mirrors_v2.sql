-- Remove parent login mirrors whose auth accounts no longer exist.
-- Parent identity is the Auth account; parent_student_links is the authoritative
-- multi-child relationship, so stale mirrors must not block a new account.
update public.students s
set parent = null
where s.parent is not null
  and s.parent ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (select 1 from auth.users a where a.id = s.parent::uuid);

delete from public.parent_student_links pl
where not exists (select 1 from auth.users a where a.id = pl.parent_auth_id);

delete from public.users u
where u.role = 'parent'
  and u.auth_id is not null
  and not exists (select 1 from auth.users a where a.id = u.auth_id);

delete from public.users u
where u.role = 'parent'
  and u.auth_id is null
  and not exists (select 1 from public.parent_student_links pl where pl.parent_auth_id::text = u.id);

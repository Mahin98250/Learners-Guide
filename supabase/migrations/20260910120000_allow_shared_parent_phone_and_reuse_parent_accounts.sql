begin;

-- One parent phone/login can legitimately belong to multiple student records.
-- The authoritative parent-to-child relationship is parent_student_links.
drop index if exists public.students_parentphone_unique;
create index if not exists idx_students_parentphone
  on public.students(parentphone)
  where parentphone is not null;

-- The legacy users table is only a mirror. Do not let a second child fail
-- because the same parent Auth account already has a users row.
create or replace function public.ignore_duplicate_parent_user_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'parent'
     and new.auth_id is not null
     and exists (select 1 from public.users u where u.id = new.id) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ignore_duplicate_parent_user_mirror on public.users;
create trigger trg_ignore_duplicate_parent_user_mirror
before insert on public.users
for each row execute function public.ignore_duplicate_parent_user_mirror();

revoke all on function public.ignore_duplicate_parent_user_mirror() from public;
grant execute on function public.ignore_duplicate_parent_user_mirror() to service_role;

commit;

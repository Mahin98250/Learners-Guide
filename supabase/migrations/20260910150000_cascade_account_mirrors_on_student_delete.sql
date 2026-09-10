create or replace function public.cleanup_student_account_mirrors_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Student login mirrors are owned by the student record.
  delete from public.users
  where role = 'student'
    and ref = old.id;

  -- Parent mirrors may be shared by multiple children. Remove the legacy
  -- mirror only when this was its last active child link.
  delete from public.users u
  where u.role = 'parent'
    and u.ref = old.id
    and not exists (
      select 1
      from public.parent_student_links l
      where l.parent_auth_id = u.auth_id
        and l.status = 'active'
        and l.student_id <> old.id
    );

  delete from public.parent_student_links
  where student_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_student_account_mirrors_after_delete on public.students;
create trigger trg_cleanup_student_account_mirrors_after_delete
after delete on public.students
for each row
execute function public.cleanup_student_account_mirrors_after_delete();

revoke all on function public.cleanup_student_account_mirrors_after_delete() from public;
grant execute on function public.cleanup_student_account_mirrors_after_delete() to authenticated;

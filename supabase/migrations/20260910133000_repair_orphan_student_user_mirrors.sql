begin;

-- Remove legacy/partial student mirror rows that do not belong to any real student.
delete from public.users u
where u.role = 'student'
  and (u.ref is null or not exists (
    select 1 from public.students s where s.id::text = u.ref::text
  ));

-- Self-heal only an orphan student mirror during a valid new student creation.
-- This preserves the users(role, phone) uniqueness rule while preventing a
-- failed/partial previous attempt from blocking the next valid account.
create or replace function public.repair_orphan_student_user_mirror()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'student'
     and nullif(trim(new.phone), '') is not null
     and new.ref is not null
     and exists (select 1 from public.students s where s.id::text = new.ref::text)
     and exists (
       select 1
       from public.users u
       where u.role = 'student'
         and u.phone = new.phone
         and (u.ref is null or not exists (
           select 1 from public.students s where s.id::text = u.ref::text
         ))
     ) then
    delete from public.users u
    where u.role = 'student'
      and u.phone = new.phone
      and (u.ref is null or not exists (
        select 1 from public.students s where s.id::text = u.ref::text
      ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_repair_orphan_student_user_mirror on public.users;
create trigger trg_repair_orphan_student_user_mirror
before insert on public.users
for each row execute function public.repair_orphan_student_user_mirror();

revoke all on function public.repair_orphan_student_user_mirror() from public;
grant execute on function public.repair_orphan_student_user_mirror() to authenticated;

commit;

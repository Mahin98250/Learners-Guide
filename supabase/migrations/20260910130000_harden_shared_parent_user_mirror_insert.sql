begin;

-- A parent Auth account is intentionally shared across multiple children.
-- The legacy public.users row is a mirror, so a second child must not
-- attempt to create a second (role,parent-phone) mirror row.
create or replace function public.ignore_duplicate_parent_user_mirror()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'parent'
     and nullif(trim(new.phone), '') is not null
     and exists (
       select 1
       from public.users u
       where u.role = 'parent'
         and u.phone = new.phone
     ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ignore_duplicate_parent_user_mirror on public.users;
create trigger trg_ignore_duplicate_parent_user_mirror
before insert on public.users
for each row
execute function public.ignore_duplicate_parent_user_mirror();

revoke all on function public.ignore_duplicate_parent_user_mirror() from public;
grant execute on function public.ignore_duplicate_parent_user_mirror() to service_role;

commit;

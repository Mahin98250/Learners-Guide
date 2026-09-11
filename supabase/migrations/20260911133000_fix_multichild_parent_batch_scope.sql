begin;

-- Parent authorization must be based on all active parent_student_links, not the
-- legacy single-value current_ref(). This is required for parents with more than
-- one child, especially when children belong to different batches/classes.

create or replace function public.homework_row_readable(
  p_id text,
  p_batch_id text,
  p_cls text,
  p_sec text,
  p_tid text
)
returns boolean
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if public.app_role() = 'admin' then
    return true;
  end if;

  if public.app_role() = 'teacher' then
    return p_tid is not null and p_tid = public.current_ref();
  end if;

  if public.app_role() = 'parent' then
    if p_batch_id is not null then
      return public.parent_can_access_batch(p_batch_id);
    end if;

    return exists (
      select 1
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id
      where psl.parent_auth_id = auth.uid()
        and psl.status = 'active'
        and coalesce(s.status, 'active') = 'active'
        and s.cls = p_cls
        and (p_sec is null or p_sec = '' or s.sec = p_sec)
    );
  end if;

  if public.app_role() = 'student' then
    if p_batch_id is not null then
      return public.student_can_access_batch(p_batch_id, public.current_ref());
    end if;

    return exists (
      select 1
      from public.students s
      where s.id = public.current_ref()
        and s.cls = p_cls
        and (p_sec is null or p_sec = '' or s.sec = p_sec)
    );
  end if;

  return false;
end;
$$;

create or replace function public.material_row_readable(
  p_batch_id text,
  p_cls text,
  p_sec text
)
returns boolean
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if public.app_role() = 'admin' then
    return true;
  end if;

  if public.app_role() = 'teacher' then
    return p_batch_id is null
      or public.teacher_can_access_batch(p_batch_id, public.current_ref());
  end if;

  if public.app_role() = 'parent' then
    if p_batch_id is not null then
      return public.parent_can_access_batch(p_batch_id);
    end if;

    return exists (
      select 1
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id
      where psl.parent_auth_id = auth.uid()
        and psl.status = 'active'
        and coalesce(s.status, 'active') = 'active'
        and (p_cls is null or s.cls = p_cls)
        and (p_sec is null or p_sec = '' or s.sec = p_sec)
    );
  end if;

  if public.app_role() = 'student' then
    if p_batch_id is not null then
      return public.student_can_access_batch(p_batch_id, public.current_ref());
    end if;

    return exists (
      select 1
      from public.students s
      where s.id = public.current_ref()
        and coalesce(s.status, 'active') = 'active'
        and (p_cls is null or s.cls = p_cls)
        and (p_sec is null or p_sec = '' or s.sec = p_sec)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.homework_row_readable(text,text,text,text,text) from public, anon;
grant execute on function public.homework_row_readable(text,text,text,text,text) to authenticated;

revoke all on function public.material_row_readable(text,text,text) from public, anon;
grant execute on function public.material_row_readable(text,text,text) to authenticated;

commit;

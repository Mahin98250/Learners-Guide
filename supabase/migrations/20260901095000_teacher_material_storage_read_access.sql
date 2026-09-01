create or replace function public.material_storage_object_readable(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.app_role() not in ('student','parent','teacher','admin') then false
    when public.app_role() = 'admin' then true
    when exists (
      select 1
      from public.materials m
      where m.storage_path = object_name
        and (
          (public.app_role() = 'teacher' and (
            m.tid = public.current_ref()
            or (m.folder_id is not null and public.teacher_material_folder_accessible(m.folder_id, public.current_ref()))
            or (m.folder_id is null and m.batch_id is not null and public.teacher_can_access_batch(m.batch_id, public.current_ref()))
          ))
          or (public.app_role() in ('student','parent') and (
            (m.folder_id is not null and public.material_folder_standard_accessible(m.folder_id, public.current_ref()))
            or (m.folder_id is null and public.material_row_readable(m.batch_id, m.cls, m.sec))
          ))
        )
    ) then true
    else false
  end;
$$;
revoke all on function public.material_storage_object_readable(text) from public;
grant execute on function public.material_storage_object_readable(text) to authenticated;

-- Allow teachers to manage their own class-scoped material folders.
create or replace function public.teacher_material_folder_accessible(
  p_folder_id uuid,
  p_teacher_ref text default public.current_ref()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive ancestors as (
    select mf.id, mf.parent_id, mf.access_standards
    from public.material_folders mf
    where mf.id = p_folder_id
    union all
    select parent.id, parent.parent_id, parent.access_standards
    from public.material_folders parent
    join ancestors child on child.parent_id = parent.id
  ),
  teacher_standards as (
    select distinct regexp_replace(lower(coalesce(b.cls, '')), '[^0-9]', '', 'g') as standard
    from public.batches b
    join public.timetable_entries te on te.batch_id = b.id
    where te.teacher_id = p_teacher_ref
      and te.status = 'active'
      and coalesce(b.status, 'active') = 'active'
      and regexp_replace(lower(coalesce(b.cls, '')), '[^0-9]', '', 'g') <> ''
  )
  select
    public.app_role() = 'teacher'
    and exists (
      select 1
      from ancestors a
      cross join teacher_standards ts
      where ts.standard = any(a.access_standards)
    );
$$;

revoke all on function public.teacher_material_folder_accessible(uuid, text) from public;
grant execute on function public.teacher_material_folder_accessible(uuid, text) to authenticated;

drop policy if exists material_folders_select on public.material_folders;
create policy material_folders_select
on public.material_folders
for select to authenticated
using (
  public.app_role() = 'admin'
  or (public.app_role() in ('student','parent') and public.material_folder_standard_accessible(id, public.current_ref()))
  or (
    public.app_role() = 'teacher'
    and (
      created_by = auth.uid()
      or public.teacher_material_folder_accessible(id, public.current_ref())
    )
  )
);

drop policy if exists material_folders_insert on public.material_folders;
create policy material_folders_insert
on public.material_folders
for insert to authenticated
with check (
  public.app_role() = 'admin'
  or (
    public.app_role() = 'teacher'
    and created_by = auth.uid()
    and (
      parent_id is null
      or public.teacher_material_folder_accessible(parent_id, public.current_ref())
      or exists (
        select 1 from public.material_folders parent
        where parent.id = parent_id
          and parent.created_by = auth.uid()
      )
    )
  )
);

drop policy if exists material_folders_update on public.material_folders;
create policy material_folders_update
on public.material_folders
for update to authenticated
using (
  public.app_role() = 'admin'
  or (public.app_role() = 'teacher' and created_by = auth.uid())
)
with check (
  public.app_role() = 'admin'
  or (public.app_role() = 'teacher' and created_by = auth.uid())
);

drop policy if exists material_folders_delete on public.material_folders;
create policy material_folders_delete
on public.material_folders
for delete to authenticated
using (
  public.app_role() = 'admin'
  or (public.app_role() = 'teacher' and created_by = auth.uid())
);

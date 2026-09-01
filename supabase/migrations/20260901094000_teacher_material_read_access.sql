-- Let teachers read standard-scoped folder materials and their own legacy materials.
drop policy if exists materials_select_authenticated on public.materials;
create policy materials_select_authenticated
on public.materials
for select to authenticated
using (
  public.app_role() = 'admin'
  or (
    public.app_role() in ('student','parent')
    and (
      (folder_id is not null and public.material_folder_standard_accessible(folder_id, public.current_ref()))
      or (folder_id is null and public.student_can_access_material(cls, sec, batch_id))
    )
  )
  or (
    public.app_role() = 'teacher'
    and (
      tid = public.current_ref()
      or (folder_id is not null and public.teacher_material_folder_accessible(folder_id, public.current_ref()))
      or (folder_id is null and batch_id is not null and public.teacher_can_access_batch(batch_id, public.current_ref()))
    )
  )
);

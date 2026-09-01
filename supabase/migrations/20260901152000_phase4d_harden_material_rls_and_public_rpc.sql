begin;

-- Keep RLS helper execution available to authenticated callers because these
-- functions are invoked from row policies, but remove unintended anonymous
-- RPC access to the teacher material helper.
revoke execute on function public.teacher_material_folder_accessible(uuid, text) from anon;

-- Cache stable auth/helper lookups once per statement instead of re-evaluating
-- them for every candidate row. This preserves the existing authorization
-- logic while improving RLS performance at scale.
drop policy if exists material_folders_select on public.material_folders;
create policy material_folders_select on public.material_folders
for select to authenticated
using (
  (select public.app_role()) = 'admin'
  or (
    (select public.app_role()) = any (array['student','parent'])
    and public.material_folder_standard_accessible(id, (select public.current_ref()))
  )
  or (
    (select public.app_role()) = 'teacher'
    and (
      created_by = (select auth.uid())
      or public.teacher_material_folder_accessible(id, (select public.current_ref()))
    )
  )
);

drop policy if exists material_folders_insert on public.material_folders;
create policy material_folders_insert on public.material_folders
for insert to authenticated
with check (
  (select public.app_role()) = 'admin'
  or (
    (select public.app_role()) = 'teacher'
    and created_by = (select auth.uid())
    and (
      parent_id is null
      or public.teacher_material_folder_accessible(parent_id, (select public.current_ref()))
      or exists (
        select 1
        from public.material_folders parent
        where parent.id = parent.parent_id
          and parent.created_by = (select auth.uid())
      )
    )
  )
);

drop policy if exists material_folders_update on public.material_folders;
create policy material_folders_update on public.material_folders
for update to authenticated
using (
  (select public.app_role()) = 'admin'
  or (
    (select public.app_role()) = 'teacher'
    and created_by = (select auth.uid())
  )
)
with check (
  (select public.app_role()) = 'admin'
  or (
    (select public.app_role()) = 'teacher'
    and created_by = (select auth.uid())
  )
);

drop policy if exists material_folders_delete on public.material_folders;
create policy material_folders_delete on public.material_folders
for delete to authenticated
using (
  (select public.app_role()) = 'admin'
  or (
    (select public.app_role()) = 'teacher'
    and created_by = (select auth.uid())
  )
);

commit;

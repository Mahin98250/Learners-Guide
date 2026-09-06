-- Phase 4A: harden SECURITY DEFINER helper execution without breaking RLS.
--
-- RLS policy predicates execute in the context of the signed-in database role,
-- so authenticated EXECUTE must remain for helpers used by current policies.
-- Anonymous/public execution is not needed because the protected table policies
-- target authenticated sessions and the helpers are not pre-auth endpoints.

revoke execute on function public.app_role() from public, anon;
revoke execute on function public.current_ref() from public, anon;
revoke execute on function public.current_role() from public, anon;
revoke execute on function public.parent_can_access_student(text) from public, anon;
revoke execute on function public.parent_can_access_batch(text) from public, anon;
revoke execute on function public.teacher_can_access_student(text, text) from public, anon;
revoke execute on function public.teacher_can_access_batch(text, text) from public, anon;
revoke execute on function public.student_can_access_batch(text, text) from public, anon;
revoke execute on function public.student_can_access_material(text, text, text) from public, anon;
revoke all on function public.student_can_access_material_folder(uuid, text) from public, anon, authenticated;
revoke all on function public.teacher_can_access_material_class(text) from public, anon, authenticated;
revoke execute on function public.homework_row_readable(text, text, text, text, text) from public, anon;
revoke execute on function public.homework_storage_readable(text) from public, anon;
revoke execute on function public.material_row_readable(text, text, text) from public, anon;
revoke execute on function public.material_folder_standard_accessible(uuid, text) from public, anon;

grant execute on function public.app_role() to authenticated;
grant execute on function public.current_ref() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.parent_can_access_student(text) to authenticated;
grant execute on function public.parent_can_access_batch(text) to authenticated;
grant execute on function public.teacher_can_access_student(text, text) to authenticated;
grant execute on function public.teacher_can_access_batch(text, text) to authenticated;
grant execute on function public.student_can_access_batch(text, text) to authenticated;
grant execute on function public.student_can_access_material(text, text, text) to authenticated;
grant execute on function public.homework_row_readable(text, text, text, text, text) to authenticated;
grant execute on function public.homework_storage_readable(text) to authenticated;
grant execute on function public.material_row_readable(text, text, text) to authenticated;
grant execute on function public.material_folder_standard_accessible(uuid, text) to authenticated;

-- Post-change verification: fail the migration if any protected helper is missing
-- or if its intended API privilege contract is not in force.
do $$
declare
  helper text;
  helpers text[] := array[
    'public.app_role()',
    'public.current_ref()',
    'public.current_role()',
    'public.parent_can_access_student(text)',
    'public.parent_can_access_batch(text)',
    'public.teacher_can_access_student(text,text)',
    'public.teacher_can_access_batch(text,text)',
    'public.student_can_access_batch(text,text)',
    'public.student_can_access_material(text,text,text)',
    'public.student_can_access_material_folder(uuid,text)',
    'public.teacher_can_access_material_class(text)',
    'public.homework_row_readable(text,text,text,text,text)',
    'public.homework_storage_readable(text)',
    'public.material_row_readable(text,text,text)',
    'public.material_folder_standard_accessible(uuid,text)'
  ];
begin
  foreach helper in array helpers loop
    if to_regprocedure(helper) is null then
      raise exception 'Phase 4A verification failed: missing function %', helper;
    end if;
  end loop;

  foreach helper in array[
    'public.app_role()',
    'public.current_ref()',
    'public.current_role()',
    'public.parent_can_access_student(text)',
    'public.parent_can_access_batch(text)',
    'public.teacher_can_access_student(text,text)',
    'public.teacher_can_access_batch(text,text)',
    'public.student_can_access_batch(text,text)',
    'public.student_can_access_material(text,text,text)',
    'public.homework_row_readable(text,text,text,text,text)',
    'public.homework_storage_readable(text)',
    'public.material_row_readable(text,text,text)',
    'public.material_folder_standard_accessible(uuid,text)'
  ] loop
    if not has_function_privilege('authenticated', helper, 'EXECUTE') then
      raise exception 'Phase 4A verification failed: authenticated EXECUTE missing for %', helper;
    end if;
    if has_function_privilege('anon', helper, 'EXECUTE') then
      raise exception 'Phase 4A verification failed: anon EXECUTE still present for %', helper;
    end if;
  end loop;

  foreach helper in array[
    'public.student_can_access_material_folder(uuid,text)',
    'public.teacher_can_access_material_class(text)'
  ] loop
    if has_function_privilege('authenticated', helper, 'EXECUTE') then
      raise exception 'Phase 4A verification failed: legacy helper still executable by authenticated role %', helper;
    end if;
    if has_function_privilege('anon', helper, 'EXECUTE') then
      raise exception 'Phase 4A verification failed: legacy helper still executable by anon role %', helper;
    end if;
  end loop;
end;
$$;

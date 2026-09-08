-- Phase 4: reconcile legacy SECURITY DEFINER helper execution privileges.
--
-- Live policy inspection confirms these historical helpers are no longer referenced
-- by active RLS predicates. Keep their bodies for compatibility, but remove API
-- execution from all caller roles so they cannot be invoked through PostgREST/RPC.

revoke all on function public.student_can_access_material_folder(uuid, text) from public, anon, authenticated;
revoke all on function public.teacher_can_access_material_class(text) from public, anon, authenticated;

do $$
begin
  if has_function_privilege('authenticated', 'public.student_can_access_material_folder(uuid,text)', 'EXECUTE') then
    raise exception 'Phase 4 verification failed: legacy student material-folder helper is still executable';
  end if;
  if has_function_privilege('authenticated', 'public.teacher_can_access_material_class(text)', 'EXECUTE') then
    raise exception 'Phase 4 verification failed: legacy teacher material-class helper is still executable';
  end if;
  if has_function_privilege('anon', 'public.student_can_access_material_folder(uuid,text)', 'EXECUTE') then
    raise exception 'Phase 4 verification failed: anon can execute legacy student material-folder helper';
  end if;
  if has_function_privilege('anon', 'public.teacher_can_access_material_class(text)', 'EXECUTE') then
    raise exception 'Phase 4 verification failed: anon can execute legacy teacher material-class helper';
  end if;
end;
$$;

-- Phase 5: runtime feature entitlement enforcement foundation.
-- Existing platform owner feature mutation RPC remains the source of truth.
-- This adds the current-user tenant-aware runtime check used by application gates.

create or replace function public.current_institute_feature_enabled(p_feature_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.institute_memberships m
    join public.institute_feature_entitlements e
      on e.institute_id = m.institute_id
    join public.platform_features f
      on f.code = e.feature_code
    where m.person_id = (
      select p.id
      from public.people p
      where p.auth_id = auth.uid()
      limit 1
    )
      and m.status = 'active'
      and e.feature_code = lower(trim(p_feature_code))
      and e.enabled = true
      and f.status = 'active'
  )
$function$;

revoke all on function public.current_institute_feature_enabled(text) from public, anon;
grant execute on function public.current_institute_feature_enabled(text) to authenticated;

drop policy if exists institute_feature_entitlements_member_read on public.institute_feature_entitlements;
create policy institute_feature_entitlements_member_read on public.institute_feature_entitlements
for select to authenticated
using (public.user_is_institute_member(institute_id));

-- Platform Owner Security posture.
-- Exposes only non-sensitive security state; no emails, factor secrets, actor identities,
-- raw auth records, or individual memberships are returned.

create or replace function public.platform_get_security_overview()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_owner_access boolean;
  v_platform_owner_role boolean;
  v_audit_events bigint;
  v_domains bigint;
  v_verified_tls bigint;
  v_failed_tls bigint;
begin
  v_owner_access := public.platform_owner_access_ok();
  select exists (
    select 1
    from public.platform_memberships pm
    where pm.auth_id = auth.uid()
      and pm.status = 'active'
      and pm.role in ('platform_owner','platform_admin')
  ) into v_platform_owner_role;

  select count(*) into v_audit_events
  from public.audit_logs
  where scope = 'platform';

  select count(*) into v_domains
  from public.institute_domains;

  select count(*) into v_verified_tls
  from public.institute_domains
  where status = 'verified' and tls_status = 'active';

  select count(*) into v_failed_tls
  from public.institute_domains
  where tls_status = 'failed';

  return jsonb_build_object(
    'owner_access_granted', v_owner_access,
    'owner_membership_present', v_platform_owner_role,
    'mfa_required', true,
    'backend_owner_gate', true,
    'audit_logging_enabled', v_audit_events >= 0,
    'domain_tls_active', v_verified_tls,
    'domain_tls_failed', v_failed_tls,
    'registered_domains', v_domains
  );
end;
$$;

revoke all on function public.platform_get_security_overview() from public, anon;
grant execute on function public.platform_get_security_overview() to authenticated;

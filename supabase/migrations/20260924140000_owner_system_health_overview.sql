create or replace function public.platform_get_system_health()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_total_institutes integer := 0;
  v_active_institutes integer := 0;
  v_domain_count integer := 0;
  v_primary_domain_count integer := 0;
  v_storage_bucket_count integer := 0;
  v_audit_count bigint := 0;
  v_last_audit_at timestamptz;
  v_platform_settings_exists boolean := false;
  v_default_domain text;
  v_default_subdomains boolean := false;
  v_checks jsonb;
  v_overall text := 'healthy';
begin
  if not public.platform_owner_access_ok() then raise exception 'Unauthorized'; end if;
  select count(*), count(*) filter (where status='active') into v_total_institutes,v_active_institutes from public.institutes;
  select count(*), count(*) filter (where is_primary=true and status in ('active','verified')) into v_domain_count,v_primary_domain_count from public.institute_domains;
  select count(*) into v_storage_bucket_count from storage.buckets;
  select count(*), max(created_at) into v_audit_count,v_last_audit_at from public.audit_logs;
  select true, ps.default_app_domain, coalesce((ps.settings->>'default_subdomains_enabled')::boolean,false)
    into v_platform_settings_exists,v_default_domain,v_default_subdomains
    from public.platform_settings ps where ps.id=1 limit 1;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','database','label','Database','status','healthy','message','Platform database responded successfully.','detail','Core platform queries are responding.'),
    jsonb_build_object('key','institutes','label','Institute registry','status',case when v_total_institutes>0 then 'healthy' else 'attention' end,'message',case when v_total_institutes>0 then v_total_institutes||' institute(s) registered.' else 'No institutes are registered yet.' end,'detail',v_active_institutes||' active institute(s).'),
    jsonb_build_object('key','domains','label','Tenant domains','status',case when v_total_institutes=0 then 'healthy' when v_primary_domain_count>=v_active_institutes then 'healthy' when v_primary_domain_count>0 then 'degraded' else 'attention' end,'message',v_primary_domain_count||' primary domain(s) active across '||v_domain_count||' registered domain(s).','detail',case when v_active_institutes=0 then 'No active institutes require a primary domain.' else 'Active institutes: '||v_active_institutes end),
    jsonb_build_object('key','storage','label','Storage service','status',case when v_storage_bucket_count>0 then 'healthy' else 'attention' end,'message',v_storage_bucket_count||' storage bucket(s) available.','detail','Supabase Storage bucket registry is reachable.'),
    jsonb_build_object('key','configuration','label','Platform configuration','status',case when not v_platform_settings_exists then 'attention' when v_default_subdomains and coalesce(nullif(trim(v_default_domain),''),'')='' then 'attention' else 'healthy' end,'message',case when not v_platform_settings_exists then 'Platform settings are missing.' when v_default_subdomains and coalesce(nullif(trim(v_default_domain),''),'')='' then 'Automatic subdomains are enabled without a default app domain.' else 'Platform settings are configured.' end,'detail',case when v_default_subdomains then 'Automatic institute subdomains enabled.' else 'Automatic institute subdomains disabled.' end),
    jsonb_build_object('key','audit','label','Audit trail','status',case when v_audit_count>0 then 'healthy' else 'degraded' end,'message',case when v_audit_count>0 then v_audit_count||' audit event(s) recorded.' else 'No audit events are recorded yet.' end,'detail',case when v_last_audit_at is null then 'No latest audit timestamp.' else 'Latest event: '||to_char(v_last_audit_at at time zone 'UTC','YYYY-MM-DD HH24:MI UTC') end)
  );
  if exists(select 1 from jsonb_array_elements(v_checks) c where c->>'status'='attention') then v_overall:='attention';
  elsif exists(select 1 from jsonb_array_elements(v_checks) c where c->>'status'='degraded') then v_overall:='degraded'; end if;
  return jsonb_build_object('overall',v_overall,'checked_at',now(),
    'summary',jsonb_build_object('institutes',v_total_institutes,'active_institutes',v_active_institutes,'registered_domains',v_domain_count,'primary_domains',v_primary_domain_count,'storage_buckets',v_storage_bucket_count,'audit_events',v_audit_count),
    'configuration',jsonb_build_object('default_app_domain',v_default_domain,'automatic_subdomains_enabled',v_default_subdomains),'checks',v_checks);
end;
$$;
revoke all on function public.platform_get_system_health() from public, anon;
grant execute on function public.platform_get_system_health() to authenticated;
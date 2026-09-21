-- Cover the three foreign keys reported by the Supabase performance advisor.
create index if not exists idx_audit_logs_actor_person_id
  on public.audit_logs(actor_person_id);

create index if not exists idx_compression_tenant_memberships_user_id
  on public.compression_tenant_memberships(user_id);

create index if not exists idx_compression_tenants_created_by
  on public.compression_tenants(created_by);

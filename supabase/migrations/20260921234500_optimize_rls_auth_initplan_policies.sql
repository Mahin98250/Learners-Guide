-- Optimize Supabase RLS policies by evaluating auth.uid() once per statement.
-- Semantics are unchanged; only the init-plan shape is adjusted.

alter policy compression_tenant_memberships_member_read on public.compression_tenant_memberships using (
  (user_id = (select auth.uid())) or exists (
    select 1 from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_memberships.tenant_id
      and m.user_id = (select auth.uid())
      and m.membership_role = any (array['owner'::text,'operator'::text])
  )
);

alter policy compression_tenant_sources_member_read on public.compression_tenant_sources using (
  exists (select 1 from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = (select auth.uid()))
);

alter policy compression_tenant_sources_owner_delete on public.compression_tenant_sources using (
  (app_role() = 'admin'::text) and exists (
    select 1 from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = (select auth.uid())
      and m.membership_role = 'owner'::text)
);

alter policy compression_tenant_sources_owner_insert on public.compression_tenant_sources with check (
  (app_role() = 'admin'::text) and exists (
    select 1 from public.compression_tenant_memberships m
    join public.compression_tenants t on t.id = m.tenant_id
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = (select auth.uid())
      and m.membership_role = 'owner'::text
      and t.status = 'active'::text
  ) and (
    (source_bucket = 'homework'::text and exists (
      select 1 from public.homework h
      where h.storage_path = compression_tenant_sources.source_path
        and h.storage_path is not null
        and (compression_tenant_sources.source_record_id is null or h.id = compression_tenant_sources.source_record_id)
    )) or
    (source_bucket = 'materials'::text and exists (
      select 1 from public.materials m
      where m.storage_path = compression_tenant_sources.source_path
        and m.storage_path is not null
        and (compression_tenant_sources.source_record_id is null or m.id = compression_tenant_sources.source_record_id)
    ))
  )
);

alter policy compression_tenant_sources_owner_update on public.compression_tenant_sources
using (
  (app_role() = 'admin'::text) and exists (
    select 1 from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = (select auth.uid())
      and m.membership_role = 'owner'::text)
)
with check (
  (app_role() = 'admin'::text) and exists (
    select 1 from public.compression_tenant_memberships m
    join public.compression_tenants t on t.id = m.tenant_id
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = (select auth.uid())
      and m.membership_role = 'owner'::text
      and t.status = 'active'::text
  ) and (
    (source_bucket = 'homework'::text and exists (
      select 1 from public.homework h
      where h.storage_path = compression_tenant_sources.source_path
        and h.storage_path is not null
        and (compression_tenant_sources.source_record_id is null or h.id = compression_tenant_sources.source_record_id)
    )) or
    (source_bucket = 'materials'::text and exists (
      select 1 from public.materials m
      where m.storage_path = compression_tenant_sources.source_path
        and m.storage_path is not null
        and (compression_tenant_sources.source_record_id is null or m.id = compression_tenant_sources.source_record_id)
    ))
  )
);

alter policy compression_tenants_member_read on public.compression_tenants using (
  exists (select 1 from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenants.id and m.user_id = (select auth.uid()))
);

alter policy institute_memberships_self_or_platform_read on public.institute_memberships using (
  is_platform_member() or exists (
    select 1 from public.people p
    where p.id = institute_memberships.person_id
      and p.auth_id = (select auth.uid()))
);

alter policy pdf_compression_jobs_member_insert on public.pdf_compression_jobs with check (
  requested_by = (select auth.uid()) and exists (
    select 1 from public.compression_tenant_memberships m
    where m.tenant_id = pdf_compression_jobs.tenant_id
      and m.user_id = (select auth.uid()))
);

alter policy pdf_compression_jobs_member_read on public.pdf_compression_jobs using (
  exists (select 1 from public.compression_tenant_memberships m
    where m.tenant_id = pdf_compression_jobs.tenant_id
      and m.user_id = (select auth.uid()))
);

alter policy people_self_read on public.people using (
  (auth_id = (select auth.uid())) or is_platform_member()
);

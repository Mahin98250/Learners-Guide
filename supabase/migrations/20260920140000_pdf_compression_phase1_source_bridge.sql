-- Phase 1.1: bind existing Learner's Guide PDF sources to the compression tenant.
-- This bridges the current single-institute data model without inventing a second
-- institute/customer identity model. Phase 2 can replace this bridge when the
-- application gains a first-class SaaS tenant registry.

alter table public.compression_tenant_sources
  add column if not exists source_record_id text;

drop policy if exists compression_tenant_sources_member_read on public.compression_tenant_sources;
create policy compression_tenant_sources_member_read
on public.compression_tenant_sources
for select to authenticated
using (
  exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists compression_tenant_sources_owner_insert on public.compression_tenant_sources;
create policy compression_tenant_sources_owner_insert
on public.compression_tenant_sources
for insert to authenticated
with check (
  public.app_role() = 'admin'
  and exists (
    select 1
    from public.compression_tenant_memberships m
    join public.compression_tenants t on t.id = m.tenant_id
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = auth.uid()
      and m.membership_role = 'owner'
      and t.status = 'active'
  )
  and (
    (
      source_bucket = 'homework'
      and exists (
        select 1
        from public.homework h
        where h.storage_path = compression_tenant_sources.source_path
          and h.storage_path is not null
          and (
            compression_tenant_sources.source_record_id is null
            or h.id = compression_tenant_sources.source_record_id
          )
      )
    )
    or (
      source_bucket = 'materials'
      and exists (
        select 1
        from public.materials m
        where m.storage_path = compression_tenant_sources.source_path
          and m.storage_path is not null
          and (
            compression_tenant_sources.source_record_id is null
            or m.id = compression_tenant_sources.source_record_id
          )
      )
    )
  )
);

drop policy if exists compression_tenant_sources_owner_update on public.compression_tenant_sources;
create policy compression_tenant_sources_owner_update
on public.compression_tenant_sources
for update to authenticated
using (
  public.app_role() = 'admin'
  and exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = auth.uid()
      and m.membership_role = 'owner'
  )
)
with check (
  public.app_role() = 'admin'
  and exists (
    select 1
    from public.compression_tenant_memberships m
    join public.compression_tenants t on t.id = m.tenant_id
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = auth.uid()
      and m.membership_role = 'owner'
      and t.status = 'active'
  )
  and (
    (
      source_bucket = 'homework'
      and exists (
        select 1
        from public.homework h
        where h.storage_path = compression_tenant_sources.source_path
          and h.storage_path is not null
          and (
            compression_tenant_sources.source_record_id is null
            or h.id = compression_tenant_sources.source_record_id
          )
      )
    )
    or (
      source_bucket = 'materials'
      and exists (
        select 1
        from public.materials m
        where m.storage_path = compression_tenant_sources.source_path
          and m.storage_path is not null
          and (
            compression_tenant_sources.source_record_id is null
            or m.id = compression_tenant_sources.source_record_id
          )
      )
    )
  )
);

drop policy if exists compression_tenant_sources_owner_delete on public.compression_tenant_sources;
create policy compression_tenant_sources_owner_delete
on public.compression_tenant_sources
for delete to authenticated
using (
  public.app_role() = 'admin'
  and exists (
    select 1
    from public.compression_tenant_memberships m
    where m.tenant_id = compression_tenant_sources.tenant_id
      and m.user_id = auth.uid()
      and m.membership_role = 'owner'
  )
);

-- Operators may read already-bound sources but cannot create arbitrary bindings.
revoke insert, update, delete on public.compression_tenant_sources from authenticated;
grant insert, update, delete on public.compression_tenant_sources to authenticated;

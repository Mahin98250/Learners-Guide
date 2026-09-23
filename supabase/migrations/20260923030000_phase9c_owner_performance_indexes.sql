-- Phase 9C: forward-only performance indexes for the Owner control plane.
--
-- Keep prior migrations immutable. These indexes support the unfiltered
-- keyset directory and the on-demand tenant detail fan-out queries.

create index if not exists institutes_created_id_idx
  on public.institutes (created_at desc, id desc);

create index if not exists institute_domains_institute_created_id_idx
  on public.institute_domains (institute_id, created_at desc, id desc);

create index if not exists institute_feature_entitlements_institute_feature_idx
  on public.institute_feature_entitlements (institute_id, feature_code);

create index if not exists institute_memberships_institute_status_idx
  on public.institute_memberships (institute_id, status);

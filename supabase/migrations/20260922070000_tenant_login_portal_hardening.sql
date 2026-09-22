-- Tenant-aware login portal hardening.
--
-- Keep the existing single-database architecture, but make the original
-- bootstrap institute use the current Mahin branding and document the
-- tenant-boundary expectations used by the login gateway.

update public.institutes
set name = 'Mahin',
    slug = 'mahin',
    updated_at = now()
where id = (
  select id
  from public.institutes
  where slug in ('learners-guide', 'mahin')
  order by case when slug = 'learners-guide' then 0 else 1 end, created_at
  limit 1
);

update public.institute_settings s
set display_name = coalesce(nullif(trim(s.display_name), ''), 'Mahin'),
    short_name = 'Mahin',
    updated_at = now()
where s.institute_id = (
  select id
  from public.institutes
  where slug = 'mahin'
  limit 1
);

update public.institute_settings
set display_name = 'Mahin',
    short_name = 'Mahin',
    updated_at = now()
where lower(trim(coalesce(display_name, ''))) in ('learner''s guide', 'learners guide')
   or lower(trim(coalesce(short_name, ''))) in ('learner''s guide', 'learners guide');

comment on table public.institute_domains is
  'Verified hostnames select the institute login portal before authentication. Keep one shared application/database; bind login to the resolved institute membership.';

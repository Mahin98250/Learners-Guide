-- Temporary platform brand while the permanent company name is undecided.
-- Learner's Guide remains an institute/tenant and is not renamed.
update public.platform_settings
set product_name = 'Mahin'
where id = 1
  and coalesce(product_name, '') = 'Learner''s Guide';

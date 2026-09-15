begin;

-- Provider-neutral metadata. Existing rows remain on the current Supabase
-- Storage provider until they are explicitly migrated to Google Drive.
alter table public.materials
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists storage_file_id text,
  add column if not exists storage_status text not null default 'legacy',
  add column if not exists storage_upload_id uuid,
  add column if not exists storage_checksum text,
  add column if not exists storage_checksum_algorithm text,
  add column if not exists storage_error text;

alter table public.homework
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists storage_file_id text,
  add column if not exists storage_status text not null default 'legacy',
  add column if not exists storage_upload_id uuid,
  add column if not exists storage_checksum text,
  add column if not exists storage_checksum_algorithm text,
  add column if not exists storage_error text;

alter table public.materials
  drop constraint if exists materials_storage_provider_check,
  drop constraint if exists materials_storage_status_check;

alter table public.materials
  add constraint materials_storage_provider_check
    check (storage_provider in ('supabase', 'google_drive')),
  add constraint materials_storage_status_check
    check (storage_status in ('legacy', 'pending', 'uploading', 'complete', 'failed', 'deleting', 'missing', 'trashed'));

alter table public.homework
  drop constraint if exists homework_storage_provider_check,
  drop constraint if exists homework_storage_status_check;

alter table public.homework
  add constraint homework_storage_provider_check
    check (storage_provider in ('supabase', 'google_drive')),
  add constraint homework_storage_status_check
    check (storage_status in ('legacy', 'pending', 'uploading', 'complete', 'failed', 'deleting', 'missing', 'trashed'));

create unique index if not exists materials_storage_file_id_unique_idx
  on public.materials (storage_file_id)
  where storage_file_id is not null;

create unique index if not exists homework_storage_file_id_unique_idx
  on public.homework (storage_file_id)
  where storage_file_id is not null;

create index if not exists materials_storage_upload_id_idx
  on public.materials (storage_upload_id)
  where storage_upload_id is not null;

create index if not exists homework_storage_upload_id_idx
  on public.homework (storage_upload_id)
  where storage_upload_id is not null;

create index if not exists materials_storage_status_idx
  on public.materials (storage_status);

create index if not exists homework_storage_status_idx
  on public.homework (storage_status);

comment on column public.materials.storage_provider is
  'Physical file provider. Existing records default to supabase during migration.';
comment on column public.materials.storage_file_id is
  'Provider file identifier. For google_drive this is the private Drive fileId.';
comment on column public.homework.storage_provider is
  'Physical file provider. Existing records default to supabase during migration.';
comment on column public.homework.storage_file_id is
  'Provider file identifier. For google_drive this is the private Drive fileId.';

commit;

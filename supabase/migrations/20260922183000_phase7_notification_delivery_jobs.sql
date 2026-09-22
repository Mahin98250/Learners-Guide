-- Phase 7 delivery pipeline: durable per-channel notification jobs.
-- Provider-neutral foundation. External provider credentials stay outside
-- browser-readable tables and are not enabled by this migration.

create table if not exists public.notification_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  notification_id text not null references public.notifications(id) on delete cascade,
  recipient_auth_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('web_push','email','whatsapp','sms')),
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','blocked','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, recipient_auth_id, channel)
);

create index if not exists notification_delivery_jobs_pending_idx
  on public.notification_delivery_jobs (status, available_at, created_at)
  where status in ('pending','failed');

create index if not exists notification_delivery_jobs_institute_idx
  on public.notification_delivery_jobs (institute_id, created_at desc);

create index if not exists notification_delivery_jobs_recipient_idx
  on public.notification_delivery_jobs (recipient_auth_id, created_at desc);

alter table public.notification_delivery_jobs enable row level security;

drop policy if exists notification_delivery_jobs_read on public.notification_delivery_jobs;
create policy notification_delivery_jobs_read
on public.notification_delivery_jobs
for select to authenticated
using (
  public.is_platform_member()
  or public.user_has_institute_permission(institute_id,'integrations.read')
);

create or replace function public.notification_enqueue_delivery_jobs(p_notification_id text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notification public.notifications%rowtype;
  v_role text;
  v_recipient_auth_id uuid;
  v_count integer := 0;
  v_pref public.institute_notification_preferences%rowtype;
  v_integration public.institute_notification_integrations%rowtype;
  v_channel text;
  v_enabled boolean;
begin
  select * into v_notification from public.notifications where id = p_notification_id;
  if not found or v_notification.institute_id is null then return 0; end if;

  select im.role, p.auth_id into v_role, v_recipient_auth_id
  from public.institute_memberships im
  join public.people p on p.id = im.person_id
  where im.institute_id = v_notification.institute_id
    and p.auth_id::text = v_notification.uid
    and im.status = 'active'
    and p.status = 'active'
  limit 1;

  if v_role is null then return 0; end if;

  select * into v_pref
  from public.institute_notification_preferences
  where institute_id = v_notification.institute_id
    and role_key = case
      when v_role in ('institute_owner','institute_admin','academic_admin','accountant','receptionist','content_manager','staff') then 'admin'
      when v_role in ('teacher','student','parent') then v_role
      else 'admin'
    end
    and event_type = case
      when v_notification.type in ('announcement','homework','material','attendance','timetable','message') then v_notification.type
      else 'message'
    end;

  if not found then return 0; end if;

  foreach v_channel in array array['push','email','whatsapp','sms']
  loop
    v_enabled := case v_channel
      when 'push' then v_pref.push
      when 'email' then v_pref.email
      when 'whatsapp' then v_pref.whatsapp
      when 'sms' then v_pref.sms
      else false
    end;
    if not v_enabled then continue; end if;

    select * into v_integration
    from public.institute_notification_integrations
    where institute_id = v_notification.institute_id
      and provider_code = case when v_channel = 'push' then 'web_push' else v_channel end;

    if not found or not v_integration.enabled then continue; end if;

    insert into public.notification_delivery_jobs(
      institute_id, notification_id, recipient_auth_id, channel, status
    )
    values (
      v_notification.institute_id,
      v_notification.id,
      v_recipient_auth_id,
      case when v_channel = 'push' then 'web_push' else v_channel end,
      case when v_integration.secret_configured then 'pending' else 'blocked' end
    )
    on conflict (notification_id, recipient_auth_id, channel) do nothing;

    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.notification_enqueue_delivery_jobs(text) from public, anon, authenticated;
grant execute on function public.notification_enqueue_delivery_jobs(text) to service_role;

create or replace function public.notification_delivery_jobs_set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists notification_delivery_jobs_updated_at on public.notification_delivery_jobs;
create trigger notification_delivery_jobs_updated_at
before update on public.notification_delivery_jobs
for each row execute function public.notification_delivery_jobs_set_updated_at();

create or replace function public.notification_after_insert_enqueue_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.notification_enqueue_delivery_jobs(new.id::text);
  return new;
end;
$$;

revoke all on function public.notification_after_insert_enqueue_delivery() from public, anon, authenticated;
grant execute on function public.notification_after_insert_enqueue_delivery() to service_role;

drop trigger if exists notifications_enqueue_delivery on public.notifications;
create trigger notifications_enqueue_delivery
after insert on public.notifications
for each row execute function public.notification_after_insert_enqueue_delivery();

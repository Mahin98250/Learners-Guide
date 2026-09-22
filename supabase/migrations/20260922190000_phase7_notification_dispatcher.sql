-- Phase 7 notification dispatcher: atomically claim durable delivery jobs.
-- Only the server-side dispatcher may execute this function.

create or replace function public.notification_claim_delivery_jobs(p_limit integer default 25)
returns table (
  id uuid,
  institute_id uuid,
  notification_id text,
  recipient_auth_id uuid,
  channel text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Recover jobs left in "processing" by a crashed worker.
  update public.notification_delivery_jobs
  set
    status = 'failed',
    available_at = now(),
    locked_at = null,
    last_error = left(
      coalesce(last_error || ' | ', '') ||
      'Recovered stale processing lock before retry.',
      500
    ),
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - interval '10 minutes';

  return query
  with candidates as (
    select j.id
    from public.notification_delivery_jobs j
    where j.status in ('pending', 'failed')
      and j.available_at <= now()
    order by j.available_at asc, j.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ),
  claimed as (
    update public.notification_delivery_jobs j
    set
      status = 'processing',
      attempt_count = j.attempt_count + 1,
      locked_at = now(),
      last_error = null,
      updated_at = now()
    where j.id in (select c.id from candidates c)
    returning
      j.id,
      j.institute_id,
      j.notification_id,
      j.recipient_auth_id,
      j.channel,
      j.attempt_count
  )
  select
    c.id,
    c.institute_id,
    c.notification_id,
    c.recipient_auth_id,
    c.channel,
    c.attempt_count
  from claimed c
  order by c.attempt_count, c.id;
end;
$$;

revoke all on function public.notification_claim_delivery_jobs(integer) from public, anon, authenticated;
grant execute on function public.notification_claim_delivery_jobs(integer) to service_role;

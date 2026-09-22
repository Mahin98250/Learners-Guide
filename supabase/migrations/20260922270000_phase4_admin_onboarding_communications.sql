-- Phase 4: institute admin/owner onboarding + platform-to-institute communications.\n-- Delivery contract: r.role_key in ('institute_admin','institute_owner').

create table if not exists public.platform_admin_invitations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  email text not null,
  role_key text not null,
  auth_id uuid references auth.users(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_admin_invites_institute_idx
  on public.platform_admin_invitations(institute_id,status,created_at desc);
create unique index if not exists platform_admin_invites_pending_email_idx
  on public.platform_admin_invitations(institute_id,lower(email))
  where status='pending';

create table if not exists public.platform_institute_messages (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  sender_auth_id uuid not null references auth.users(id) on delete restrict,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_institute_message_recipients (
  message_id uuid not null references public.platform_institute_messages(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  read_at timestamptz,
  primary key(message_id,person_id)
);

create index if not exists platform_messages_institute_created_idx
  on public.platform_institute_messages(institute_id,created_at desc);
create index if not exists platform_message_recipients_person_idx
  on public.platform_institute_message_recipients(person_id,read_at);

alter table public.platform_admin_invitations enable row level security;
alter table public.platform_institute_messages enable row level security;
alter table public.platform_institute_message_recipients enable row level security;

drop policy if exists platform_admin_invites_platform_read on public.platform_admin_invitations;
create policy platform_admin_invites_platform_read on public.platform_admin_invitations
for select to authenticated using (public.is_platform_member());

drop policy if exists platform_messages_platform_read on public.platform_institute_messages;
create policy platform_messages_platform_read on public.platform_institute_messages
for select to authenticated using (public.is_platform_member());

drop policy if exists platform_messages_recipient_read on public.platform_institute_message_recipients;
create policy platform_messages_recipient_read on public.platform_institute_message_recipients
for select to authenticated using (
  exists (
    select 1 from public.people p
    where p.id=person_id and p.auth_id=auth.uid()
  )
);

drop policy if exists platform_messages_platform_recipient_read on public.platform_institute_message_recipients;
create policy platform_messages_platform_recipient_read on public.platform_institute_message_recipients
for select to authenticated using (public.is_platform_member());

create or replace function public.platform_create_admin_invitation(
  p_institute_id uuid,
  p_email text,
  p_role_key text
)
returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
  v_role_id uuid;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Invalid administrator email';
  end if;
  if p_role_key not in ('institute_admin','institute_owner') then
    raise exception 'Only institute admin or owner invitations are supported';
  end if;
  if not exists (select 1 from public.institutes where id=p_institute_id and status<>'archived') then
    raise exception 'Institute not found';
  end if;
  select id into v_role_id from public.institute_roles
  where institute_id=p_institute_id and role_key=p_role_key and status='active';
  if v_role_id is null then raise exception 'Institute role is not configured'; end if;
  if exists (select 1 from public.platform_admin_invitations where institute_id=p_institute_id and lower(email)=v_email and status='pending' and expires_at>now()) then
    raise exception 'A pending invitation already exists for this email';
  end if;
  insert into public.platform_admin_invitations(institute_id,email,role_key,invited_by)
  values(p_institute_id,v_email,p_role_key,auth.uid())
  returning id into v_id;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,auth.uid(),'admin.invitation.created','admin_invitation',v_id::text,
    'Institute administrator invitation prepared.',
    jsonb_build_object('email',v_email,'role_key',p_role_key));
  return v_id;
end;
$function$;

create or replace function public.platform_finalize_admin_invitation(
  p_invitation_id uuid,
  p_auth_id uuid
)
returns public.platform_admin_invitations
language plpgsql security definer set search_path = ''
as $function$
declare
  v_inv public.platform_admin_invitations;
  v_person uuid;
  v_role_id uuid;
begin
  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner MFA verification required';
  end if;
  select * into v_inv from public.platform_admin_invitations
  where id=p_invitation_id and status='pending' and expires_at>now()
  for update;
  if v_inv.id is null then raise exception 'Invitation not found or expired'; end if;

  select id into v_person from public.people where auth_id=p_auth_id;
  if v_person is null then
    insert into public.people(auth_id,display_name,email,status)
    values(p_auth_id,split_part(v_inv.email,'@',1),v_inv.email,'invited')
    returning id into v_person;
  else
    update public.people set email=v_inv.email,status='invited',updated_at=now() where id=v_person;
  end if;

  select id into v_role_id from public.institute_roles
  where institute_id=v_inv.institute_id and role_key=v_inv.role_key and status='active';
  if v_role_id is null then raise exception 'Institute role is not configured'; end if;

  insert into public.institute_memberships(institute_id,person_id,role,role_id,status)
  values(v_inv.institute_id,v_person,v_inv.role_key,v_role_id,'invited')
  on conflict(institute_id,person_id) do update set role=excluded.role,role_id=excluded.role_id,status='invited',updated_at=now();

  update public.platform_admin_invitations
  set auth_id=p_auth_id,person_id=v_person,updated_at=now()
  where id=v_inv.id
  returning * into v_inv;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',v_inv.institute_id,auth.uid(),'admin.invitation.sent','admin_invitation',v_inv.id::text,
    'Institute administrator invitation sent through Supabase Auth.',
    jsonb_build_object('email',v_inv.email,'role_key',v_inv.role_key,'auth_id',p_auth_id));
  return v_inv;
end;
$function$;

create or replace function public.platform_revoke_admin_invitation(p_invitation_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $function$
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  update public.platform_admin_invitations set status='revoked',updated_at=now()
  where id=p_invitation_id and status='pending';
  if not found then raise exception 'Pending invitation not found'; end if;
  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary)
  select 'platform',institute_id,auth.uid(),'admin.invitation.revoked','admin_invitation',id::text,
    'Institute administrator invitation revoked.' from public.platform_admin_invitations where id=p_invitation_id;
  return true;
end;
$function$;

create or replace function public.platform_accept_admin_invitation()
returns public.platform_admin_invitations
language plpgsql security definer set search_path = ''
as $function$
declare
  v_inv public.platform_admin_invitations;
  v_person uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_inv
  from public.platform_admin_invitations
  where auth_id=auth.uid() and status='pending' and expires_at>now()
  order by created_at desc limit 1 for update;
  if v_inv.id is null then raise exception 'No active administrator invitation was found'; end if;

  select id into v_person from public.people where auth_id=auth.uid();
  if v_person is null then raise exception 'Administrator identity is not prepared'; end if;

  update public.people set status='active',updated_at=now() where id=v_person;
  update public.institute_memberships
  set status='active',updated_at=now()
  where institute_id=v_inv.institute_id and person_id=v_person;
  update public.platform_admin_invitations
  set status='accepted',accepted_at=now(),updated_at=now()
  where id=v_inv.id
  returning * into v_inv;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('institute',v_inv.institute_id,auth.uid(),'admin.invitation.accepted','admin_invitation',v_inv.id::text,
    'Institute administrator completed the invitation onboarding flow.',
    jsonb_build_object('role_key',v_inv.role_key));
  return v_inv;
end;
$function$;

create or replace function public.platform_send_institute_admin_message(
  p_institute_id uuid,
  p_subject text,
  p_body text
)
returns table(message_id uuid,recipient_count integer)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_message uuid;
  v_count integer;
begin
  if not public.platform_owner_access_ok() then raise exception 'Platform owner MFA verification required'; end if;
  if not exists(select 1 from public.institutes where id=p_institute_id and status<>'archived') then raise exception 'Institute not found'; end if;
  if length(trim(coalesce(p_subject,''))) < 2 or length(trim(p_subject)) > 180 then raise exception 'Invalid subject'; end if;
  if length(trim(coalesce(p_body,''))) < 1 or length(trim(p_body)) > 10000 then raise exception 'Invalid message body'; end if;

  insert into public.platform_institute_messages(institute_id,sender_auth_id,subject,body)
  values(p_institute_id,auth.uid(),trim(p_subject),trim(p_body))
  returning id into v_message;

  insert into public.platform_institute_message_recipients(message_id,person_id)
  select v_message,p.id
  from public.people p
  join public.institute_memberships m on m.person_id=p.id
  join public.institute_roles r on r.id=m.role_id
  where m.institute_id=p_institute_id and m.status='active'
    and r.role_key in ('institute_admin','institute_owner')
    and p.status='active'
  on conflict do nothing;

  select count(*) into v_count from public.platform_institute_message_recipients where message_id=v_message;

  insert into public.notifications(id,title,"desc",time,type,read,uid,created_at)
  select 'platform-msg-'||v_message::text||'-'||p.id::text,
    'New message from Mahin',
    left(trim(p_subject)||': '||trim(p_body),140),
    to_char(now(),'DD Mon YYYY, HH12:MI AM'),
    'platform_message',false,u.ref,now()
  from public.platform_institute_message_recipients mr
  join public.people p on p.id=mr.person_id
  join public.users u on u.auth_id=p.auth_id;

  insert into public.audit_logs(scope,institute_id,actor_auth_id,action,entity_type,entity_id,summary,metadata)
  values('platform',p_institute_id,auth.uid(),'admin.message.sent','platform_message',v_message::text,
    'Platform message delivered to institute administrators.',
    jsonb_build_object('recipient_count',v_count,'subject',trim(p_subject)));

  return query select v_message,v_count;
end;
$function$;

create or replace function public.platform_get_my_institute_messages()
returns table(message_id uuid,institute_id uuid,subject text,body text,created_at timestamptz,read_at timestamptz)
language sql security definer set search_path = ''
as $function$
  select m.id,m.institute_id,m.subject,m.body,m.created_at,r.read_at
  from public.platform_institute_messages m
  join public.platform_institute_message_recipients r on r.message_id=m.id
  join public.people p on p.id=r.person_id
  where p.auth_id=auth.uid()
  order by m.created_at desc
  limit 100
$function$;

create or replace function public.platform_mark_institute_message_read(p_message_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $function$
begin
  update public.platform_institute_message_recipients r
  set read_at=coalesce(read_at,now())
  from public.people p
  where r.message_id=p_message_id and r.person_id=p.id and p.auth_id=auth.uid();
  return found;
end;
$function$;

revoke all on function public.platform_create_admin_invitation(uuid,text,text) from public,anon;
revoke all on function public.platform_finalize_admin_invitation(uuid,uuid) from public,anon;
revoke all on function public.platform_accept_admin_invitation() from public,anon;
revoke all on function public.platform_revoke_admin_invitation(uuid) from public,anon;
revoke all on function public.platform_send_institute_admin_message(uuid,text,text) from public,anon;
revoke all on function public.platform_get_my_institute_messages() from public,anon;
revoke all on function public.platform_mark_institute_message_read(uuid) from public,anon;

grant execute on function public.platform_create_admin_invitation(uuid,text,text) to authenticated;
grant execute on function public.platform_finalize_admin_invitation(uuid,uuid) to authenticated;
grant execute on function public.platform_accept_admin_invitation() to authenticated;
grant execute on function public.platform_revoke_admin_invitation(uuid) to authenticated;
grant execute on function public.platform_send_institute_admin_message(uuid,text,text) to authenticated;
grant execute on function public.platform_get_my_institute_messages() to authenticated;
grant execute on function public.platform_mark_institute_message_read(uuid) to authenticated;
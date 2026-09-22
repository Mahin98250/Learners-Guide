-- Owner Institute Control Center: protected tenant configuration writes.
create or replace function public.platform_update_institute_settings(
  p_institute_id uuid,
  p_display_name text,
  p_short_name text,
  p_logo_url text,
  p_favicon_url text,
  p_primary_color text,
  p_secondary_color text,
  p_login_title text,
  p_powered_by_enabled boolean,
  p_timezone text,
  p_locale text
)
returns public.institute_settings
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.institute_settings;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not public.platform_owner_access_ok() then
    raise exception 'Platform owner access required';
  end if;

  if not exists (
    select 1 from public.institutes
    where id = p_institute_id and status <> 'archived'
  ) then
    raise exception 'Institute not found or archived';
  end if;

  if length(trim(coalesce(p_display_name, ''))) < 2
     or length(trim(p_display_name)) > 180 then
    raise exception 'Invalid institute display name';
  end if;

  if length(trim(coalesce(p_short_name, ''))) > 80 then
    raise exception 'Invalid institute short name';
  end if;

  if p_timezone is null or trim(p_timezone) = '' then
    raise exception 'Timezone required';
  end if;

  if p_locale is null or trim(p_locale) = '' then
    raise exception 'Locale required';
  end if;

  update public.institute_settings
     set display_name = trim(p_display_name),
         short_name = nullif(trim(coalesce(p_short_name, '')), ''),
         logo_url = nullif(trim(coalesce(p_logo_url, '')), ''),
         favicon_url = nullif(trim(coalesce(p_favicon_url, '')), ''),
         primary_color = nullif(trim(coalesce(p_primary_color, '')), ''),
         secondary_color = nullif(trim(coalesce(p_secondary_color, '')), ''),
         login_title = nullif(trim(coalesce(p_login_title, '')), ''),
         powered_by_enabled = coalesce(p_powered_by_enabled, true),
         timezone = trim(p_timezone),
         locale = trim(p_locale),
         updated_at = now()
   where institute_id = p_institute_id
   returning * into v_row;

  if v_row.institute_id is null then
    raise exception 'Institute settings not found';
  end if;

  insert into public.audit_logs(
    scope, institute_id, actor_auth_id, action, entity_type, entity_id, summary, metadata
  )
  values(
    'platform',
    p_institute_id,
    (select auth.uid()),
    'institute.settings.updated',
    'institute_settings',
    p_institute_id::text,
    'Institute workspace settings updated from the platform control center.',
    jsonb_build_object(
      'display_name', v_row.display_name,
      'short_name', v_row.short_name,
      'timezone', v_row.timezone,
      'locale', v_row.locale,
      'powered_by_enabled', v_row.powered_by_enabled
    )
  );

  return v_row;
end;
$function$;

revoke all on function public.platform_update_institute_settings(uuid,text,text,text,text,text,text,text,boolean,text,text) from public, anon;
grant execute on function public.platform_update_institute_settings(uuid,text,text,text,text,text,text,text,boolean,text,text) to authenticated;

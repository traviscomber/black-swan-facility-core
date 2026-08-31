-- Bind nominal invitation tokens to their intended recipient and require every
-- bearer token to carry a concrete future expiry. Shared invitations remain
-- possible only when invitee_email is intentionally NULL.

create or replace function public.register_event_portal_guest(
  p_slug text,
  p_secret text,
  p_full_name text,
  p_email text,
  p_phone text default null::text,
  p_company_name text default null::text,
  p_dietary_preferences text default null::text,
  p_allergies text default null::text,
  p_companions jsonb default '[]'::jsonb,
  p_consent_data_processing boolean default false,
  p_consent_marketing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_portal public.event_guest_portals%rowtype;
  v_event public.operational_events%rowtype;
  v_invite public.event_portal_invites%rowtype;
  v_member_id uuid;
  v_guest_id uuid;
  v_registration_id uuid;
  v_invitation_id uuid;
  v_allowed boolean := false;
  v_registered integer;
  v_companion_count integer := 0;
begin
  if not p_consent_data_processing then
    raise exception 'Data processing consent required';
  end if;
  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'Full name required';
  end if;
  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'Email required';
  end if;
  if jsonb_typeof(coalesce(p_companions, '[]'::jsonb)) <> 'array' then
    raise exception 'Companions must be an array';
  end if;

  select * into v_portal
  from public.event_guest_portals
  where slug = p_slug and status = 'published'
  for update;
  if not found then
    raise exception 'Portal not found';
  end if;

  select * into v_event
  from public.operational_events
  where id = v_portal.event_id;

  if v_portal.access_mode in ('invite_token', 'invite_or_passcode') then
    select * into v_invite
    from public.event_portal_invites
    where portal_id = v_portal.id
      and token_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
      and status = 'active'
      and expires_at > now()
      and used_count < max_uses
    for update
    limit 1;

    if found then
      if v_invite.invitee_email is not null
         and lower(trim(v_invite.invitee_email)) <> lower(trim(p_email)) then
        raise exception 'Invalid invitation or passcode';
      end if;
      v_allowed := true;
      v_member_id := v_invite.inviting_member_id;
    end if;
  end if;

  if not v_allowed
     and v_portal.access_mode in ('passcode', 'invite_or_passcode')
     and v_portal.passcode_hash is not null then
    v_allowed := extensions.crypt(coalesce(p_secret, ''), v_portal.passcode_hash) = v_portal.passcode_hash;
  end if;

  if not v_allowed then
    raise exception 'Invalid invitation or passcode';
  end if;

  if v_member_id is null then
    select emr.member_id into v_member_id
    from public.event_member_roles emr
    where emr.event_id = v_portal.event_id
      and emr.role in ('host', 'organizer')
    order by emr.is_primary desc, emr.created_at asc
    limit 1;
  end if;
  if v_member_id is null then
    raise exception 'Event requires a canonical member host before guest registration';
  end if;

  v_companion_count := jsonb_array_length(coalesce(p_companions, '[]'::jsonb));
  if v_companion_count > 0 and not v_portal.allow_companions then
    raise exception 'Companions are not enabled for this event';
  end if;
  if v_companion_count > v_portal.max_companions then
    raise exception 'Too many companions';
  end if;

  select count(*) into v_registered
  from public.event_portal_registrations
  where portal_id = v_portal.id
    and registration_status in ('pending', 'confirmed', 'checked_in', 'completed');
  if v_portal.capacity is not null and v_registered >= v_portal.capacity then
    raise exception 'Event capacity reached';
  end if;

  select id into v_guest_id
  from public.guests
  where lower(email) = lower(trim(p_email))
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if v_guest_id is null then
    insert into public.guests(
      name, email, phone, company_name, dietary_preferences, allergies,
      consent_marketing, consent_data_processing, consent_updated_at
    )
    values(
      trim(p_full_name), lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_company_name, '')), ''),
      nullif(trim(coalesce(p_dietary_preferences, '')), ''),
      nullif(trim(coalesce(p_allergies, '')), ''), p_consent_marketing, true, now()
    )
    returning id into v_guest_id;
  else
    update public.guests set
      name = trim(p_full_name),
      phone = coalesce(nullif(trim(coalesce(p_phone, '')), ''), phone),
      company_name = coalesce(nullif(trim(coalesce(p_company_name, '')), ''), company_name),
      dietary_preferences = coalesce(nullif(trim(coalesce(p_dietary_preferences, '')), ''), dietary_preferences),
      allergies = coalesce(nullif(trim(coalesce(p_allergies, '')), ''), allergies),
      consent_marketing = p_consent_marketing,
      consent_data_processing = true,
      consent_updated_at = now(),
      updated_at = now()
    where id = v_guest_id;
  end if;

  insert into public.event_portal_registrations(
    portal_id, invite_id, inviting_member_id, guest_id, full_name, email,
    phone, company_name, dietary_preferences, allergies, companions,
    registration_status, payment_status, consent_data_processing, consent_marketing
  )
  values(
    v_portal.id,
    case when v_invite.id is not null then v_invite.id else null end,
    v_member_id, v_guest_id, trim(p_full_name), lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_company_name, '')), ''),
    nullif(trim(coalesce(p_dietary_preferences, '')), ''),
    nullif(trim(coalesce(p_allergies, '')), ''),
    coalesce(p_companions, '[]'::jsonb), 'confirmed',
    case when v_portal.commercial_model = 'free' then 'not_required' else 'pending' end,
    true, p_consent_marketing
  )
  returning id into v_registration_id;

  insert into public.guest_invitations(
    guest_id, inviting_member_id, event_id, valid_from, valid_until, status
  )
  values(
    v_guest_id, v_member_id, v_portal.event_id,
    v_event.start_date::timestamp,
    v_event.end_date::timestamp + interval '1 day',
    'confirmed'
  )
  returning id into v_invitation_id;

  if v_invite.id is not null then
    update public.event_portal_invites
    set used_count = used_count + 1,
        status = case when used_count + 1 >= max_uses then 'used' else status end,
        updated_at = now()
    where id = v_invite.id;
  end if;

  return jsonb_build_object(
    'registration_id', v_registration_id,
    'guest_id', v_guest_id,
    'guest_invitation_id', v_invitation_id,
    'payment_status', case when v_portal.commercial_model = 'free' then 'not_required' else 'pending' end
  );
end;
$function$;

revoke all on function public.register_event_portal_guest(
  text, text, text, text, text, text, text, text, jsonb, boolean, boolean
) from public;

grant execute on function public.register_event_portal_guest(
  text, text, text, text, text, text, text, text, jsonb, boolean, boolean
) to anon, authenticated, service_role;

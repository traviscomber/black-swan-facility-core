-- Follow-up hardening for event portal capacity and waitlist promotion.
-- Capacity is seat-based (registrant + companions). Promotion rotates a new
-- check-in token because raw check-in secrets are never stored.

create or replace function public.resolve_event_guest_portal(p_slug text, p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_portal public.event_guest_portals%rowtype;
  v_event public.operational_events%rowtype;
  v_invite public.event_portal_invites%rowtype;
  v_allowed boolean := false;
  v_reserved integer;
begin
  select * into v_portal from public.event_guest_portals where slug=p_slug and status='published';
  if not found then return null; end if;

  select * into v_event from public.operational_events where id=v_portal.event_id;
  if not found then return null; end if;

  if v_portal.registration_opens_at is not null and now() < v_portal.registration_opens_at then return null; end if;
  if v_portal.registration_closes_at is not null and now() > v_portal.registration_closes_at then return null; end if;

  if v_portal.access_mode in ('invite_token','invite_or_passcode') then
    select * into v_invite
    from public.event_portal_invites
    where portal_id=v_portal.id
      and token_hash=encode(extensions.digest(coalesce(p_secret,''),'sha256'),'hex')
      and status='active'
      and (expires_at is null or expires_at > now())
      and used_count < max_uses
    limit 1;
    v_allowed := found;
  end if;

  if not v_allowed and v_portal.access_mode in ('passcode','invite_or_passcode') and v_portal.passcode_hash is not null then
    v_allowed := extensions.crypt(coalesce(p_secret,''),v_portal.passcode_hash)=v_portal.passcode_hash;
  end if;

  if not v_allowed then return null; end if;

  v_reserved := public.event_portal_reserved_seats(v_portal.id);

  return jsonb_build_object(
    'portal_id',v_portal.id,
    'slug',v_portal.slug,
    'headline',coalesce(v_portal.headline,v_event.name),
    'black_swan_intro',v_portal.black_swan_intro,
    'event_description',v_portal.event_description,
    'event',jsonb_build_object('name',v_event.name,'start_date',v_event.start_date,'end_date',v_event.end_date,'location_name',v_event.location_name),
    'program',v_portal.program,
    'practical_info',v_portal.practical_info,
    'capacity',v_portal.capacity,
    'places_remaining',case when v_portal.capacity is null then null else greatest(v_portal.capacity-v_reserved,0) end,
    'allow_companions',v_portal.allow_companions,
    'max_companions',v_portal.max_companions,
    'commercial_model',v_portal.commercial_model,
    'ticket_price',v_portal.ticket_price,
    'currency',v_portal.currency
  );
end;
$function$;

revoke all on function public.resolve_event_guest_portal(text,text) from public;
grant execute on function public.resolve_event_guest_portal(text,text) to anon;
grant execute on function public.resolve_event_guest_portal(text,text) to authenticated;

create or replace function public.set_event_portal_registration_status(
  p_registration_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_reg public.event_portal_registrations%rowtype;
  v_portal public.event_guest_portals%rowtype;
  v_event public.operational_events%rowtype;
  v_reserved integer;
  v_requested integer;
  v_invitation_id uuid;
  v_checkin_token text;
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  if p_status not in ('pending','confirmed','waitlist','cancelled','no_show','completed') then raise exception 'Invalid registration status'; end if;

  select * into v_reg from public.event_portal_registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found'; end if;
  if v_reg.registration_status='checked_in' and p_status <> 'completed' then raise exception 'Checked-in registration can only be completed'; end if;

  select * into v_portal from public.event_guest_portals where id=v_reg.portal_id for update;
  select * into v_event from public.operational_events where id=v_portal.event_id;

  if p_status='confirmed' and v_reg.registration_status not in ('confirmed','checked_in','completed') then
    v_reserved := public.event_portal_reserved_seats(v_portal.id);
    v_requested := 1 + jsonb_array_length(coalesce(v_reg.companions,'[]'::jsonb));
    if v_portal.capacity is not null and v_reserved + v_requested > v_portal.capacity then raise exception 'Event capacity reached'; end if;

    if v_reg.guest_invitation_id is null then
      insert into public.guest_invitations(guest_id,inviting_member_id,event_id,valid_from,valid_until,status)
      values(v_reg.guest_id,v_reg.inviting_member_id,v_portal.event_id,v_event.start_date::timestamp,v_event.end_date::timestamp + interval '1 day','confirmed')
      returning id into v_invitation_id;
    else
      v_invitation_id := v_reg.guest_invitation_id;
      update public.guest_invitations set status='confirmed',updated_at=now() where id=v_invitation_id;
    end if;

    v_checkin_token := encode(extensions.gen_random_bytes(24),'hex');
  elsif p_status in ('cancelled','no_show') and v_reg.guest_invitation_id is not null then
    update public.guest_invitations set status=case when p_status='cancelled' then 'cancelled' else 'denied' end,updated_at=now()
    where id=v_reg.guest_invitation_id;
    v_invitation_id := v_reg.guest_invitation_id;
  else
    v_invitation_id := v_reg.guest_invitation_id;
  end if;

  update public.event_portal_registrations
  set registration_status=p_status,
      guest_invitation_id=coalesce(v_invitation_id,guest_invitation_id),
      checkin_token_hash=case when v_checkin_token is not null then encode(extensions.digest(v_checkin_token,'sha256'),'hex') else checkin_token_hash end,
      checkin_token_created_at=case when v_checkin_token is not null then now() else checkin_token_created_at end,
      notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),
      cancelled_at=case when p_status='cancelled' then now() else cancelled_at end,
      status_changed_at=now(),status_changed_by=auth.uid(),updated_at=now()
  where id=p_registration_id;

  return jsonb_build_object(
    'registration_id',p_registration_id,
    'status',p_status,
    'guest_invitation_id',coalesce(v_invitation_id,v_reg.guest_invitation_id),
    'checkin_token',v_checkin_token
  );
end;
$function$;

revoke all on function public.set_event_portal_registration_status(uuid,text,text) from public;
grant execute on function public.set_event_portal_registration_status(uuid,text,text) to authenticated;

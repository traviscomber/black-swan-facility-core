-- Black Swan Corporacion: harden invite-only event registration lifecycle.
-- Adds waitlist/capacity control, revocation, QR-style check-in tokens, controlled
-- registration status management, and event closeout into the Education workflow.
-- Payment remains abstract and inactive.

alter table public.event_portal_invites
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists revocation_reason text;

alter table public.event_portal_registrations
  add column if not exists guest_invitation_id uuid references public.guest_invitations(id) on delete set null,
  add column if not exists checkin_token_hash text,
  add column if not exists checkin_token_created_at timestamptz,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null,
  add column if not exists followup_status text not null default 'pending',
  add column if not exists followup_notes text;

create unique index if not exists event_portal_registration_checkin_token_unique
  on public.event_portal_registrations(checkin_token_hash)
  where checkin_token_hash is not null;

alter table public.event_portal_registrations
  drop constraint if exists event_portal_registration_followup_check;
alter table public.event_portal_registrations
  add constraint event_portal_registration_followup_check
  check (followup_status in ('pending','contacted','prospective_member','donor_prospect','partner_prospect','closed'));

create or replace function public.event_portal_reserved_seats(p_portal_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select coalesce(sum(1 + jsonb_array_length(coalesce(r.companions,'[]'::jsonb))),0)::integer
  from public.event_portal_registrations r
  where r.portal_id=p_portal_id
    and r.registration_status in ('pending','confirmed','checked_in','completed');
$function$;

revoke all on function public.event_portal_reserved_seats(uuid) from public;
grant execute on function public.event_portal_reserved_seats(uuid) to authenticated;

create or replace function public.revoke_event_portal_invite(
  p_invite_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Revocation reason required'; end if;

  update public.event_portal_invites
  set status='revoked', revoked_at=now(), revoked_by=auth.uid(), revocation_reason=trim(p_reason), updated_at=now()
  where id=p_invite_id and status in ('active','used');

  if not found then raise exception 'Invite not found or already inactive'; end if;
end;
$function$;

revoke all on function public.revoke_event_portal_invite(uuid,text) from public;
grant execute on function public.revoke_event_portal_invite(uuid,text) to authenticated;

create or replace function public.register_event_portal_guest(
  p_slug text,
  p_secret text,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_company_name text default null,
  p_dietary_preferences text default null,
  p_allergies text default null,
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
  v_reserved integer := 0;
  v_companion_count integer := 0;
  v_requested_seats integer := 1;
  v_registration_status text := 'confirmed';
  v_checkin_token text := encode(extensions.gen_random_bytes(24),'hex');
  v_payment_status text;
begin
  if not p_consent_data_processing then raise exception 'Data processing consent required'; end if;
  if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'Full name required'; end if;
  if nullif(trim(coalesce(p_email,'')),'') is null then raise exception 'Email required'; end if;
  if jsonb_typeof(coalesce(p_companions,'[]'::jsonb)) <> 'array' then raise exception 'Companions must be an array'; end if;

  select * into v_portal from public.event_guest_portals where slug=p_slug and status='published' for update;
  if not found then raise exception 'Portal not found'; end if;
  if v_portal.registration_opens_at is not null and now() < v_portal.registration_opens_at then raise exception 'Registration is not open'; end if;
  if v_portal.registration_closes_at is not null and now() > v_portal.registration_closes_at then raise exception 'Registration is closed'; end if;

  select * into v_event from public.operational_events where id=v_portal.event_id;
  if not found then raise exception 'Event not found'; end if;

  if v_portal.access_mode in ('invite_token','invite_or_passcode') then
    select * into v_invite
    from public.event_portal_invites
    where portal_id=v_portal.id
      and token_hash=encode(extensions.digest(coalesce(p_secret,''),'sha256'),'hex')
      and status='active'
      and (expires_at is null or expires_at > now())
      and used_count < max_uses
    for update
    limit 1;
    if found then
      v_allowed := true;
      v_member_id := v_invite.inviting_member_id;
    end if;
  end if;

  if not v_allowed and v_portal.access_mode in ('passcode','invite_or_passcode') and v_portal.passcode_hash is not null then
    v_allowed := extensions.crypt(coalesce(p_secret,''),v_portal.passcode_hash)=v_portal.passcode_hash;
  end if;
  if not v_allowed then raise exception 'Invalid invitation or passcode'; end if;

  if v_member_id is null then
    select emr.member_id into v_member_id
    from public.event_member_roles emr
    where emr.event_id=v_portal.event_id and emr.role in ('host','organizer')
    order by emr.is_primary desc, emr.created_at asc
    limit 1;
  end if;
  if v_member_id is null then raise exception 'Event requires a canonical member host before guest registration'; end if;

  v_companion_count := jsonb_array_length(coalesce(p_companions,'[]'::jsonb));
  v_requested_seats := 1 + v_companion_count;
  if v_companion_count > 0 and not v_portal.allow_companions then raise exception 'Companions are not enabled for this event'; end if;
  if v_companion_count > v_portal.max_companions then raise exception 'Too many companions'; end if;

  v_reserved := public.event_portal_reserved_seats(v_portal.id);
  if v_portal.capacity is not null and v_reserved + v_requested_seats > v_portal.capacity then
    v_registration_status := 'waitlist';
  end if;

  select id into v_guest_id
  from public.guests
  where lower(email)=lower(trim(p_email))
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if v_guest_id is null then
    insert into public.guests(name,email,phone,company_name,dietary_preferences,allergies,consent_marketing,consent_data_processing,consent_updated_at)
    values(trim(p_full_name),lower(trim(p_email)),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_company_name,'')),''),nullif(trim(coalesce(p_dietary_preferences,'')),''),nullif(trim(coalesce(p_allergies,'')),''),p_consent_marketing,true,now())
    returning id into v_guest_id;
  else
    update public.guests set
      name=trim(p_full_name),
      phone=coalesce(nullif(trim(coalesce(p_phone,'')),''),phone),
      company_name=coalesce(nullif(trim(coalesce(p_company_name,'')),''),company_name),
      dietary_preferences=coalesce(nullif(trim(coalesce(p_dietary_preferences,'')),''),dietary_preferences),
      allergies=coalesce(nullif(trim(coalesce(p_allergies,'')),''),allergies),
      consent_marketing=p_consent_marketing,
      consent_data_processing=true,
      consent_updated_at=now(),
      updated_at=now()
    where id=v_guest_id;
  end if;

  v_payment_status := case when v_portal.commercial_model='free' then 'not_required' else 'pending' end;

  if v_registration_status='confirmed' then
    insert into public.guest_invitations(guest_id,inviting_member_id,event_id,valid_from,valid_until,status)
    values(v_guest_id,v_member_id,v_portal.event_id,v_event.start_date::timestamp,v_event.end_date::timestamp + interval '1 day','confirmed')
    returning id into v_invitation_id;
  end if;

  insert into public.event_portal_registrations(
    portal_id,invite_id,inviting_member_id,guest_id,guest_invitation_id,full_name,email,phone,company_name,
    dietary_preferences,allergies,companions,registration_status,payment_status,consent_data_processing,
    consent_marketing,checkin_token_hash,checkin_token_created_at,status_changed_at
  ) values (
    v_portal.id,case when v_invite.id is not null then v_invite.id else null end,v_member_id,v_guest_id,v_invitation_id,
    trim(p_full_name),lower(trim(p_email)),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_company_name,'')),''),
    nullif(trim(coalesce(p_dietary_preferences,'')),''),nullif(trim(coalesce(p_allergies,'')),''),coalesce(p_companions,'[]'::jsonb),
    v_registration_status,v_payment_status,true,p_consent_marketing,encode(extensions.digest(v_checkin_token,'sha256'),'hex'),now(),now()
  ) returning id into v_registration_id;

  if v_invite.id is not null then
    update public.event_portal_invites
    set used_count=used_count+1,
        status=case when used_count+1>=max_uses then 'used' else status end,
        updated_at=now()
    where id=v_invite.id;
  end if;

  return jsonb_build_object(
    'registration_id',v_registration_id,
    'guest_id',v_guest_id,
    'guest_invitation_id',v_invitation_id,
    'registration_status',v_registration_status,
    'payment_status',v_payment_status,
    'checkin_token',v_checkin_token
  );
end;
$function$;

revoke all on function public.register_event_portal_guest(text,text,text,text,text,text,text,text,jsonb,boolean,boolean) from public;
grant execute on function public.register_event_portal_guest(text,text,text,text,text,text,text,text,jsonb,boolean,boolean) to anon;
grant execute on function public.register_event_portal_guest(text,text,text,text,text,text,text,text,jsonb,boolean,boolean) to authenticated;

create or replace function public.get_event_portal_management(p_portal_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_portal public.event_guest_portals%rowtype;
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  select * into v_portal from public.event_guest_portals where id=p_portal_id;
  if not found then raise exception 'Portal not found'; end if;

  return jsonb_build_object(
    'portal', jsonb_build_object('id',v_portal.id,'event_id',v_portal.event_id,'slug',v_portal.slug,'status',v_portal.status,'capacity',v_portal.capacity),
    'reserved_seats', public.event_portal_reserved_seats(v_portal.id),
    'registrations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'full_name',r.full_name,'email',r.email,'phone',r.phone,'companions',r.companions,
        'registration_status',r.registration_status,'payment_status',r.payment_status,'registered_at',r.registered_at,
        'checked_in_at',r.checked_in_at,'inviting_member_id',r.inviting_member_id,'guest_id',r.guest_id,
        'followup_status',r.followup_status,'followup_notes',r.followup_notes
      ) order by r.registered_at desc)
      from public.event_portal_registrations r where r.portal_id=v_portal.id
    ),'[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'inviting_member_id',i.inviting_member_id,'invitee_name',i.invitee_name,'invitee_email',i.invitee_email,
        'status',i.status,'expires_at',i.expires_at,'max_uses',i.max_uses,'used_count',i.used_count,
        'revoked_at',i.revoked_at,'revocation_reason',i.revocation_reason
      ) order by i.created_at desc)
      from public.event_portal_invites i where i.portal_id=v_portal.id
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_event_portal_management(uuid) from public;
grant execute on function public.get_event_portal_management(uuid) to authenticated;

create or replace function public.set_event_portal_registration_status(
  p_registration_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_reg public.event_portal_registrations%rowtype;
  v_portal public.event_guest_portals%rowtype;
  v_event public.operational_events%rowtype;
  v_reserved integer;
  v_requested integer;
  v_invitation_id uuid;
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  if p_status not in ('pending','confirmed','waitlist','cancelled','no_show','completed') then raise exception 'Invalid registration status'; end if;

  select * into v_reg from public.event_portal_registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found'; end if;
  if v_reg.registration_status='checked_in' and p_status not in ('completed') then raise exception 'Checked-in registration can only be completed'; end if;

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
  elsif p_status in ('cancelled','no_show') and v_reg.guest_invitation_id is not null then
    update public.guest_invitations set status=case when p_status='cancelled' then 'cancelled' else 'denied' end,updated_at=now()
    where id=v_reg.guest_invitation_id;
  else
    v_invitation_id := v_reg.guest_invitation_id;
  end if;

  update public.event_portal_registrations
  set registration_status=p_status,
      guest_invitation_id=coalesce(v_invitation_id,guest_invitation_id),
      notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),
      cancelled_at=case when p_status='cancelled' then now() else cancelled_at end,
      status_changed_at=now(),status_changed_by=auth.uid(),updated_at=now()
  where id=p_registration_id;

  return jsonb_build_object('registration_id',p_registration_id,'status',p_status,'guest_invitation_id',coalesce(v_invitation_id,v_reg.guest_invitation_id));
end;
$function$;

revoke all on function public.set_event_portal_registration_status(uuid,text,text) from public;
grant execute on function public.set_event_portal_registration_status(uuid,text,text) to authenticated;

create or replace function public.check_in_event_portal_guest(p_checkin_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_reg public.event_portal_registrations%rowtype;
begin
  if auth.uid() is null or v_role not in ('admin','approver','operator') then raise exception 'Insufficient permissions'; end if;

  select * into v_reg
  from public.event_portal_registrations
  where checkin_token_hash=encode(extensions.digest(coalesce(p_checkin_token,''),'sha256'),'hex')
  for update;

  if not found then raise exception 'Registration not found'; end if;
  if v_reg.registration_status <> 'confirmed' then raise exception 'Registration must be confirmed before check-in'; end if;
  if v_reg.guest_invitation_id is null then raise exception 'Guest invitation not available'; end if;
  if not public.can_guest_enter(v_reg.guest_invitation_id,now()) then raise exception 'Inviting member is not currently on ground'; end if;

  update public.event_portal_registrations
  set registration_status='checked_in',checked_in_at=now(),status_changed_at=now(),status_changed_by=auth.uid(),updated_at=now()
  where id=v_reg.id;
  update public.guest_invitations set status='checked_in',updated_at=now() where id=v_reg.guest_invitation_id;

  return jsonb_build_object('registration_id',v_reg.id,'guest_id',v_reg.guest_id,'full_name',v_reg.full_name,'status','checked_in');
end;
$function$;

revoke all on function public.check_in_event_portal_guest(text) from public;
grant execute on function public.check_in_event_portal_guest(text) to authenticated;

create or replace function public.update_event_portal_followup(
  p_registration_id uuid,
  p_followup_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  if p_followup_status not in ('pending','contacted','prospective_member','donor_prospect','partner_prospect','closed') then raise exception 'Invalid follow-up status'; end if;
  update public.event_portal_registrations
  set followup_status=p_followup_status,followup_notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now()
  where id=p_registration_id;
  if not found then raise exception 'Registration not found'; end if;
end;
$function$;

revoke all on function public.update_event_portal_followup(uuid,text,text) from public;
grant execute on function public.update_event_portal_followup(uuid,text,text) to authenticated;

create or replace function public.close_event_portal_and_start_education(p_portal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_event_id uuid;
  v_collection_id uuid;
  v_completed integer;
  v_no_show integer;
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  select event_id into v_event_id from public.event_guest_portals where id=p_portal_id for update;
  if v_event_id is null then raise exception 'Portal not found'; end if;

  update public.event_portal_registrations
  set registration_status='completed',status_changed_at=now(),status_changed_by=auth.uid(),updated_at=now()
  where portal_id=p_portal_id and registration_status='checked_in';
  get diagnostics v_completed = row_count;

  update public.event_portal_registrations
  set registration_status='no_show',status_changed_at=now(),status_changed_by=auth.uid(),updated_at=now()
  where portal_id=p_portal_id and registration_status='confirmed';
  get diagnostics v_no_show = row_count;

  update public.event_guest_portals set status='closed',updated_at=now() where id=p_portal_id;

  select id into v_collection_id from public.education_collections where event_id=v_event_id limit 1;
  if v_collection_id is not null then
    update public.education_collections
    set status=case when status='collecting' then 'processing' else status end,updated_at=now()
    where id=v_collection_id;
  end if;

  return jsonb_build_object('portal_id',p_portal_id,'event_id',v_event_id,'completed',v_completed,'no_show',v_no_show,'education_collection_id',v_collection_id);
end;
$function$;

revoke all on function public.close_event_portal_and_start_education(uuid) from public;
grant execute on function public.close_event_portal_and_start_education(uuid) to authenticated;

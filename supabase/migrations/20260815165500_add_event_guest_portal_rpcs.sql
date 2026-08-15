-- Secure internal/public RPC boundary for invite-only event guest portals.
-- Public functions return curated event content only and require either a valid
-- one-time/revocable invite token or the configured event passcode.

create or replace function public.upsert_event_guest_portal(
  p_event_id uuid,
  p_slug text,
  p_access_mode text default 'invite_token',
  p_passcode text default null,
  p_headline text default null,
  p_black_swan_intro text default null,
  p_event_description text default null,
  p_program jsonb default '[]'::jsonb,
  p_practical_info jsonb default '{}'::jsonb,
  p_capacity integer default null,
  p_allow_companions boolean default false,
  p_max_companions integer default 0,
  p_commercial_model text default 'free',
  p_ticket_price numeric default null,
  p_currency text default 'CLP',
  p_collecting_legal_entity_id uuid default null,
  p_payment_provider text default null,
  p_status text default 'draft'
)
returns public.event_guest_portals
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_result public.event_guest_portals%rowtype;
  v_passcode_hash text;
begin
  if auth.uid() is null or v_role <> 'admin' then
    raise exception 'Administrator role required';
  end if;
  if not exists (select 1 from public.operational_events where id=p_event_id) then raise exception 'Event not found'; end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Slug must be lowercase kebab-case'; end if;
  if p_access_mode not in ('invite_token','passcode','invite_or_passcode') then raise exception 'Invalid access mode'; end if;
  if p_access_mode <> 'invite_token' and nullif(trim(coalesce(p_passcode,'')),'') is null then
    if not exists (select 1 from public.event_guest_portals where event_id=p_event_id and passcode_hash is not null) then
      raise exception 'Passcode required for selected access mode';
    end if;
  end if;

  if nullif(trim(coalesce(p_passcode,'')),'') is not null then
    v_passcode_hash := extensions.crypt(trim(p_passcode), extensions.gen_salt('bf'));
  end if;

  insert into public.event_guest_portals(
    event_id,slug,status,access_mode,passcode_hash,headline,black_swan_intro,event_description,
    program,practical_info,capacity,allow_companions,max_companions,commercial_model,ticket_price,
    currency,collecting_legal_entity_id,payment_provider,created_by
  ) values (
    p_event_id,p_slug,p_status,p_access_mode,v_passcode_hash,p_headline,p_black_swan_intro,p_event_description,
    coalesce(p_program,'[]'::jsonb),coalesce(p_practical_info,'{}'::jsonb),p_capacity,p_allow_companions,
    p_max_companions,p_commercial_model,p_ticket_price,upper(coalesce(p_currency,'CLP')),
    p_collecting_legal_entity_id,p_payment_provider,auth.uid()
  )
  on conflict(event_id) do update set
    slug=excluded.slug,status=excluded.status,access_mode=excluded.access_mode,
    passcode_hash=coalesce(excluded.passcode_hash,event_guest_portals.passcode_hash),
    headline=excluded.headline,black_swan_intro=excluded.black_swan_intro,event_description=excluded.event_description,
    program=excluded.program,practical_info=excluded.practical_info,capacity=excluded.capacity,
    allow_companions=excluded.allow_companions,max_companions=excluded.max_companions,
    commercial_model=excluded.commercial_model,ticket_price=excluded.ticket_price,currency=excluded.currency,
    collecting_legal_entity_id=excluded.collecting_legal_entity_id,payment_provider=excluded.payment_provider,updated_at=now()
  returning * into v_result;

  return v_result;
end;
$function$;

revoke all on function public.upsert_event_guest_portal(uuid,text,text,text,text,text,text,jsonb,jsonb,integer,boolean,integer,text,numeric,text,uuid,text,text) from public;
grant execute on function public.upsert_event_guest_portal(uuid,text,text,text,text,text,text,jsonb,jsonb,integer,boolean,integer,text,numeric,text,uuid,text,text) to authenticated;

create or replace function public.issue_event_portal_invite(
  p_portal_id uuid,
  p_inviting_member_id uuid default null,
  p_invitee_name text default null,
  p_invitee_email text default null,
  p_expires_at timestamptz default null,
  p_max_uses integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_token text := encode(extensions.gen_random_bytes(24),'hex');
  v_invite_id uuid;
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  if not exists (select 1 from public.event_guest_portals where id=p_portal_id) then raise exception 'Portal not found'; end if;
  if p_inviting_member_id is not null and not exists (select 1 from public.members where id=p_inviting_member_id and status='active') then raise exception 'Active member not found'; end if;

  insert into public.event_portal_invites(portal_id,inviting_member_id,invitee_name,invitee_email,token_hash,expires_at,max_uses,created_by)
  values(p_portal_id,p_inviting_member_id,nullif(trim(coalesce(p_invitee_name,'')),''),nullif(lower(trim(coalesce(p_invitee_email,''))),''),encode(extensions.digest(v_token,'sha256'),'hex'),p_expires_at,greatest(coalesce(p_max_uses,1),1),auth.uid())
  returning id into v_invite_id;

  return jsonb_build_object('invite_id',v_invite_id,'token',v_token);
end;
$function$;

revoke all on function public.issue_event_portal_invite(uuid,uuid,text,text,timestamptz,integer) from public;
grant execute on function public.issue_event_portal_invite(uuid,uuid,text,text,timestamptz,integer) to authenticated;

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
  v_registered integer;
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

  select count(*) into v_registered
  from public.event_portal_registrations
  where portal_id=v_portal.id and registration_status in ('pending','confirmed','checked_in','completed');

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
    'places_remaining',case when v_portal.capacity is null then null else greatest(v_portal.capacity-v_registered,0) end,
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
  v_registered integer;
  v_companion_count integer := 0;
begin
  if not p_consent_data_processing then raise exception 'Data processing consent required'; end if;
  if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'Full name required'; end if;
  if nullif(trim(coalesce(p_email,'')),'') is null then raise exception 'Email required'; end if;
  if jsonb_typeof(coalesce(p_companions,'[]'::jsonb)) <> 'array' then raise exception 'Companions must be an array'; end if;

  select * into v_portal from public.event_guest_portals where slug=p_slug and status='published' for update;
  if not found then raise exception 'Portal not found'; end if;
  select * into v_event from public.operational_events where id=v_portal.event_id;

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
  if v_companion_count > 0 and not v_portal.allow_companions then raise exception 'Companions are not enabled for this event'; end if;
  if v_companion_count > v_portal.max_companions then raise exception 'Too many companions'; end if;

  select count(*) into v_registered from public.event_portal_registrations where portal_id=v_portal.id and registration_status in ('pending','confirmed','checked_in','completed');
  if v_portal.capacity is not null and v_registered >= v_portal.capacity then raise exception 'Event capacity reached'; end if;

  select id into v_guest_id from public.guests where lower(email)=lower(trim(p_email)) order by updated_at desc nulls last, created_at desc limit 1;
  if v_guest_id is null then
    insert into public.guests(name,email,phone,company_name,dietary_preferences,allergies,consent_marketing,consent_data_processing,consent_updated_at)
    values(trim(p_full_name),lower(trim(p_email)),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_company_name,'')),''),nullif(trim(coalesce(p_dietary_preferences,'')),''),nullif(trim(coalesce(p_allergies,'')),''),p_consent_marketing,true,now())
    returning id into v_guest_id;
  else
    update public.guests set
      name=trim(p_full_name),phone=coalesce(nullif(trim(coalesce(p_phone,'')),''),phone),company_name=coalesce(nullif(trim(coalesce(p_company_name,'')),''),company_name),
      dietary_preferences=coalesce(nullif(trim(coalesce(p_dietary_preferences,'')),''),dietary_preferences),allergies=coalesce(nullif(trim(coalesce(p_allergies,'')),''),allergies),
      consent_marketing=p_consent_marketing,consent_data_processing=true,consent_updated_at=now(),updated_at=now()
    where id=v_guest_id;
  end if;

  insert into public.event_portal_registrations(portal_id,invite_id,inviting_member_id,guest_id,full_name,email,phone,company_name,dietary_preferences,allergies,companions,registration_status,payment_status,consent_data_processing,consent_marketing)
  values(v_portal.id,case when v_invite.id is not null then v_invite.id else null end,v_member_id,v_guest_id,trim(p_full_name),lower(trim(p_email)),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_company_name,'')),''),nullif(trim(coalesce(p_dietary_preferences,'')),''),nullif(trim(coalesce(p_allergies,'')),''),coalesce(p_companions,'[]'::jsonb),'confirmed',case when v_portal.commercial_model='free' then 'not_required' else 'pending' end,true,p_consent_marketing)
  returning id into v_registration_id;

  insert into public.guest_invitations(guest_id,inviting_member_id,event_id,valid_from,valid_until,status)
  values(v_guest_id,v_member_id,v_portal.event_id,v_event.start_date::timestamp,v_event.end_date::timestamp + interval '1 day','confirmed')
  returning id into v_invitation_id;

  if v_invite.id is not null then
    update public.event_portal_invites
    set used_count=used_count+1,status=case when used_count+1>=max_uses then 'used' else status end,updated_at=now()
    where id=v_invite.id;
  end if;

  return jsonb_build_object('registration_id',v_registration_id,'guest_id',v_guest_id,'guest_invitation_id',v_invitation_id,'payment_status',case when v_portal.commercial_model='free' then 'not_required' else 'pending' end);
end;
$function$;

revoke all on function public.register_event_portal_guest(text,text,text,text,text,text,text,text,jsonb,boolean,boolean) from public;
grant execute on function public.register_event_portal_guest(text,text,text,text,text,text,text,text,jsonb,boolean,boolean) to anon;
grant execute on function public.register_event_portal_guest(text,text,text,text,text,text,text,text,jsonb,boolean,boolean) to authenticated;

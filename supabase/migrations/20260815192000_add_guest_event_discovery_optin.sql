-- Guest opt-in for event-scoped Black Swan Discovery.
-- Guests participate only after explicit consent and only inside the event network
-- tied to their canonical registration. Raw guest discovery session tokens are
-- never stored; only SHA-256 hashes are persisted.

alter table public.discovery_intents
  alter column owner_member_id drop not null;

alter table public.discovery_intents
  add column if not exists owner_guest_id uuid references public.guests(id) on delete cascade,
  add column if not exists owner_event_registration_id uuid references public.event_portal_registrations(id) on delete cascade;

alter table public.discovery_intents
  drop constraint if exists discovery_intent_owner_shape_check;
alter table public.discovery_intents
  add constraint discovery_intent_owner_shape_check check (
    (owner_member_id is not null and owner_guest_id is null and owner_event_registration_id is null)
    or
    (owner_member_id is null and owner_guest_id is not null and owner_event_registration_id is not null)
  );

create table if not exists public.discovery_guest_sessions (
  registration_id uuid primary key references public.event_portal_registrations(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  network_id uuid not null references public.discovery_networks(id) on delete cascade,
  token_sha256 text not null unique,
  status text not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_guest_session_status_check check (status in ('active','revoked','expired'))
);

alter table public.discovery_guest_sessions enable row level security;

create or replace function public.start_guest_event_discovery_session(
  p_slug text,
  p_secret text,
  p_registration_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_portal public.event_guest_portals%rowtype;
  v_registration public.event_portal_registrations%rowtype;
  v_network_id uuid;
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz;
  v_allowed boolean := false;
begin
  select * into v_portal
  from public.event_guest_portals
  where slug=p_slug and status in ('published','closed');
  if not found then raise exception 'DISCOVERY_EVENT_NOT_FOUND'; end if;

  -- Reuse the same event-page access boundary. A valid invitation token or
  -- passcode is required in addition to the registration id and email.
  if public.resolve_event_guest_portal(p_slug,p_secret) is not null then
    v_allowed := true;
  end if;
  if not v_allowed then raise exception 'DISCOVERY_ACCESS_DENIED'; end if;

  select * into v_registration
  from public.event_portal_registrations
  where id=p_registration_id
    and portal_id=v_portal.id
    and lower(email)=lower(trim(p_email))
    and guest_id is not null
    and registration_status in ('confirmed','checked_in','completed');
  if not found then raise exception 'DISCOVERY_REGISTRATION_NOT_ELIGIBLE'; end if;

  select id into v_network_id
  from public.discovery_networks
  where event_id=v_portal.event_id and network_type='event';
  if v_network_id is null then raise exception 'DISCOVERY_EVENT_NETWORK_NOT_FOUND'; end if;

  v_token := encode(extensions.gen_random_bytes(24),'hex');
  v_token_hash := encode(extensions.digest(v_token,'sha256'),'hex');
  v_expires_at := greatest(now()+interval '24 hours', coalesce(v_portal.registration_closes_at,now())+interval '30 days');

  insert into public.discovery_guest_sessions(registration_id,guest_id,network_id,token_sha256,status,expires_at)
  values(v_registration.id,v_registration.guest_id,v_network_id,v_token_hash,'active',v_expires_at)
  on conflict(registration_id) do update set
    token_sha256=excluded.token_sha256,
    network_id=excluded.network_id,
    status='active',
    expires_at=excluded.expires_at,
    updated_at=now();

  return jsonb_build_object(
    'session_token',v_token,
    'registration_id',v_registration.id,
    'network_id',v_network_id,
    'expires_at',v_expires_at
  );
end;
$function$;

revoke all on function public.start_guest_event_discovery_session(text,text,uuid,text) from public;
grant execute on function public.start_guest_event_discovery_session(text,text,uuid,text) to anon;
grant execute on function public.start_guest_event_discovery_session(text,text,uuid,text) to authenticated;

create or replace function public.resolve_guest_discovery_session(p_session_token text)
returns public.discovery_guest_sessions
language sql
stable
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
  select s.*
  from public.discovery_guest_sessions s
  where s.token_sha256=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
    and s.status='active'
    and s.expires_at>now()
  limit 1;
$function$;

revoke all on function public.resolve_guest_discovery_session(text) from public;

create or replace function public.create_guest_event_discovery_intent(
  p_session_token text,
  p_summary text,
  p_intent_type text,
  p_privacy text default 'incognito',
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_session public.discovery_guest_sessions%rowtype;
  v_intent_id uuid;
begin
  select * into v_session from public.resolve_guest_discovery_session(p_session_token);
  if not found then raise exception 'DISCOVERY_GUEST_SESSION_INVALID'; end if;
  if p_intent_type not in ('seek','offer','interest') then raise exception 'INVALID_INTENT_TYPE'; end if;
  if p_privacy not in ('network_only','incognito') then raise exception 'GUEST_DISCOVERY_PRIVACY_INVALID'; end if;
  if length(trim(coalesce(p_summary,''))) < 5 then raise exception 'INTENT_TOO_SHORT'; end if;

  insert into public.discovery_intents(
    owner_guest_id,owner_event_registration_id,intent_type,summary,details,privacy,source,valid_until
  ) values (
    v_session.guest_id,v_session.registration_id,p_intent_type,trim(p_summary),
    nullif(trim(coalesce(p_details,'')),''),p_privacy,'event_declared',v_session.expires_at
  ) returning id into v_intent_id;

  insert into public.discovery_intent_networks(intent_id,network_id)
  values(v_intent_id,v_session.network_id);

  return v_intent_id;
end;
$function$;

revoke all on function public.create_guest_event_discovery_intent(text,text,text,text,text) from public;
grant execute on function public.create_guest_event_discovery_intent(text,text,text,text,text) to anon;
grant execute on function public.create_guest_event_discovery_intent(text,text,text,text,text) to authenticated;

-- Allow matching between different canonical identities: member-member,
-- member-guest, and guest-guest. A person's own multiple intents never match.
create or replace function public.run_discovery_matching(p_network_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_created integer := 0;
  v_network_type text;
  v_event_id uuid;
  v_member_id uuid := public.current_discovery_member_id();
begin
  if not public.can_use_discovery() then raise exception 'DISCOVERY_FORBIDDEN'; end if;
  select network_type,event_id into v_network_type,v_event_id
  from public.discovery_networks where id=p_network_id and status='active';
  if v_network_type is null then raise exception 'DISCOVERY_NETWORK_NOT_FOUND'; end if;

  if public.current_app_role() not in ('admin','approver') then
    if v_network_type='event' and not exists (
      select 1 from public.event_member_roles emr
      where emr.event_id=v_event_id and emr.member_id=v_member_id
    ) then raise exception 'DISCOVERY_NETWORK_FORBIDDEN'; end if;
  end if;

  insert into public.discovery_opportunities(network_id,intent_a_id,intent_b_id,confidence,reason,match_method,expires_at)
  select p_network_id,
         least(a.id,b.id),greatest(a.id,b.id),
         least(0.99, greatest(0.25,
           extensions.similarity(lower(a.summary),lower(b.summary))
           + case
               when (a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek') then 0.25
               when a.intent_type='interest' and b.intent_type='interest' then 0.10
               else 0.00
             end
         ))::numeric(5,4),
         case
           when (a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek')
             then 'Complementary current needs and offers align inside this private network.'
           else 'Current interests show meaningful overlap inside this private network.'
         end,
         'lexical_v2_guest',
         now()+interval '30 days'
  from public.discovery_intent_networks ain
  join public.discovery_intents a on a.id=ain.intent_id
  join public.discovery_intent_networks bin on bin.network_id=ain.network_id and bin.intent_id<>ain.intent_id
  join public.discovery_intents b on b.id=bin.intent_id
  where ain.network_id=p_network_id
    and a.id::text < b.id::text
    and (
      a.owner_member_id is distinct from b.owner_member_id
      or a.owner_guest_id is distinct from b.owner_guest_id
    )
    and a.status='active' and b.status='active'
    and a.privacy<>'private' and b.privacy<>'private'
    and (a.valid_until is null or a.valid_until>now())
    and (b.valid_until is null or b.valid_until>now())
    and (
      extensions.similarity(lower(a.summary),lower(b.summary)) >= 0.25
      or (((a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek'))
         and extensions.similarity(lower(a.summary),lower(b.summary)) >= 0.10)
    )
    and (
      public.current_app_role() in ('admin','approver')
      or a.owner_member_id=v_member_id
      or b.owner_member_id=v_member_id
    )
  on conflict(network_id,intent_a_id,intent_b_id) do update set
    confidence=excluded.confidence,
    reason=excluded.reason,
    match_method=excluded.match_method,
    updated_at=now(),
    expires_at=excluded.expires_at
  where public.discovery_opportunities.status='pending';
  get diagnostics v_created = row_count;

  return jsonb_build_object('network_id',p_network_id,'candidates_processed',v_created,'match_method','lexical_v2_guest');
end;
$function$;

create or replace function public.get_guest_discovery_workspace(p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_session public.discovery_guest_sessions%rowtype;
begin
  select * into v_session from public.resolve_guest_discovery_session(p_session_token);
  if not found then raise exception 'DISCOVERY_GUEST_SESSION_INVALID'; end if;

  return jsonb_build_object(
    'network_id',v_session.network_id,
    'my_intents',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',di.id,'intent_type',di.intent_type,'summary',di.summary,'details',di.details,
        'privacy',di.privacy,'status',di.status,'created_at',di.created_at
      ) order by di.created_at desc)
      from public.discovery_intents di
      where di.owner_event_registration_id=v_session.registration_id
    ),'[]'::jsonb),
    'opportunities',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',o.id,
        'confidence',o.confidence,
        'reason',o.reason,
        'status',o.status,
        'my_status',case when a.owner_event_registration_id=v_session.registration_id then o.party_a_status else o.party_b_status end,
        'counterpart_status',case when a.owner_event_registration_id=v_session.registration_id then o.party_b_status else o.party_a_status end,
        'counterpart_name',case when o.status='mutual' then
          case when a.owner_event_registration_id=v_session.registration_id
            then coalesce(mb.full_name,gb.name,'Black Swan participant')
            else coalesce(ma.full_name,ga.name,'Black Swan participant') end
          else 'Potential Black Swan connection' end,
        'counterpart_intent',case when o.status='mutual' then
          case when a.owner_event_registration_id=v_session.registration_id then b.summary else a.summary end
          else 'Private intent — mutual interest required' end
      ) order by o.confidence desc,o.created_at desc)
      from public.discovery_opportunities o
      join public.discovery_intents a on a.id=o.intent_a_id
      join public.discovery_intents b on b.id=o.intent_b_id
      left join public.members ma on ma.id=a.owner_member_id
      left join public.members mb on mb.id=b.owner_member_id
      left join public.guests ga on ga.id=a.owner_guest_id
      left join public.guests gb on gb.id=b.owner_guest_id
      where o.status in ('pending','mutual')
        and (a.owner_event_registration_id=v_session.registration_id or b.owner_event_registration_id=v_session.registration_id)
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_guest_discovery_workspace(text) from public;
grant execute on function public.get_guest_discovery_workspace(text) to anon;
grant execute on function public.get_guest_discovery_workspace(text) to authenticated;

create or replace function public.respond_guest_discovery_opportunity(
  p_session_token text,
  p_opportunity_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_session public.discovery_guest_sessions%rowtype;
  v_a_registration uuid;
  v_b_registration uuid;
  v_a_status text;
  v_b_status text;
  v_status text;
begin
  select * into v_session from public.resolve_guest_discovery_session(p_session_token);
  if not found then raise exception 'DISCOVERY_GUEST_SESSION_INVALID'; end if;
  if p_decision not in ('accepted','declined') then raise exception 'INVALID_OPPORTUNITY_DECISION'; end if;

  select a.owner_event_registration_id,b.owner_event_registration_id,o.party_a_status,o.party_b_status
  into v_a_registration,v_b_registration,v_a_status,v_b_status
  from public.discovery_opportunities o
  join public.discovery_intents a on a.id=o.intent_a_id
  join public.discovery_intents b on b.id=o.intent_b_id
  where o.id=p_opportunity_id and o.network_id=v_session.network_id and o.status in ('pending','mutual');
  if not found then raise exception 'OPPORTUNITY_NOT_FOUND'; end if;

  if v_session.registration_id=v_a_registration then
    update public.discovery_opportunities set party_a_status=p_decision,updated_at=now() where id=p_opportunity_id;
  elsif v_session.registration_id=v_b_registration then
    update public.discovery_opportunities set party_b_status=p_decision,updated_at=now() where id=p_opportunity_id;
  else
    raise exception 'OPPORTUNITY_FORBIDDEN';
  end if;

  select party_a_status,party_b_status into v_a_status,v_b_status
  from public.discovery_opportunities where id=p_opportunity_id;
  v_status := case
    when v_a_status='declined' or v_b_status='declined' then 'declined'
    when v_a_status='accepted' and v_b_status='accepted' then 'mutual'
    else 'pending'
  end;

  update public.discovery_opportunities
  set status=v_status,introduced_at=case when v_status='mutual' then coalesce(introduced_at,now()) else introduced_at end,updated_at=now()
  where id=p_opportunity_id;

  return jsonb_build_object('id',p_opportunity_id,'status',v_status,'your_decision',p_decision,'mutual',v_status='mutual');
end;
$function$;

revoke all on function public.respond_guest_discovery_opportunity(text,uuid,text) from public;
grant execute on function public.respond_guest_discovery_opportunity(text,uuid,text) to anon;
grant execute on function public.respond_guest_discovery_opportunity(text,uuid,text) to authenticated;

comment on table public.discovery_guest_sessions is 'Hash-only guest discovery sessions tied to one canonical event registration and one event network.';

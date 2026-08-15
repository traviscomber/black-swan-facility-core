-- Black Swan Discovery Layer, inspired by intent-driven private-network discovery.
-- This is a native Black Swan implementation: current intents, scoped networks,
-- privacy-aware matching, and mutual opt-in opportunities.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.discovery_networks (
  id uuid primary key default gen_random_uuid(),
  network_type text not null,
  event_id uuid references public.operational_events(id) on delete cascade,
  title text not null,
  prompt text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_network_type_check check (network_type in ('club','event')),
  constraint discovery_network_status_check check (status in ('active','closed','archived')),
  constraint discovery_network_event_shape_check check (
    (network_type='club' and event_id is null) or
    (network_type='event' and event_id is not null)
  )
);

create unique index if not exists discovery_network_single_club_idx
  on public.discovery_networks(network_type) where network_type='club';
create unique index if not exists discovery_network_event_idx
  on public.discovery_networks(event_id) where event_id is not null;

create table if not exists public.discovery_intents (
  id uuid primary key default gen_random_uuid(),
  owner_member_id uuid not null references public.members(id) on delete cascade,
  intent_type text not null,
  summary text not null,
  details text,
  privacy text not null default 'network_only',
  status text not null default 'active',
  source text not null default 'member_declared',
  confidence numeric(5,4) not null default 1.0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_intent_type_check check (intent_type in ('seek','offer','interest')),
  constraint discovery_intent_privacy_check check (privacy in ('network_only','incognito','private')),
  constraint discovery_intent_status_check check (status in ('active','paused','fulfilled','expired')),
  constraint discovery_intent_source_check check (source in ('member_declared','event_declared','concierge_confirmed')),
  constraint discovery_intent_confidence_check check (confidence between 0 and 1),
  constraint discovery_intent_summary_check check (length(trim(summary)) between 5 and 500),
  constraint discovery_intent_dates_check check (valid_until is null or valid_until > valid_from)
);

create table if not exists public.discovery_intent_networks (
  intent_id uuid not null references public.discovery_intents(id) on delete cascade,
  network_id uuid not null references public.discovery_networks(id) on delete cascade,
  relevancy_score numeric(5,4) not null default 1.0,
  assigned_at timestamptz not null default now(),
  primary key(intent_id, network_id),
  constraint discovery_intent_network_score_check check (relevancy_score between 0 and 1)
);

create table if not exists public.discovery_opportunities (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.discovery_networks(id) on delete cascade,
  intent_a_id uuid not null references public.discovery_intents(id) on delete cascade,
  intent_b_id uuid not null references public.discovery_intents(id) on delete cascade,
  confidence numeric(5,4) not null,
  reason text not null,
  match_method text not null default 'lexical_v1',
  party_a_status text not null default 'pending',
  party_b_status text not null default 'pending',
  status text not null default 'pending',
  surfaced_at timestamptz not null default now(),
  introduced_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_opportunity_pair_check check (intent_a_id::text < intent_b_id::text),
  constraint discovery_opportunity_confidence_check check (confidence between 0 and 1),
  constraint discovery_opportunity_party_a_check check (party_a_status in ('pending','accepted','declined')),
  constraint discovery_opportunity_party_b_check check (party_b_status in ('pending','accepted','declined')),
  constraint discovery_opportunity_status_check check (status in ('pending','mutual','declined','expired')),
  unique(network_id,intent_a_id,intent_b_id)
);

alter table public.discovery_networks enable row level security;
alter table public.discovery_intents enable row level security;
alter table public.discovery_intent_networks enable row level security;
alter table public.discovery_opportunities enable row level security;

create or replace function public.current_discovery_member_id()
returns uuid
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select mal.member_id
  from public.member_auth_links mal
  join public.members m on m.id=mal.member_id
  where mal.user_id=auth.uid()
    and mal.status='active'
    and mal.ended_at is null
    and m.status='active'
  limit 1;
$function$;

revoke all on function public.current_discovery_member_id() from public;
grant execute on function public.current_discovery_member_id() to authenticated;

create or replace function public.can_use_discovery()
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select auth.uid() is not null and (
    public.current_app_role() in ('admin','approver')
    or public.current_discovery_member_id() is not null
  );
$function$;

revoke all on function public.can_use_discovery() from public;
grant execute on function public.can_use_discovery() to authenticated;

create policy discovery_networks_read
  on public.discovery_networks for select to authenticated
  using (public.can_use_discovery());

create policy discovery_intents_read_own_or_admin
  on public.discovery_intents for select to authenticated
  using (public.current_app_role() in ('admin','approver') or owner_member_id=public.current_discovery_member_id());

create policy discovery_intent_networks_read
  on public.discovery_intent_networks for select to authenticated
  using (public.can_use_discovery());

create policy discovery_opportunities_read
  on public.discovery_opportunities for select to authenticated
  using (public.can_use_discovery());

insert into public.discovery_networks(network_type,title,prompt)
values('club','Black Swan Network','Private discovery among active Black Swan members based on current needs, offers and interests.')
on conflict do nothing;

insert into public.discovery_networks(network_type,event_id,title,prompt,status)
select 'event',e.id,e.name,
       'Temporary private discovery network for participants connected to this Black Swan event.',
       case when e.status in ('completed','cancelled') then 'closed' else 'active' end
from public.operational_events e
on conflict do nothing;

create or replace function public.ensure_event_discovery_network()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  insert into public.discovery_networks(network_type,event_id,title,prompt,status)
  values('event',new.id,new.name,'Temporary private discovery network for participants connected to this Black Swan event.',
         case when new.status in ('completed','cancelled') then 'closed' else 'active' end)
  on conflict(event_id) do update set title=excluded.title,status=excluded.status,updated_at=now();
  return new;
end;
$function$;

drop trigger if exists ensure_event_discovery_network_trigger on public.operational_events;
create trigger ensure_event_discovery_network_trigger
after insert or update of name,status on public.operational_events
for each row execute function public.ensure_event_discovery_network();

create or replace function public.get_discovery_navigation_entitlement()
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select public.can_use_discovery();
$function$;

revoke all on function public.get_discovery_navigation_entitlement() from public;
grant execute on function public.get_discovery_navigation_entitlement() to authenticated;

create or replace function public.create_discovery_intent(
  p_summary text,
  p_intent_type text,
  p_privacy text default 'network_only',
  p_network_ids uuid[] default null,
  p_details text default null,
  p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_member_id uuid;
  v_intent_id uuid;
  v_network_id uuid;
  v_club_network uuid;
begin
  v_member_id := public.current_discovery_member_id();
  if v_member_id is null then raise exception 'DISCOVERY_MEMBER_REQUIRED'; end if;
  if p_intent_type not in ('seek','offer','interest') then raise exception 'INVALID_INTENT_TYPE'; end if;
  if p_privacy not in ('network_only','incognito','private') then raise exception 'INVALID_INTENT_PRIVACY'; end if;
  if length(trim(coalesce(p_summary,''))) < 5 then raise exception 'INTENT_TOO_SHORT'; end if;

  insert into public.discovery_intents(owner_member_id,intent_type,summary,details,privacy,valid_until,created_by)
  values(v_member_id,p_intent_type,trim(p_summary),nullif(trim(coalesce(p_details,'')),''),p_privacy,p_valid_until,auth.uid())
  returning id into v_intent_id;

  if p_privacy <> 'private' then
    if p_network_ids is null or cardinality(p_network_ids)=0 then
      select id into v_club_network from public.discovery_networks where network_type='club' and status='active' limit 1;
      insert into public.discovery_intent_networks(intent_id,network_id) values(v_intent_id,v_club_network);
    else
      foreach v_network_id in array p_network_ids loop
        if not exists (
          select 1 from public.discovery_networks n
          where n.id=v_network_id and n.status='active'
            and (
              n.network_type='club'
              or exists (
                select 1 from public.event_member_roles emr
                where emr.event_id=n.event_id and emr.member_id=v_member_id
              )
            )
        ) then raise exception 'DISCOVERY_NETWORK_FORBIDDEN'; end if;
        insert into public.discovery_intent_networks(intent_id,network_id) values(v_intent_id,v_network_id);
      end loop;
    end if;
  end if;

  return v_intent_id;
end;
$function$;

revoke all on function public.create_discovery_intent(text,text,text,uuid[],text,timestamptz) from public;
grant execute on function public.create_discovery_intent(text,text,text,uuid[],text,timestamptz) to authenticated;

create or replace function public.set_discovery_intent_status(p_intent_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_member_id uuid;
begin
  v_member_id := public.current_discovery_member_id();
  if p_status not in ('active','paused','fulfilled','expired') then raise exception 'INVALID_INTENT_STATUS'; end if;
  update public.discovery_intents
  set status=p_status,updated_at=now()
  where id=p_intent_id and owner_member_id=v_member_id;
  if not found then raise exception 'INTENT_NOT_FOUND_OR_FORBIDDEN'; end if;
end;
$function$;

revoke all on function public.set_discovery_intent_status(uuid,text) from public;
grant execute on function public.set_discovery_intent_status(uuid,text) to authenticated;

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
begin
  if not public.can_use_discovery() then raise exception 'DISCOVERY_FORBIDDEN'; end if;
  select network_type,event_id into v_network_type,v_event_id
  from public.discovery_networks where id=p_network_id and status='active';
  if v_network_type is null then raise exception 'DISCOVERY_NETWORK_NOT_FOUND'; end if;

  -- Members may trigger matching only for the club network or event networks in which they are a member participant.
  if public.current_app_role() not in ('admin','approver') then
    if v_network_type='event' and not exists (
      select 1 from public.event_member_roles emr
      where emr.event_id=v_event_id and emr.member_id=public.current_discovery_member_id()
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
         'lexical_v1',
         now()+interval '30 days'
  from public.discovery_intent_networks ain
  join public.discovery_intents a on a.id=ain.intent_id
  join public.discovery_intent_networks bin on bin.network_id=ain.network_id and bin.intent_id<>ain.intent_id
  join public.discovery_intents b on b.id=bin.intent_id
  where ain.network_id=p_network_id
    and a.id::text < b.id::text
    and a.owner_member_id<>b.owner_member_id
    and a.status='active' and b.status='active'
    and a.privacy<>'private' and b.privacy<>'private'
    and (a.valid_until is null or a.valid_until>now())
    and (b.valid_until is null or b.valid_until>now())
    and (
      extensions.similarity(lower(a.summary),lower(b.summary)) >= 0.25
      or ((a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek'))
         and extensions.similarity(lower(a.summary),lower(b.summary)) >= 0.10
    )
  on conflict(network_id,intent_a_id,intent_b_id) do update set
    confidence=excluded.confidence,
    reason=excluded.reason,
    updated_at=now(),
    expires_at=excluded.expires_at
  where public.discovery_opportunities.status='pending';
  get diagnostics v_created = row_count;

  return jsonb_build_object('network_id',p_network_id,'candidates_processed',v_created,'match_method','lexical_v1');
end;
$function$;

revoke all on function public.run_discovery_matching(uuid) from public;
grant execute on function public.run_discovery_matching(uuid) to authenticated;

create or replace function public.respond_discovery_opportunity(p_opportunity_id uuid,p_decision text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_member_id uuid;
  v_a_member uuid;
  v_b_member uuid;
  v_a_status text;
  v_b_status text;
  v_status text;
begin
  v_member_id := public.current_discovery_member_id();
  if v_member_id is null then raise exception 'DISCOVERY_MEMBER_REQUIRED'; end if;
  if p_decision not in ('accepted','declined') then raise exception 'INVALID_OPPORTUNITY_DECISION'; end if;

  select a.owner_member_id,b.owner_member_id,o.party_a_status,o.party_b_status
    into v_a_member,v_b_member,v_a_status,v_b_status
  from public.discovery_opportunities o
  join public.discovery_intents a on a.id=o.intent_a_id
  join public.discovery_intents b on b.id=o.intent_b_id
  where o.id=p_opportunity_id and o.status in ('pending','mutual');
  if not found then raise exception 'OPPORTUNITY_NOT_FOUND'; end if;

  if v_member_id=v_a_member then
    update public.discovery_opportunities set party_a_status=p_decision,updated_at=now() where id=p_opportunity_id;
  elsif v_member_id=v_b_member then
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
  set status=v_status,
      introduced_at=case when v_status='mutual' then coalesce(introduced_at,now()) else introduced_at end,
      updated_at=now()
  where id=p_opportunity_id;

  return jsonb_build_object('id',p_opportunity_id,'status',v_status,'your_decision',p_decision,'mutual',v_status='mutual');
end;
$function$;

revoke all on function public.respond_discovery_opportunity(uuid,text) from public;
grant execute on function public.respond_discovery_opportunity(uuid,text) to authenticated;

create or replace function public.get_discovery_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_member_id uuid;
  v_is_admin boolean;
  v_result jsonb;
begin
  if not public.can_use_discovery() then raise exception 'DISCOVERY_FORBIDDEN'; end if;
  v_member_id := public.current_discovery_member_id();
  v_is_admin := public.current_app_role() in ('admin','approver');

  select jsonb_build_object(
    'member_id',v_member_id,
    'networks',coalesce((select jsonb_agg(to_jsonb(n) order by n.network_type,n.title) from (
      select dn.id,dn.network_type,dn.event_id,dn.title,dn.prompt,dn.status
      from public.discovery_networks dn
      where dn.status='active'
        and (
          dn.network_type='club'
          or v_is_admin
          or exists(select 1 from public.event_member_roles emr where emr.event_id=dn.event_id and emr.member_id=v_member_id)
        )
    ) n),'[]'::jsonb),
    'my_intents',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from (
      select di.id,di.intent_type,di.summary,di.details,di.privacy,di.status,di.source,di.valid_from,di.valid_until,di.created_at,
        coalesce((select jsonb_agg(jsonb_build_object('id',dn.id,'title',dn.title,'type',dn.network_type))
          from public.discovery_intent_networks din join public.discovery_networks dn on dn.id=din.network_id where din.intent_id=di.id),'[]'::jsonb) as networks
      from public.discovery_intents di where di.owner_member_id=v_member_id
    ) i),'[]'::jsonb),
    'opportunities',coalesce((select jsonb_agg(to_jsonb(o) order by o.confidence desc,o.created_at desc) from (
      select opp.id,opp.network_id,dn.title as network_title,opp.confidence,opp.reason,opp.status,opp.party_a_status,opp.party_b_status,opp.created_at,opp.introduced_at,
        case when a.owner_member_id=v_member_id then b.owner_member_id else a.owner_member_id end as counterpart_member_id,
        case when a.owner_member_id=v_member_id then mb.full_name else ma.full_name end as counterpart_name,
        case when a.owner_member_id=v_member_id then b.intent_type else a.intent_type end as counterpart_intent_type,
        case
          when (case when a.owner_member_id=v_member_id then b.privacy else a.privacy end)='incognito' and opp.status<>'mutual'
            then 'Private intent — mutual interest required'
          else case when a.owner_member_id=v_member_id then b.summary else a.summary end
        end as counterpart_intent,
        case when a.owner_member_id=v_member_id then opp.party_a_status else opp.party_b_status end as my_status,
        case when a.owner_member_id=v_member_id then opp.party_b_status else opp.party_a_status end as counterpart_status
      from public.discovery_opportunities opp
      join public.discovery_intents a on a.id=opp.intent_a_id
      join public.discovery_intents b on b.id=opp.intent_b_id
      join public.members ma on ma.id=a.owner_member_id
      join public.members mb on mb.id=b.owner_member_id
      join public.discovery_networks dn on dn.id=opp.network_id
      where opp.status<>'expired'
        and (v_is_admin or a.owner_member_id=v_member_id or b.owner_member_id=v_member_id)
    ) o),'[]'::jsonb),
    'summary',jsonb_build_object(
      'active_intents',(select count(*) from public.discovery_intents where owner_member_id=v_member_id and status='active'),
      'pending_opportunities',(select count(*) from public.discovery_opportunities opp join public.discovery_intents a on a.id=opp.intent_a_id join public.discovery_intents b on b.id=opp.intent_b_id where opp.status='pending' and (a.owner_member_id=v_member_id or b.owner_member_id=v_member_id)),
      'mutual_introductions',(select count(*) from public.discovery_opportunities opp join public.discovery_intents a on a.id=opp.intent_a_id join public.discovery_intents b on b.id=opp.intent_b_id where opp.status='mutual' and (a.owner_member_id=v_member_id or b.owner_member_id=v_member_id))
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_discovery_workspace() from public;
grant execute on function public.get_discovery_workspace() to authenticated;

comment on table public.discovery_intents is 'Member-declared current seeks, offers and interests for private Black Swan discovery. Private intents never enter matching.';
comment on table public.discovery_opportunities is 'Privacy-aware candidate introductions. A connection becomes mutual only after both members explicitly accept.';

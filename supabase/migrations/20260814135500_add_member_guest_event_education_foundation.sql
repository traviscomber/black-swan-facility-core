-- Black Swan Corporacion: member-driven guest, event, education, and publication foundation.
--
-- This migration extends existing guest/event structures. It does not create or
-- backfill member records from existing guests or participants. All new flows
-- remain review-first and scoped to BS Corporacion.

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  member_number text,
  full_name text not null,
  email text,
  phone text,
  status text not null default 'active',
  joined_at date,
  ended_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_status_check check (status in ('prospect','active','suspended','inactive','former')),
  constraint members_dates_check check (ended_at is null or joined_at is null or ended_at >= joined_at)
);

create unique index if not exists members_entity_number_unique
  on public.members(legal_entity_id, member_number)
  where member_number is not null;

create table if not exists public.member_presence (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  status text not null default 'on_ground',
  verified_by uuid references auth.users(id) on delete set null,
  verification_method text,
  notes text,
  created_at timestamptz not null default now(),
  constraint member_presence_status_check check (status in ('on_ground','checked_out','cancelled')),
  constraint member_presence_dates_check check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create unique index if not exists member_presence_one_open_session
  on public.member_presence(member_id)
  where status = 'on_ground' and checked_out_at is null;

create table if not exists public.guest_invitations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  inviting_member_id uuid not null references public.members(id) on delete restrict,
  event_id uuid references public.operational_events(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status text not null default 'invited',
  approved_override boolean not null default false,
  override_reason text,
  override_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_invitation_status_check check (status in ('invited','confirmed','checked_in','completed','cancelled','denied')),
  constraint guest_invitation_dates_check check (valid_until >= valid_from),
  constraint guest_invitation_override_reason_check check (not approved_override or nullif(btrim(override_reason),'') is not null)
);

create or replace function public.is_member_on_ground(p_member_id uuid, p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.member_presence mp
    where mp.member_id = p_member_id
      and mp.status = 'on_ground'
      and mp.checked_in_at <= p_at
      and (mp.checked_out_at is null or mp.checked_out_at > p_at)
  );
$function$;

revoke all on function public.is_member_on_ground(uuid,timestamptz) from public;
grant execute on function public.is_member_on_ground(uuid,timestamptz) to authenticated;
grant execute on function public.is_member_on_ground(uuid,timestamptz) to service_role;

create or replace function public.can_guest_enter(p_invitation_id uuid, p_at timestamptz default now())
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_inv public.guest_invitations%rowtype;
begin
  select * into v_inv
  from public.guest_invitations
  where id = p_invitation_id;

  if not found then
    return false;
  end if;

  if v_inv.status not in ('invited','confirmed','checked_in') then
    return false;
  end if;

  if p_at < v_inv.valid_from or p_at > v_inv.valid_until then
    return false;
  end if;

  if v_inv.approved_override then
    return true;
  end if;

  return public.is_member_on_ground(v_inv.inviting_member_id, p_at);
end;
$function$;

revoke all on function public.can_guest_enter(uuid,timestamptz) from public;
grant execute on function public.can_guest_enter(uuid,timestamptz) to authenticated;
grant execute on function public.can_guest_enter(uuid,timestamptz) to service_role;

create table if not exists public.event_member_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.operational_events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, member_id, role),
  constraint event_member_role_check check (role in ('host','sponsor','organizer','participant','speaker'))
);

create table if not exists public.education_collections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.operational_events(id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'collecting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_collection_status_check check (status in ('collecting','processing','review','approved','published','archived'))
);

create unique index if not exists education_collection_event_unique
  on public.education_collections(event_id);

create table if not exists public.education_materials (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.education_collections(id) on delete cascade,
  material_type text not null,
  title text not null,
  source_url text,
  storage_path text,
  source_event_file_id uuid references public.operational_event_sources(id) on delete set null,
  status text not null default 'draft',
  privacy_level text not null default 'internal',
  editorial_notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_material_type_check check (material_type in ('recording','video','photo','presentation','transcript','article','research','summary','learning_material','other')),
  constraint education_material_status_check check (status in ('draft','processing','review','approved','published','archived')),
  constraint education_material_privacy_check check (privacy_level in ('private','members','internal','public'))
);

create table if not exists public.foundation_publications (
  id uuid primary key default gen_random_uuid(),
  education_material_id uuid not null references public.education_materials(id) on delete restrict,
  channel text not null,
  status text not null default 'draft',
  public_title text,
  public_summary text,
  campaign_reference text,
  published_url text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundation_publication_channel_check check (channel in ('website','newsletter','social','program','event_promotion','partner','other')),
  constraint foundation_publication_status_check check (status in ('draft','review','approved','published','withdrawn'))
);

-- Prevent publication of non-public or unapproved education material.
create or replace function public.validate_foundation_publication_material()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_privacy text;
begin
  if new.status in ('approved','published') then
    select status, privacy_level into v_status, v_privacy
    from public.education_materials
    where id = new.education_material_id;

    if v_status not in ('approved','published') or v_privacy <> 'public' then
      raise exception 'Education material must be approved and public before Foundation publication';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists foundation_publication_material_guard on public.foundation_publications;
create trigger foundation_publication_material_guard
before insert or update on public.foundation_publications
for each row execute function public.validate_foundation_publication_material();

-- Every event managed by Corporacion must ultimately have a member relationship.
-- Existing events are intentionally not backfilled or constrained here because
-- canonical member mapping does not yet exist. The application/regression gate
-- will treat unlinked events as unresolved legacy records until reviewed.

alter table public.members enable row level security;
alter table public.member_presence enable row level security;
alter table public.guest_invitations enable row level security;
alter table public.event_member_roles enable row level security;
alter table public.education_collections enable row level security;
alter table public.education_materials enable row level security;
alter table public.foundation_publications enable row level security;

create policy members_entity_view
  on public.members for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));

create policy member_presence_entity_view
  on public.member_presence for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_presence.member_id
      and public.can_access_legal_entity(m.legal_entity_id, 'view')
  ));

create policy guest_invitations_entity_view
  on public.guest_invitations for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = guest_invitations.inviting_member_id
      and public.can_access_legal_entity(m.legal_entity_id, 'view')
  ));

create policy event_member_roles_entity_view
  on public.event_member_roles for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = event_member_roles.member_id
      and public.can_access_legal_entity(m.legal_entity_id, 'view')
  ));

create policy education_collections_corporacion_view
  on public.education_collections for select to authenticated
  using (exists (
    select 1 from public.legal_entities le
    where le.code = 'BS_CORPORACION'
      and public.can_access_legal_entity(le.id, 'view')
  ));

create policy education_materials_corporacion_view
  on public.education_materials for select to authenticated
  using (exists (
    select 1 from public.legal_entities le
    where le.code = 'BS_CORPORACION'
      and public.can_access_legal_entity(le.id, 'view')
  ));

create policy foundation_publications_corporacion_view
  on public.foundation_publications for select to authenticated
  using (exists (
    select 1 from public.legal_entities le
    where le.code = 'BS_CORPORACION'
      and public.can_access_legal_entity(le.id, 'view')
  ));

comment on table public.members is 'Canonical Black Swan Corporacion membership registry.';
comment on table public.member_presence is 'Verified member on-ground sessions. Guest access depends on the inviting member being on ground unless an audited override exists.';
comment on table public.guest_invitations is 'Guest invitations are always tied to an inviting member and may optionally be tied to an event/reservation.';
comment on table public.event_member_roles is 'Member relationship to each Foundation event: host, sponsor, organizer, participant, or speaker.';
comment on table public.education_collections is 'Event-derived educational collection. Every collection belongs to one operational event.';
comment on table public.education_materials is 'Education assets created from events and subject to privacy/editorial review before publication.';
comment on table public.foundation_publications is 'Sales & Marketing front-door publication records for approved public educational material.';
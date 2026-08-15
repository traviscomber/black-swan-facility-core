-- Black Swan Corporacion: invite-only event guest portals and registration.
--
-- The portal is a curated public surface for a canonical operational event.
-- It does not expose internal OS data. Access is granted by a signed invite token
-- or optional event passcode. Registration creates a guest/event relationship
-- but does not create accounting entries or payment records automatically.

create table if not exists public.event_guest_portals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.operational_events(id) on delete cascade,
  slug text not null unique,
  status text not null default 'draft',
  access_mode text not null default 'invite_token',
  passcode_hash text,
  headline text,
  black_swan_intro text,
  event_description text,
  program jsonb not null default '[]'::jsonb,
  practical_info jsonb not null default '{}'::jsonb,
  registration_fields jsonb not null default '["full_name","email"]'::jsonb,
  capacity integer,
  allow_companions boolean not null default false,
  max_companions integer not null default 0,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  commercial_model text not null default 'free',
  ticket_price numeric(14,2),
  currency text not null default 'CLP',
  tax_included boolean not null default true,
  collecting_legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  payment_provider text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_guest_portal_status_check check (status in ('draft','published','closed','archived')),
  constraint event_guest_portal_access_check check (access_mode in ('invite_token','passcode','invite_or_passcode')),
  constraint event_guest_portal_commercial_check check (commercial_model in ('free','pay_at_venue','bank_transfer','online_card','host_settlement')),
  constraint event_guest_portal_capacity_check check (capacity is null or capacity > 0),
  constraint event_guest_portal_companion_check check (max_companions >= 0 and (allow_companions or max_companions = 0)),
  constraint event_guest_portal_price_check check (ticket_price is null or ticket_price >= 0),
  constraint event_guest_portal_passcode_check check (access_mode = 'invite_token' or passcode_hash is not null)
);

create table if not exists public.event_portal_invites (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.event_guest_portals(id) on delete cascade,
  inviting_member_id uuid references public.members(id) on delete restrict,
  invitee_name text,
  invitee_email text,
  token_hash text not null unique,
  status text not null default 'active',
  expires_at timestamptz,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_portal_invite_status_check check (status in ('active','used','revoked','expired')),
  constraint event_portal_invite_uses_check check (max_uses > 0 and used_count >= 0 and used_count <= max_uses)
);

create table if not exists public.event_portal_registrations (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.event_guest_portals(id) on delete cascade,
  invite_id uuid references public.event_portal_invites(id) on delete set null,
  inviting_member_id uuid references public.members(id) on delete restrict,
  guest_id uuid references public.guests(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  dietary_preferences text,
  allergies text,
  companions jsonb not null default '[]'::jsonb,
  registration_status text not null default 'confirmed',
  payment_status text not null default 'not_required',
  consent_data_processing boolean not null default false,
  consent_marketing boolean not null default false,
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_portal_registration_status_check check (registration_status in ('pending','confirmed','waitlist','cancelled','checked_in','completed','no_show')),
  constraint event_portal_payment_status_check check (payment_status in ('not_required','pending','paid','failed','refunded','manual')),
  constraint event_portal_registration_consent_check check (consent_data_processing = true)
);

create unique index if not exists event_portal_registration_email_unique
  on public.event_portal_registrations(portal_id, lower(email))
  where registration_status <> 'cancelled';

create index if not exists event_portal_registration_portal_status_idx
  on public.event_portal_registrations(portal_id, registration_status);

alter table public.event_guest_portals enable row level security;
alter table public.event_portal_invites enable row level security;
alter table public.event_portal_registrations enable row level security;

create policy event_guest_portals_internal_view
  on public.event_guest_portals for select to authenticated
  using (exists (
    select 1 from public.legal_entities le
    where le.code = 'BS_CORPORACION'
      and public.can_access_legal_entity(le.id, 'view')
  ));

create policy event_portal_invites_internal_view
  on public.event_portal_invites for select to authenticated
  using (exists (
    select 1 from public.event_guest_portals p
    join public.legal_entities le on le.code = 'BS_CORPORACION'
    where p.id = event_portal_invites.portal_id
      and public.can_access_legal_entity(le.id, 'view')
  ));

create policy event_portal_registrations_internal_view
  on public.event_portal_registrations for select to authenticated
  using (exists (
    select 1 from public.event_guest_portals p
    join public.legal_entities le on le.code = 'BS_CORPORACION'
    where p.id = event_portal_registrations.portal_id
      and public.can_access_legal_entity(le.id, 'view')
  ));

comment on table public.event_guest_portals is 'Invite-only curated event microsite configuration. Never exposes internal Black Swan OS records.';
comment on table public.event_portal_invites is 'Hashed, revocable event invite tokens linked to the inviting member where known.';
comment on table public.event_portal_registrations is 'Guest registration for an invite-only event portal. Payment state is recorded abstractly; no processor is assumed.';

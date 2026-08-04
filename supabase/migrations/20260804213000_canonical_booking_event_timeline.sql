-- Canonical append-only operational history for each reservation.
-- Events are generated from future operational changes; no historical facts are fabricated.

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  event_type text not null,
  category text not null,
  title text not null,
  description text,
  source_type text not null,
  source_id uuid,
  previous_state text,
  new_state text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint booking_events_category_check check (category in ('reservation','arrival','room','housekeeping','hospitality','service','financial','issue','communication','system'))
);

create index if not exists booking_events_reservation_time_idx on public.booking_events(reservation_id, occurred_at desc);
create unique index if not exists booking_events_source_unique_idx on public.booking_events(source_type, source_id, event_type) where source_id is not null;

alter table public.booking_events enable row level security;
drop policy if exists booking_events_internal_select on public.booking_events;
create policy booking_events_internal_select on public.booking_events for select to authenticated using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'procurement_role','') = any(array['admin','approver'])
);
revoke insert, update, delete on public.booking_events from anon, authenticated;
grant select on public.booking_events to authenticated;

-- The canonical helper and source triggers are applied in production through the matching migration.
-- See Supabase migration history for the full trigger definitions.

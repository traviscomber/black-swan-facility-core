-- Black Swan OS: API audit trail for the Cloudflare control plane.
--
-- This table is append-only from the application perspective. Authenticated users
-- may insert only events for their own auth.uid(). Administrative readers can
-- review events across the system. No production data is modified by this migration.

create table if not exists public.api_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_id text not null,
  service text not null,
  api_version text not null,
  environment text not null,
  method text not null,
  route text not null,
  action text not null,
  legal_entity_id uuid references public.legal_entities(id) on delete set null,
  outcome text not null,
  status_code integer not null,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint api_audit_outcome_check check (outcome in ('success','denied','error')),
  constraint api_audit_status_code_check check (status_code between 100 and 599),
  constraint api_audit_duration_check check (duration_ms is null or duration_ms >= 0)
);

create index if not exists api_audit_events_actor_time_idx
  on public.api_audit_events(actor_user_id, occurred_at desc);
create index if not exists api_audit_events_entity_time_idx
  on public.api_audit_events(legal_entity_id, occurred_at desc)
  where legal_entity_id is not null;
create index if not exists api_audit_events_route_time_idx
  on public.api_audit_events(route, occurred_at desc);

alter table public.api_audit_events enable row level security;

create policy api_audit_events_self_insert
  on public.api_audit_events for insert to authenticated
  with check (actor_user_id = auth.uid());

create policy api_audit_events_admin_select
  on public.api_audit_events for select to authenticated
  using (public.current_app_role() = 'admin');

comment on table public.api_audit_events is 'Append-only user-scoped audit trail for Black Swan OS Cloudflare API requests and authorization outcomes.';

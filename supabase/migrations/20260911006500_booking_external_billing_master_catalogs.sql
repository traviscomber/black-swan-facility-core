create table if not exists public.booking_external_billing_clients (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  external_ref text not null,
  source_page integer not null,
  source_position integer not null,
  short_name text not null,
  client_name text,
  tax_id_or_address text,
  email text,
  reconciliation_status text not null default 'observed',
  canonical_guest_id uuid references public.guests(id) on delete set null,
  raw_fields jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  unique(source_system, external_ref)
);

create table if not exists public.booking_external_products (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  external_ref text not null,
  source_page integer not null,
  source_position integer not null,
  name text not null,
  net_display text,
  gross_display text,
  sold_count integer,
  available_display text,
  reconciliation_status text not null default 'observed',
  raw_fields jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  unique(source_system, external_ref)
);

alter table public.booking_external_billing_clients enable row level security;
alter table public.booking_external_products enable row level security;

create policy booking_external_billing_clients_finance_select on public.booking_external_billing_clients
for select to authenticated
using (public.can_app_action('finance.record_payment'));

create policy booking_external_products_booking_finance_select on public.booking_external_products
for select to authenticated
using (public.can_app_action('finance.record_payment') or public.can_booking_action('booking.modify'));

create index if not exists booking_external_billing_clients_name_idx on public.booking_external_billing_clients(lower(short_name));
create index if not exists booking_external_products_name_idx on public.booking_external_products(lower(name));

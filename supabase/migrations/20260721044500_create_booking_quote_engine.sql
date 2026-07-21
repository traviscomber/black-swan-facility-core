-- Centralized availability and pricing engine for internal booking quotes.

begin;

create table if not exists public.booking_settings (
  id text primary key default 'default',
  currency text not null default 'CLP',
  lodging_tax_rate numeric(6,3) not null default 0 check (lodging_tax_rate >= 0 and lodging_tax_rate <= 100),
  service_fee numeric(12,2) not null default 0 check (service_fee >= 0),
  updated_at timestamptz not null default now()
);

insert into public.booking_settings (id, currency, lodging_tax_rate, service_fee)
values ('default', 'CLP', 0, 0)
on conflict (id) do nothing;

alter table public.booking_settings enable row level security;
drop policy if exists "Authenticated users manage
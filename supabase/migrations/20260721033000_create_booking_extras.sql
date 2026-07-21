create table if not exists public.booking_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  unit text not null default 'unit' check (unit in ('unit', 'night', 'person', 'person_night', 'stay')),
  price numeric(12,2) not null check (price >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_extras (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  extra_id uuid references public.booking_extras(id) on delete set null,
  name text not null,
  unit text not null check (unit in ('unit', 'night', 'person', 'person_night', 'stay')),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  total_amount numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists reservation_extras_reservation_idx
  on public.reservation_extras (reservation_id, created_at desc);

create index if not exists booking_extras_active_idx
  on public.booking_extras (is_active, name);

alter table public.booking_extras enable row level security;
alter table public.reservation_extras enable row level security;

drop policy if exists "Authenticated users can manage booking extras" on public.booking_extras;
create policy "Authenticated users can manage booking extras"
  on public.booking_extras for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can manage reservation extras" on public.reservation_extras;
create policy "Authenticated users can manage reservation extras"
  on public.reservation_extras for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.booking_extras to authenticated;
grant select, insert, update, delete on public.reservation_extras to authenticated;

create or replace function public.set_booking_extras_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists booking_extras_set_updated_at on public.booking_extras;
create trigger booking_extras_set_updated_at
before update on public.booking_extras
for each row execute function public.set_booking_extras_updated_at();

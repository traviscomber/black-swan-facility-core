-- Restrict core booking data to authenticated application users.
-- This migration intentionally preserves full CRUD for authenticated users
-- while removing anonymous/public access. More granular role policies can
-- be introduced later without reopening access to the anon role.

begin;

alter table public.reservations enable row level security;
alter table public.rooms enable row level security;
alter table public.beds enable row level security;
alter table public.payments enable row level security;
alter table public.guests enable row level security;

-- Remove legacy policies that grant unrestricted access to public/anon.
drop policy if exists "Allow all on reservations" on public.reservations;
drop policy if exists "Allow all operations on beds" on public.beds;
drop policy if exists "Allow all on rooms" on public.rooms;
drop policy if exists "Allow all on payments" on public.payments;
drop policy if exists "Allow all on guests" on public.guests;

-- Authenticated users retain the CRUD behavior required by the current app.
create policy "Authenticated users manage reservations"
on public.reservations
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users manage rooms"
on public.rooms
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users manage beds"
on public.beds
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users manage payments"
on public.payments
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users manage guests"
on public.guests
for all
to authenticated
using (true)
with check (true);

commit;

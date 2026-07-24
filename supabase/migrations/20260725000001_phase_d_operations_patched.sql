-- Phase D: Operations (Housekeeping, Maintenance, Staff)
-- Patched: replaced references to public.profiles (does not exist) with auth.users

-- Housekeeping schedules (D1)
create table if not exists public.housekeeping_schedules (
  id uuid default gen_random_uuid() primary key,
  bed_id uuid not null references public.beds(id) on delete cascade,
  checkout_reservation_id uuid references public.reservations(id) on delete set null,
  checkout_time timestamp default now(),
  cleaning_duration_minutes int default 120 check (cleaning_duration_minutes > 0 and cleaning_duration_minutes <= 480),
  assigned_staff_id uuid references auth.users(id) on delete set null,
  status text default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Maintenance schedules (D2)
create table if not exists public.maintenance_schedules (
  id uuid default gen_random_uuid() primary key,
  bed_id uuid not null references public.beds(id) on delete cascade,
  maintenance_type text default 'inspection' check (maintenance_type in ('inspection', 'repair', 'preventive', 'urgent')),
  scheduled_date date not null,
  duration_minutes int default 60 check (duration_minutes > 0 and duration_minutes <= 480),
  priority int default 1 check (priority >= 0 and priority <= 3),
  status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Staff assignments (D5)
create table if not exists public.staff_assignments (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid not null references auth.users(id) on delete cascade,
  task_type text not null check (task_type in ('housekeeping', 'maintenance', 'checkin', 'checkout')),
  task_id uuid,
  assigned_date date default current_date,
  start_time time,
  end_time time,
  status text default 'assigned' check (status in ('assigned', 'in_progress', 'completed', 'cancelled')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Room state view (D4)
create or replace view public.room_state_matrix as
select
  r.id as room_id,
  b.id as bed_id,
  b.bed_number,
  r.room_number,
  coalesce(res.status, 'available') as reservation_status,
  coalesce(hs.status, 'clean') as housekeeping_status,
  coalesce(ms.status, 'ok') as maintenance_status,
  case
    when res.status in ('confirmed', 'checked_in') then 'occupied'
    when ms.status in ('in_progress') then 'maintenance'
    when hs.status in ('pending', 'in_progress') then 'cleaning'
    else 'available'
  end as availability_status,
  res.id as current_reservation_id,
  res.guest_name,
  res.check_in,
  res.check_out,
  hs.id as current_housekeeping_id,
  ms.id as current_maintenance_id
from public.beds b
join public.rooms r on b.room_id = r.id
left join public.reservations res
  on b.id = res.bed_id
  and res.status not in ('cancelled', 'void')
  and res.check_in <= current_date
  and res.check_out > current_date
left join public.housekeeping_schedules hs
  on b.id = hs.bed_id
  and hs.status != 'completed'
  and hs.checkout_time::date = current_date
left join public.maintenance_schedules ms
  on b.id = ms.bed_id
  and ms.status not in ('completed', 'cancelled')
  and ms.scheduled_date = current_date
order by r.room_number, b.bed_number;

-- Indexes
create index if not exists idx_housekeeping_bed_date on public.housekeeping_schedules(bed_id, checkout_time);
create index if not exists idx_housekeeping_staff on public.housekeeping_schedules(assigned_staff_id);
create index if not exists idx_maintenance_date on public.maintenance_schedules(scheduled_date, bed_id);
create index if not exists idx_maintenance_status on public.maintenance_schedules(status, scheduled_date);

-- RPC: Auto-create housekeeping task when checkout
create or replace function public.create_housekeeping_on_checkout()
returns trigger as $$
begin
  if new.status = 'checked_out' and old.status != 'checked_out' then
    insert into public.housekeeping_schedules (bed_id, checkout_reservation_id, checkout_time, cleaning_duration_minutes)
    values (new.bed_id, new.id, now(), 120);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_reservation_checkout_create_cleaning on public.reservations;
create trigger on_reservation_checkout_create_cleaning
after update on public.reservations
for each row
execute function public.create_housekeeping_on_checkout();

-- RLS
alter table public.housekeeping_schedules enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.staff_assignments enable row level security;

drop policy if exists "Enable read for authenticated" on public.housekeeping_schedules;
drop policy if exists "Enable insert/update/delete for authenticated" on public.housekeeping_schedules;
drop policy if exists "Enable read for authenticated" on public.maintenance_schedules;
drop policy if exists "Enable insert/update/delete for authenticated" on public.maintenance_schedules;
drop policy if exists "Enable read for authenticated" on public.staff_assignments;
drop policy if exists "Enable insert/update/delete for authenticated" on public.staff_assignments;

create policy "HK read" on public.housekeeping_schedules for select using (auth.role() = 'authenticated');
create policy "HK write" on public.housekeeping_schedules for all using (auth.role() = 'authenticated');
create policy "Maint read" on public.maintenance_schedules for select using (auth.role() = 'authenticated');
create policy "Maint write" on public.maintenance_schedules for all using (auth.role() = 'authenticated');
create policy "Staff read" on public.staff_assignments for select using (auth.role() = 'authenticated');
create policy "Staff write" on public.staff_assignments for all using (auth.role() = 'authenticated');

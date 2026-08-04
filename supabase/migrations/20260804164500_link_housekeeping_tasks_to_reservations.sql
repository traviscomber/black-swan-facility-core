alter table public.housekeeping_tasks
  add column if not exists reservation_id uuid references public.reservations(id) on delete set null;

create index if not exists idx_housekeeping_tasks_reservation_id
  on public.housekeeping_tasks(reservation_id);

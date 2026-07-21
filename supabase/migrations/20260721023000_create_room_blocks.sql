create extension if not exists btree_gist;

create table if not exists public.room_blocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  block_type text not null default 'maintenance' check (block_type in ('maintenance', 'owner_use', 'out_of_service', 'other')),
  reason text not null,
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_blocks_valid_dates check (end_date > start_date)
);

create index if not exists room_blocks_room_dates_idx
  on public.room_blocks (room_id, start_date, end_date);

alter table public.room_blocks
  drop constraint if exists room_blocks_no_active_overlap;

alter table public.room_blocks
  add constraint room_blocks_no_active_overlap
  exclude using gist (
    room_id with =,
    daterange(start_date, end_date, '[)') with &&
  ) where (status = 'active');

alter table public.room_blocks enable row level security;

drop policy if exists "Authenticated users can read room blocks" on public.room_blocks;
create policy "Authenticated users can read room blocks"
  on public.room_blocks for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create room blocks" on public.room_blocks;
create policy "Authenticated users can create room blocks"
  on public.room_blocks for insert
  to authenticated
  with check (auth.uid() = created_by or created_by is null);

drop policy if exists "Authenticated users can update room blocks" on public.room_blocks;
create policy "Authenticated users can update room blocks"
  on public.room_blocks for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete room blocks" on public.room_blocks;
create policy "Authenticated users can delete room blocks"
  on public.room_blocks for delete
  to authenticated
  using (true);

create table if not exists public.orchard_crop_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  crop_library_id uuid not null references public.orchard_crop_library(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,crop_library_id)
);

alter table public.orchard_crop_favorites enable row level security;

drop policy if exists orchard_crop_favorites_select_own on public.orchard_crop_favorites;
create policy orchard_crop_favorites_select_own on public.orchard_crop_favorites
for select using (auth.uid()=user_id);

drop policy if exists orchard_crop_favorites_insert_own on public.orchard_crop_favorites;
create policy orchard_crop_favorites_insert_own on public.orchard_crop_favorites
for insert with check (auth.uid()=user_id and public.can_access_orchard_global());

drop policy if exists orchard_crop_favorites_delete_own on public.orchard_crop_favorites;
create policy orchard_crop_favorites_delete_own on public.orchard_crop_favorites
for delete using (auth.uid()=user_id);

grant select,insert,delete on public.orchard_crop_favorites to authenticated;

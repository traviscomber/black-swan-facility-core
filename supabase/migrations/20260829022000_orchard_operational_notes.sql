create table if not exists public.orchard_notes (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid references public.orchard_crops(id) on delete cascade,
  crop_succession_id uuid references public.orchard_crop_successions(id) on delete cascade,
  plot_id uuid references public.orchard_plots(id) on delete cascade,
  bed_id uuid references public.orchard_beds(id) on delete cascade,
  note_type text not null default 'observation' check (note_type in ('observation','decision','lesson','risk','follow_up')),
  title text,
  body text not null,
  observed_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_notes_has_context check (crop_id is not null or crop_succession_id is not null or plot_id is not null or bed_id is not null)
);

create index if not exists orchard_notes_crop_idx on public.orchard_notes(crop_id);
create index if not exists orchard_notes_succession_idx on public.orchard_notes(crop_succession_id);
create index if not exists orchard_notes_observed_idx on public.orchard_notes(observed_at desc);

alter table public.orchard_notes enable row level security;
grant select, insert, update, delete on public.orchard_notes to authenticated;

drop policy if exists "Internal staff can manage orchard_notes" on public.orchard_notes;
create policy "Internal staff can manage orchard_notes" on public.orchard_notes for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin','approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin','approver']));
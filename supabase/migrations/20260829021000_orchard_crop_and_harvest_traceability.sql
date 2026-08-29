alter table public.orchard_crops
  add column if not exists crop_succession_id uuid references public.orchard_crop_successions(id) on delete set null;

create index if not exists orchard_crops_succession_idx on public.orchard_crops(crop_succession_id);

alter table public.orchard_harvest_records
  add column if not exists crop_succession_id uuid references public.orchard_crop_successions(id) on delete set null,
  add column if not exists bed_allocation_id uuid references public.orchard_bed_allocations(id) on delete set null,
  add column if not exists harvest_lot_code text,
  add column if not exists recorded_by uuid default auth.uid();

create index if not exists orchard_harvest_records_succession_idx on public.orchard_harvest_records(crop_succession_id);
create index if not exists orchard_harvest_records_bed_allocation_idx on public.orchard_harvest_records(bed_allocation_id);
create index if not exists orchard_harvest_records_lot_idx on public.orchard_harvest_records(harvest_lot_code);
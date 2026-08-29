alter table public.orchard_nursery_batches
  add column if not exists batch_code text,
  add column if not exists tray_count integer,
  add column if not exists cells_per_tray integer,
  add column if not exists loss_count integer not null default 0,
  add column if not exists loss_reason text,
  add column if not exists hardened_count integer,
  add column if not exists hardening_started_date date,
  add column if not exists hardening_completed_date date;

alter table public.orchard_nursery_batches
  drop constraint if exists orchard_nursery_batches_status_check,
  add constraint orchard_nursery_batches_status_check
    check (status in ('planned','sown','germinating','growing','hardening','ready','transplanted','completed','failed','cancelled')),
  add constraint orchard_nursery_batches_tray_count_check
    check (tray_count is null or tray_count >= 0),
  add constraint orchard_nursery_batches_cells_per_tray_check
    check (cells_per_tray is null or cells_per_tray > 0),
  add constraint orchard_nursery_batches_loss_count_check
    check (loss_count >= 0 and loss_count <= seeds_sown),
  add constraint orchard_nursery_batches_hardened_count_check
    check (hardened_count is null or (hardened_count >= 0 and (ready_count is null or hardened_count <= ready_count))),
  add constraint orchard_nursery_batches_hardening_dates_check
    check (hardening_completed_date is null or hardening_started_date is null or hardening_completed_date >= hardening_started_date);

create unique index if not exists orchard_nursery_batches_batch_code_uidx
  on public.orchard_nursery_batches (lower(batch_code))
  where batch_code is not null and btrim(batch_code) <> '';

create index if not exists orchard_nursery_batches_expected_ready_idx
  on public.orchard_nursery_batches (expected_ready_date, status);

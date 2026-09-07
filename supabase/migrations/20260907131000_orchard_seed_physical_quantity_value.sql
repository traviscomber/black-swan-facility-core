alter table public.orchard_seed_lots
  add column if not exists quantity_value numeric;

update public.orchard_seed_lots
set quantity_value = quantity_seeds
where quantity_value is null
  and count_status = 'counted'
  and (quantity_unit is null or quantity_unit = 'seeds');

comment on column public.orchard_seed_lots.quantity_value is
  'Physical stock quantity expressed in quantity_unit. Kept separate from quantity_seeds so non-seed units never contaminate nursery seed-count coverage.';

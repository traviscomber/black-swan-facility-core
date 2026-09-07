alter table public.orchard_seed_lots
  add column if not exists quantity_unit text,
  add column if not exists count_status text not null default 'counted';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orchard_seed_lots_count_status_check'
      and conrelid = 'public.orchard_seed_lots'::regclass
  ) then
    alter table public.orchard_seed_lots
      add constraint orchard_seed_lots_count_status_check
      check (count_status in ('counted', 'pending'));
  end if;
end $$;

update public.orchard_seed_lots
set count_status = 'pending'
where quantity_seeds = 0
  and notes ilike 'Physical stock presence confirmed by operator%';

comment on column public.orchard_seed_lots.quantity_unit is
  'Operator-recorded unit for the physical planting stock count. Null means not yet specified.';

comment on column public.orchard_seed_lots.count_status is
  'counted when quantity is physically counted; pending when physical stock exists but the count is not yet known.';

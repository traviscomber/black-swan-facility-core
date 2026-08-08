-- Stage 6: canonical location relationships without guessing legacy mappings.

alter table public.warehouses add column if not exists location_id uuid;
alter table public.procurement_requests add column if not exists location_id uuid;
alter table public.fuel_consumption add column if not exists location_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'warehouses_location_id_fkey' and conrelid = 'public.warehouses'::regclass) then
    alter table public.warehouses add constraint warehouses_location_id_fkey foreign key (location_id) references public.locations(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'procurement_requests_location_id_fkey' and conrelid = 'public.procurement_requests'::regclass) then
    alter table public.procurement_requests add constraint procurement_requests_location_id_fkey foreign key (location_id) references public.locations(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fuel_consumption_location_id_fkey' and conrelid = 'public.fuel_consumption'::regclass) then
    alter table public.fuel_consumption add constraint fuel_consumption_location_id_fkey foreign key (location_id) references public.locations(id) on delete restrict;
  end if;
end;
$$;

create index if not exists warehouses_location_id_idx on public.warehouses(location_id) where location_id is not null;
create index if not exists procurement_requests_location_id_idx on public.procurement_requests(location_id) where location_id is not null;
create index if not exists fuel_consumption_location_id_idx on public.fuel_consumption(location_id) where location_id is not null;

comment on column public.warehouses.location_id is 'Canonical operational location link. Legacy warehouse names are not auto-mapped.';
comment on column public.procurement_requests.location_id is 'Canonical operational location link. Legacy delivery_location text is retained until reconciled.';
comment on column public.fuel_consumption.location_id is 'Canonical operational location link. Legacy location text is retained until reconciled.';

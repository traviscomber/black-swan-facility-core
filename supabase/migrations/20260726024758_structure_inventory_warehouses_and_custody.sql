create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

alter table public.assets
  add column if not exists warehouse_location_id uuid references public.warehouse_locations(id) on delete set null,
  add column if not exists asset_class text not null default 'equipment';

alter table public.assets drop constraint if exists assets_asset_class_check;
alter table public.assets add constraint assets_asset_class_check
  check (asset_class in ('equipment', 'infrastructure', 'tool', 'vehicle', 'other'));

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  movement_type text not null check (movement_type in ('initial', 'receipt', 'transfer', 'assignment', 'return', 'retirement')),
  from_location_id uuid references public.warehouse_locations(id) on delete set null,
  to_location_id uuid references public.warehouse_locations(id) on delete set null,
  assigned_to text,
  notes text,
  moved_at timestamptz not null default now(),
  moved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_assets_warehouse_location_id on public.assets(warehouse_location_id);
create index if not exists idx_inventory_movements_asset_id on public.inventory_movements(asset_id);
create index if not exists idx_inventory_movements_moved_at on public.inventory_movements(moved_at desc);

alter table public.warehouses enable row level security;
alter table public.warehouse_locations enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "authenticated_manage_warehouses" on public.warehouses;
create policy "authenticated_manage_warehouses" on public.warehouses
for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_manage_warehouse_locations" on public.warehouse_locations;
create policy "authenticated_manage_warehouse_locations" on public.warehouse_locations
for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_manage_inventory_movements" on public.inventory_movements;
create policy "authenticated_manage_inventory_movements" on public.inventory_movements
for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

grant select, insert, update, delete on public.warehouses to authenticated;
grant select, insert, update, delete on public.warehouse_locations to authenticated;
grant select, insert, update, delete on public.inventory_movements to authenticated;

insert into public.warehouses (code, name, description)
values
  ('BC', 'Bodega Central', 'Resguardo general de herramientas, equipos móviles y repuestos.'),
  ('ST', 'Sala Técnica', 'Equipos fijos de redes, energía y servicios críticos.'),
  ('CP', 'Custodia Personal', 'Equipos entregados directamente a una persona responsable.')
on conflict (code) do update set name = excluded.name, description = excluded.description, is_active = true, updated_at = now();

insert into public.warehouse_locations (warehouse_id, code, name, description)
select w.id, v.code, v.name, v.description
from public.warehouses w
join (values
  ('BC', 'EQ-01', 'Equipos generales', 'Posición general para equipos móviles y herramientas.'),
  ('ST', 'RED-01', 'Rack de redes', 'Routers, switches y conectividad.'),
  ('ST', 'ENE-01', 'Sistemas de energía', 'Generación, paneles y respaldo eléctrico.'),
  ('ST', 'AGU-01', 'Sistemas de agua', 'Bombas, estanques y componentes hídricos.'),
  ('CP', 'ASG-01', 'Equipos asignados', 'Equipos bajo custodia personal directa.')
) as v(warehouse_code, code, name, description) on w.code = v.warehouse_code
on conflict (warehouse_id, code) do update set name = excluded.name, description = excluded.description, is_active = true, updated_at = now();

update public.assets a
set warehouse_location_id = wl.id,
    location = case
      when a.name = 'Network Router' then 'Sala Técnica · Rack de redes'
      when a.name in ('Solar Panel Array', 'Main Generator') then 'Sala Técnica · Sistemas de energía'
      when a.name in ('Well Pump #1', 'Water Storage Tank') then 'Sala Técnica · Sistemas de agua'
      when a.name = 'Computador1' then 'Custodia Personal · Equipos asignados'
      else a.location end,
    asset_class = case when a.name in ('Network Router', 'Solar Panel Array', 'Main Generator', 'Well Pump #1', 'Water Storage Tank') then 'infrastructure' else 'equipment' end,
    updated_at = now()
from public.warehouse_locations wl
join public.warehouses w on w.id = wl.warehouse_id
where (a.name = 'Network Router' and w.code = 'ST' and wl.code = 'RED-01')
   or (a.name in ('Solar Panel Array', 'Main Generator') and w.code = 'ST' and wl.code = 'ENE-01')
   or (a.name in ('Well Pump #1', 'Water Storage Tank') and w.code = 'ST' and wl.code = 'AGU-01')
   or (a.name = 'Computador1' and w.code = 'CP' and wl.code = 'ASG-01');

update public.assets a set category_id = c.id, cost_center_id = cc.id, updated_at = now()
from public.asset_categories c, public.cost_centers cc
where a.name = 'Network Router' and c.code = 'NET' and cc.code = 'IT';

update public.assets a set category_id = c.id, cost_center_id = cc.id, updated_at = now()
from public.asset_categories c, public.cost_centers cc
where a.name in ('Solar Panel Array', 'Main Generator', 'Well Pump #1', 'Water Storage Tank') and c.code = 'FAC' and cc.code = 'FA';

insert into public.inventory_movements (asset_id, movement_type, to_location_id, assigned_to, notes)
select a.id, 'initial', a.warehouse_location_id, a.assigned_to, 'Normalización inicial del inventario mock.'
from public.assets a
where a.warehouse_location_id is not null
  and not exists (select 1 from public.inventory_movements m where m.asset_id = a.id and m.movement_type = 'initial');
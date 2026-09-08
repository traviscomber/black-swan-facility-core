create table if not exists public.orchard_external_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orchard_external_memberships enable row level security;
grant select, insert, update, delete on public.orchard_external_memberships to authenticated;
grant all on public.orchard_external_memberships to service_role;

drop policy if exists orchard_external_memberships_select on public.orchard_external_memberships;
create policy orchard_external_memberships_select on public.orchard_external_memberships
for select to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin');

drop policy if exists orchard_external_memberships_admin_write on public.orchard_external_memberships;
create policy orchard_external_memberships_admin_write on public.orchard_external_memberships
for all to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create or replace function public.is_external_orchard_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.current_app_role() = 'operator'
    and exists (
      select 1 from public.orchard_external_memberships m
      where m.user_id = auth.uid() and m.is_active
    );
$$;

create or replace function public.can_access_external_orchard_location(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_external_orchard_user()
    and p_location_id is not null
    and exists (
      select 1 from public.orchard_external_memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.location_id = p_location_id
    );
$$;

create or replace function public.owns_external_orchard_game_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_external_orchard_user()
    and exists (
      select 1 from public.orchard_game_plans p
      where p.id = p_plan_id and p.created_by = auth.uid()
    );
$$;

create or replace function public.owns_external_orchard_cycle(p_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_external_orchard_user()
    and exists (
      select 1
      from public.orchard_crop_cycles c
      join public.orchard_game_plans p on p.id = c.game_plan_id
      where c.id = p_cycle_id and p.created_by = auth.uid()
    );
$$;

create or replace function public.owns_external_orchard_succession(p_succession_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_external_orchard_user()
    and exists (
      select 1
      from public.orchard_crop_successions s
      join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
      join public.orchard_game_plans p on p.id = c.game_plan_id
      where s.id = p_succession_id and p.created_by = auth.uid()
    );
$$;

create or replace function public.owns_external_orchard_seed_lot(p_seed_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_external_orchard_user()
    and exists (
      select 1 from public.orchard_seed_lots s
      where s.id = p_seed_lot_id and s.created_by = auth.uid()
    );
$$;

create or replace function public.owns_external_orchard_sales_channel(p_sales_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_external_orchard_user()
    and exists (
      select 1 from public.orchard_sales_channels s
      where s.id = p_sales_channel_id and s.created_by = auth.uid()
    );
$$;

create or replace function public.owns_external_orchard_demand_scenario(p_scenario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_external_orchard_user()
    and exists (
      select 1 from public.orchard_demand_scenarios d
      where d.id = p_scenario_id and d.created_by = auth.uid()
    );
$$;

create or replace function public.can_access_orchard_location(p_location_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_has_scopes boolean;
begin
  if coalesce(auth.role(), '') = 'service_role' then return true; end if;
  if v_user is null then return false; end if;
  if v_role = 'admin' then return true; end if;
  if v_role = 'operator' then
    return public.can_access_external_orchard_location(p_location_id);
  end if;
  if v_role <> 'approver' then return false; end if;
  select exists(select 1 from public.user_operational_scopes s where s.user_id = v_user and s.is_active) into v_has_scopes;
  if not v_has_scopes then return true; end if;
  return exists(
    select 1 from public.user_operational_scopes s
    where s.user_id = v_user
      and s.is_active
      and (s.department is null or lower(s.department) in ('*','all','huerto_vinedo','orchard'))
      and (s.location_id is null or (p_location_id is not null and s.location_id = p_location_id))
  );
end;
$$;

create or replace function public.can_access_orchard_succession(p_succession_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_external_orchard_user() then
    if not public.owns_external_orchard_succession(p_succession_id) then return false; end if;
    if not exists(select 1 from public.orchard_bed_allocations a where a.crop_succession_id = p_succession_id) then return true; end if;
    return not exists(
      select 1
      from public.orchard_bed_allocations a
      join public.orchard_beds b on b.id = a.bed_id
      join public.orchard_plots p on p.id = b.plot_id
      where a.crop_succession_id = p_succession_id
        and not public.can_access_external_orchard_location(p.location_id)
    );
  end if;
  if not public.can_access_orchard_global() then return false; end if;
  if not exists(select 1 from public.orchard_bed_allocations a where a.crop_succession_id = p_succession_id) then return true; end if;
  return exists(
    select 1 from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    where a.crop_succession_id = p_succession_id
      and public.can_access_orchard_location(p.location_id)
  );
end;
$$;

revoke all on function public.is_external_orchard_user() from public;
revoke all on function public.can_access_external_orchard_location(uuid) from public;
revoke all on function public.owns_external_orchard_game_plan(uuid) from public;
revoke all on function public.owns_external_orchard_cycle(uuid) from public;
revoke all on function public.owns_external_orchard_succession(uuid) from public;
revoke all on function public.owns_external_orchard_seed_lot(uuid) from public;
revoke all on function public.owns_external_orchard_sales_channel(uuid) from public;
revoke all on function public.owns_external_orchard_demand_scenario(uuid) from public;
grant execute on function public.is_external_orchard_user() to authenticated, service_role;
grant execute on function public.can_access_external_orchard_location(uuid) to authenticated, service_role;
grant execute on function public.owns_external_orchard_game_plan(uuid) to authenticated, service_role;
grant execute on function public.owns_external_orchard_cycle(uuid) to authenticated, service_role;
grant execute on function public.owns_external_orchard_succession(uuid) to authenticated, service_role;
grant execute on function public.owns_external_orchard_seed_lot(uuid) to authenticated, service_role;
grant execute on function public.owns_external_orchard_sales_channel(uuid) to authenticated, service_role;
grant execute on function public.owns_external_orchard_demand_scenario(uuid) to authenticated, service_role;

drop policy if exists locations_authenticated_select on public.locations;
create policy locations_authenticated_select on public.locations
for select to authenticated
using (
  public.current_app_role() in ('admin','approver')
  or public.can_access_external_orchard_location(id)
);

create policy orchard_game_plans_external_operator on public.orchard_game_plans
for all to authenticated
using (public.is_external_orchard_user() and created_by = auth.uid())
with check (public.is_external_orchard_user() and created_by = auth.uid());

create policy orchard_crop_cycles_external_operator on public.orchard_crop_cycles
for all to authenticated
using (public.is_external_orchard_user() and public.owns_external_orchard_game_plan(game_plan_id))
with check (public.is_external_orchard_user() and public.owns_external_orchard_game_plan(game_plan_id));

create policy orchard_crop_successions_external_operator on public.orchard_crop_successions
for all to authenticated
using (public.owns_external_orchard_succession(id))
with check (public.is_external_orchard_user() and public.owns_external_orchard_cycle(crop_cycle_id));

create policy orchard_crop_library_external_read on public.orchard_crop_library
for select to authenticated
using (public.is_external_orchard_user());

create policy orchard_cultivar_library_external_read on public.orchard_cultivar_library
for select to authenticated
using (public.is_external_orchard_user());

create policy orchard_direct_seeding_profiles_external_read on public.orchard_direct_seeding_profiles
for select to authenticated
using (public.is_external_orchard_user());

create policy orchard_crop_favorites_external_insert on public.orchard_crop_favorites
for insert to authenticated
with check (public.is_external_orchard_user() and user_id = auth.uid());

create policy orchard_chart_definitions_external_write on public.orchard_chart_definitions
for all to authenticated
using (public.is_external_orchard_user() and created_by = auth.uid())
with check (public.is_external_orchard_user() and created_by = auth.uid());

create policy orchard_dashboard_profiles_external_write on public.orchard_dashboard_profiles
for all to authenticated
using (public.is_external_orchard_user() and user_id = auth.uid())
with check (public.is_external_orchard_user() and user_id = auth.uid());

create policy orchard_demand_scenarios_external_operator on public.orchard_demand_scenarios
for all to authenticated
using (public.is_external_orchard_user() and created_by = auth.uid())
with check (public.is_external_orchard_user() and created_by = auth.uid());

create policy orchard_demand_crop_targets_external_operator on public.orchard_demand_crop_targets
for all to authenticated
using (public.is_external_orchard_user() and public.owns_external_orchard_demand_scenario(scenario_id))
with check (public.is_external_orchard_user() and public.owns_external_orchard_demand_scenario(scenario_id));

create policy orchard_seed_lots_external_operator on public.orchard_seed_lots
for all to authenticated
using (public.is_external_orchard_user() and created_by = auth.uid())
with check (public.is_external_orchard_user() and created_by = auth.uid());

create policy orchard_seed_inventory_movements_external_select on public.orchard_seed_inventory_movements
for select to authenticated
using (public.is_external_orchard_user() and public.owns_external_orchard_seed_lot(seed_lot_id));

create policy orchard_seed_inventory_movements_external_insert on public.orchard_seed_inventory_movements
for insert to authenticated
with check (public.is_external_orchard_user() and created_by = auth.uid() and public.owns_external_orchard_seed_lot(seed_lot_id));

create policy orchard_sales_channels_external_operator on public.orchard_sales_channels
for all to authenticated
using (public.is_external_orchard_user() and created_by = auth.uid())
with check (public.is_external_orchard_user() and created_by = auth.uid());

create policy orchard_sales_commitments_external_operator on public.orchard_sales_commitments
for all to authenticated
using (
  public.is_external_orchard_user()
  and created_by = auth.uid()
  and public.owns_external_orchard_sales_channel(sales_channel_id)
  and (crop_succession_id is null or public.owns_external_orchard_succession(crop_succession_id))
)
with check (
  public.is_external_orchard_user()
  and created_by = auth.uid()
  and public.owns_external_orchard_sales_channel(sales_channel_id)
  and (crop_succession_id is null or public.owns_external_orchard_succession(crop_succession_id))
);

alter table public.orchard_farm_settings
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;
create index if not exists orchard_farm_settings_owner_user_id_idx on public.orchard_farm_settings(owner_user_id) where owner_user_id is not null;
create policy orchard_farm_settings_external_operator on public.orchard_farm_settings
for all to authenticated
using (public.is_external_orchard_user() and owner_user_id = auth.uid())
with check (public.is_external_orchard_user() and owner_user_id = auth.uid());

create policy tasks_external_orchard_operator on public.tasks
for all to authenticated
using (
  public.is_external_orchard_user()
  and lower(coalesce(operational_area,'')) in ('orchard','huerto_vinedo')
  and source_id is not null
  and public.owns_external_orchard_succession(source_id)
  and (location_id is null or public.can_access_external_orchard_location(location_id))
)
with check (
  public.is_external_orchard_user()
  and lower(coalesce(operational_area,'')) in ('orchard','huerto_vinedo')
  and source_id is not null
  and public.owns_external_orchard_succession(source_id)
  and (location_id is null or public.can_access_external_orchard_location(location_id))
);

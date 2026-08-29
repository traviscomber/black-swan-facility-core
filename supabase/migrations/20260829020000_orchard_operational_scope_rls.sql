-- Orchard authorization hardening.
-- Replaces legacy procurement_role JWT checks with the canonical BSFC access profile + operational scope model.
-- Existing unscoped active admin/approver users retain the same Orchard access.

create or replace function public.can_access_orchard_global()
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
  if v_role <> 'approver' then return false; end if;

  select exists(
    select 1 from public.user_operational_scopes s
    where s.user_id = v_user and s.is_active
  ) into v_has_scopes;

  if not v_has_scopes then return true; end if;

  return exists(
    select 1
    from public.user_operational_scopes s
    where s.user_id = v_user
      and s.is_active
      and (
        s.department is null
        or lower(s.department) in ('*', 'all', 'huerto_vinedo', 'orchard')
      )
  );
end;
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
  if v_role <> 'approver' then return false; end if;

  select exists(
    select 1 from public.user_operational_scopes s
    where s.user_id = v_user and s.is_active
  ) into v_has_scopes;

  if not v_has_scopes then return true; end if;

  return exists(
    select 1
    from public.user_operational_scopes s
    where s.user_id = v_user
      and s.is_active
      and (
        s.department is null
        or lower(s.department) in ('*', 'all', 'huerto_vinedo', 'orchard')
      )
      and (
        s.location_id is null
        or (p_location_id is not null and s.location_id = p_location_id)
      )
  );
end;
$$;

create or replace function public.can_access_orchard_plot(p_plot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.orchard_plots p
    where p.id = p_plot_id
      and public.can_access_orchard_location(p.location_id)
  );
$$;

create or replace function public.can_access_orchard_bed(p_bed_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.orchard_beds b
    join public.orchard_plots p on p.id = b.plot_id
    where b.id = p_bed_id
      and public.can_access_orchard_location(p.location_id)
  );
$$;

create or replace function public.can_access_orchard_allocation(p_allocation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    where a.id = p_allocation_id
      and public.can_access_orchard_location(p.location_id)
  );
$$;

create or replace function public.can_access_orchard_crop(p_crop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.orchard_crops c
    join public.orchard_plots p on p.id = c.plot_id
    where c.id = p_crop_id
      and public.can_access_orchard_location(p.location_id)
  );
$$;

create or replace function public.can_access_orchard_succession(p_succession_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_access_orchard_global() then return false; end if;

  if not exists(
    select 1 from public.orchard_bed_allocations a
    where a.crop_succession_id = p_succession_id
  ) then
    return true;
  end if;

  return exists(
    select 1
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    where a.crop_succession_id = p_succession_id
      and public.can_access_orchard_location(p.location_id)
  );
end;
$$;

create or replace function public.can_access_orchard_note(
  p_crop_id uuid,
  p_succession_id uuid,
  p_plot_id uuid,
  p_bed_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_crop_id is not null then return public.can_access_orchard_crop(p_crop_id); end if;
  if p_plot_id is not null then return public.can_access_orchard_plot(p_plot_id); end if;
  if p_bed_id is not null then return public.can_access_orchard_bed(p_bed_id); end if;
  if p_succession_id is not null then return public.can_access_orchard_succession(p_succession_id); end if;
  return public.can_access_orchard_global();
end;
$$;

create or replace function public.can_access_orchard_harvest(p_crop_id uuid, p_allocation_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_access_orchard_crop(p_crop_id) then return false; end if;
  if p_allocation_id is null then return true; end if;
  return public.can_access_orchard_allocation(p_allocation_id);
end;
$$;

-- Global planning/inventory entities.
drop policy if exists "Internal staff can manage orchard_game_plans" on public.orchard_game_plans;
create policy orchard_game_plans_scoped on public.orchard_game_plans for all to authenticated
  using (public.can_access_orchard_global())
  with check (public.can_access_orchard_global());

drop policy if exists "Internal staff can manage orchard_crop_cycles" on public.orchard_crop_cycles;
create policy orchard_crop_cycles_scoped on public.orchard_crop_cycles for all to authenticated
  using (public.can_access_orchard_global())
  with check (public.can_access_orchard_global());

drop policy if exists "Internal staff can manage orchard_crop_successions" on public.orchard_crop_successions;
create policy orchard_crop_successions_scoped on public.orchard_crop_successions for all to authenticated
  using (public.can_access_orchard_succession(id))
  with check (public.can_access_orchard_global());

drop policy if exists "Internal staff can manage orchard_seed_lots" on public.orchard_seed_lots;
create policy orchard_seed_lots_scoped on public.orchard_seed_lots for all to authenticated
  using (public.can_access_orchard_global())
  with check (public.can_access_orchard_global());

drop policy if exists "Internal staff can view orchard seed movements" on public.orchard_seed_inventory_movements;
drop policy if exists "Internal staff can add orchard seed movements" on public.orchard_seed_inventory_movements;
create policy orchard_seed_inventory_movements_select_scoped on public.orchard_seed_inventory_movements for select to authenticated
  using (public.can_access_orchard_global());
create policy orchard_seed_inventory_movements_insert_scoped on public.orchard_seed_inventory_movements for insert to authenticated
  with check (public.can_access_orchard_global());

-- Location-bearing spatial records.
drop policy if exists "Internal staff can manage orchard_plots" on public.orchard_plots;
create policy orchard_plots_scoped on public.orchard_plots for all to authenticated
  using (public.can_access_orchard_location(location_id))
  with check (public.can_access_orchard_location(location_id));

drop policy if exists "Internal staff can manage orchard_beds" on public.orchard_beds;
create policy orchard_beds_scoped on public.orchard_beds for all to authenticated
  using (public.can_access_orchard_plot(plot_id))
  with check (public.can_access_orchard_plot(plot_id));

drop policy if exists "Internal staff can manage orchard_bed_allocations" on public.orchard_bed_allocations;
create policy orchard_bed_allocations_scoped on public.orchard_bed_allocations for all to authenticated
  using (public.can_access_orchard_bed(bed_id))
  with check (public.can_access_orchard_bed(bed_id) and public.can_access_orchard_succession(crop_succession_id));

drop policy if exists "Internal staff can manage orchard_crops" on public.orchard_crops;
create policy orchard_crops_scoped on public.orchard_crops for all to authenticated
  using (public.can_access_orchard_plot(plot_id))
  with check (public.can_access_orchard_plot(plot_id) and (crop_succession_id is null or public.can_access_orchard_succession(crop_succession_id)));

drop policy if exists "Internal staff can manage orchard_equipment" on public.orchard_equipment;
create policy orchard_equipment_scoped on public.orchard_equipment for all to authenticated
  using (public.can_access_orchard_location(location_id))
  with check (public.can_access_orchard_location(location_id));

drop policy if exists "Internal staff can manage orchard_soil_amendments" on public.orchard_soil_amendments;
create policy orchard_soil_amendments_scoped on public.orchard_soil_amendments for all to authenticated
  using (public.can_access_orchard_plot(plot_id))
  with check (public.can_access_orchard_plot(plot_id));

-- Crop-linked operational evidence.
drop policy if exists "Internal staff can manage orchard_care_logs" on public.orchard_care_logs;
create policy orchard_care_logs_scoped on public.orchard_care_logs for all to authenticated
  using (public.can_access_orchard_crop(crop_id))
  with check (public.can_access_orchard_crop(crop_id));

drop policy if exists "Internal staff can manage orchard_pest_logs" on public.orchard_pest_logs;
create policy orchard_pest_logs_scoped on public.orchard_pest_logs for all to authenticated
  using (public.can_access_orchard_crop(crop_id))
  with check (public.can_access_orchard_crop(crop_id));

drop policy if exists "Internal staff can manage orchard_harvest_records" on public.orchard_harvest_records;
create policy orchard_harvest_records_scoped on public.orchard_harvest_records for all to authenticated
  using (public.can_access_orchard_harvest(crop_id, bed_allocation_id))
  with check (
    public.can_access_orchard_harvest(crop_id, bed_allocation_id)
    and (crop_succession_id is null or public.can_access_orchard_succession(crop_succession_id))
  );

drop policy if exists "Internal staff can manage orchard_yield_analytics" on public.orchard_yield_analytics;
create policy orchard_yield_analytics_scoped on public.orchard_yield_analytics for all to authenticated
  using (public.can_access_orchard_crop(crop_id))
  with check (public.can_access_orchard_crop(crop_id));

-- Succession-linked nursery and lifecycle evidence.
drop policy if exists "Internal staff can manage orchard_nursery_batches" on public.orchard_nursery_batches;
create policy orchard_nursery_batches_scoped on public.orchard_nursery_batches for all to authenticated
  using (public.can_access_orchard_succession(crop_succession_id))
  with check (public.can_access_orchard_succession(crop_succession_id));

drop policy if exists orchard_succession_lifecycle_history_select on public.orchard_succession_lifecycle_history;
create policy orchard_succession_lifecycle_history_select_scoped on public.orchard_succession_lifecycle_history for select to authenticated
  using (public.can_access_orchard_succession(crop_succession_id));

-- Context-aware notes.
drop policy if exists "Internal staff can manage orchard_notes" on public.orchard_notes;
create policy orchard_notes_scoped on public.orchard_notes for all to authenticated
  using (public.can_access_orchard_note(crop_id, crop_succession_id, plot_id, bed_id))
  with check (public.can_access_orchard_note(crop_id, crop_succession_id, plot_id, bed_id));

-- Keep grants explicit for helper use inside RLS while preventing anonymous use.
revoke all on function public.can_access_orchard_global() from public, anon;
revoke all on function public.can_access_orchard_location(uuid) from public, anon;
revoke all on function public.can_access_orchard_plot(uuid) from public, anon;
revoke all on function public.can_access_orchard_bed(uuid) from public, anon;
revoke all on function public.can_access_orchard_allocation(uuid) from public, anon;
revoke all on function public.can_access_orchard_crop(uuid) from public, anon;
revoke all on function public.can_access_orchard_succession(uuid) from public, anon;
revoke all on function public.can_access_orchard_note(uuid,uuid,uuid,uuid) from public, anon;
revoke all on function public.can_access_orchard_harvest(uuid,uuid) from public, anon;
grant execute on function public.can_access_orchard_global() to authenticated, service_role;
grant execute on function public.can_access_orchard_location(uuid) to authenticated, service_role;
grant execute on function public.can_access_orchard_plot(uuid) to authenticated, service_role;
grant execute on function public.can_access_orchard_bed(uuid) to authenticated, service_role;
grant execute on function public.can_access_orchard_allocation(uuid) to authenticated, service_role;
grant execute on function public.can_access_orchard_crop(uuid) to authenticated, service_role;
grant execute on function public.can_access_orchard_succession(uuid) to authenticated, service_role;
grant execute on function public.can_access_orchard_note(uuid,uuid,uuid,uuid) to authenticated, service_role;
grant execute on function public.can_access_orchard_harvest(uuid,uuid) to authenticated, service_role;

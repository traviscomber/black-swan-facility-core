-- Transactional Crop Map placement primitive for Heirloom-style bed-meter planning.

create or replace function public.orchard_place_succession_bed_meters(
  p_succession_id uuid,
  p_plot_id uuid,
  p_start_bed_id uuid,
  p_start_date date,
  p_end_date date,
  p_required_bed_m numeric default null
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_required numeric;
  v_remaining numeric;
  v_start_order integer;
  v_bed record;
  v_peak_used numeric;
  v_available numeric;
  v_allocate numeric;
  v_allocation_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_beds_used integer := 0;
begin
  if not public.can_access_orchard_succession(p_succession_id) then
    raise exception 'Not authorized for succession';
  end if;
  if not public.can_access_orchard_plot(p_plot_id) then
    raise exception 'Not authorized for plot';
  end if;
  if not public.can_access_orchard_bed(p_start_bed_id) then
    raise exception 'Not authorized for starting bed';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'A valid allocation date range is required';
  end if;

  select coalesce(p_required_bed_m, s.planned_bed_m)
    into v_required
  from public.orchard_crop_successions s
  where s.id = p_succession_id;
  if v_required is null or v_required <= 0 then
    raise exception 'A positive canonical bed-meter requirement is required';
  end if;

  if exists (
    select 1 from public.orchard_bed_allocations
    where crop_succession_id = p_succession_id
  ) then
    raise exception 'Planting already has a bed allocation; remove or edit the existing placement first';
  end if;

  select b.planning_order
    into v_start_order
  from public.orchard_beds b
  where b.id = p_start_bed_id
    and b.plot_id = p_plot_id
    and b.status = 'active';
  if v_start_order is null then
    raise exception 'Starting bed must be an active bed in the selected field block';
  end if;

  v_remaining := v_required;

  for v_bed in
    select b.id, b.length_m, b.width_m, b.planning_order
    from public.orchard_beds b
    where b.plot_id = p_plot_id
      and b.status = 'active'
      and b.planning_order >= v_start_order
    order by b.planning_order, b.name, b.id
    for update
  loop
    if v_bed.length_m is null or v_bed.length_m <= 0 then
      raise exception 'Bed % has no positive physical length', v_bed.id;
    end if;

    select coalesce(max(day_usage.used_m), 0)
      into v_peak_used
    from (
      select d::date as day_key, coalesce(sum(a.allocated_length_m),0) as used_m
      from generate_series(
        p_start_date::timestamp,
        p_end_date::timestamp,
        interval '1 day'
      ) d
      left join public.orchard_bed_allocations a
        on a.bed_id = v_bed.id
       and d::date between a.planned_start_date and a.planned_end_date
      group by d
    ) day_usage;

    v_available := greatest(v_bed.length_m - v_peak_used, 0);
    if v_available <= 0 then
      raise exception 'Contiguous placement is blocked at bed order %', v_bed.planning_order;
    end if;

    v_allocate := least(v_available, v_remaining);
    insert into public.orchard_bed_allocations (
      bed_id,
      crop_succession_id,
      planned_start_date,
      planned_end_date,
      allocated_length_m,
      allocated_area_sqm,
      notes
    ) values (
      v_bed.id,
      p_succession_id,
      p_start_date,
      p_end_date,
      v_allocate,
      case when v_bed.width_m is not null and v_bed.width_m > 0 then v_allocate * v_bed.width_m else null end,
      'Heirloom-style contiguous bed-meter placement'
    ) returning id into v_allocation_id;

    v_ids := array_append(v_ids, v_allocation_id);
    v_beds_used := v_beds_used + 1;
    v_remaining := v_remaining - v_allocate;
    exit when v_remaining <= 0.0001;
  end loop;

  if v_remaining > 0.0001 then
    raise exception 'Insufficient contiguous bed-meter capacity from selected starting bed: % m still required', v_remaining;
  end if;

  return jsonb_build_object(
    'allocation_ids', to_jsonb(v_ids),
    'allocated_bed_m', v_required,
    'beds_used', v_beds_used,
    'start_bed_id', p_start_bed_id,
    'planned_start_date', p_start_date,
    'planned_end_date', p_end_date
  );
end;
$$;

revoke all on function public.orchard_place_succession_bed_meters(uuid, uuid, uuid, date, date, numeric) from public;
grant execute on function public.orchard_place_succession_bed_meters(uuid, uuid, uuid, date, date, numeric) to authenticated, service_role;

comment on function public.orchard_place_succession_bed_meters(uuid, uuid, uuid, date, date, numeric) is
  'Places one planting transactionally across consecutive active beds using cumulative bed-meter capacity for its full date range.';

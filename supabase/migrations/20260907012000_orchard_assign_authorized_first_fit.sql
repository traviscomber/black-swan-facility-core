-- Assign the 32 remaining reconciled 2026/27 Orchard plantings after explicit operator authorization.
--
-- Deterministic placement policy authorized 2026-09-07:
--   1. Preserve every existing physical allocation exactly as-is.
--   2. Process only currently unassigned, non-cancelled successions with positive canonical planned_bed_m.
--   3. Sort chronologically by canonical planting start (transplant date when present, otherwise sow date),
--      then end date, crop name, succession number and id for deterministic ties.
--   4. First-fit block order: Current 01 -> Current 05, then Expansion 01 -> Expansion 03.
--   5. Within a block, choose the first active starting bed that provides sufficient contiguous
--      bed-metre capacity across the canonical allocation date range.
--   6. Capacity semantics mirror orchard_place_succession_bed_meters: daily peak occupancy is
--      subtracted from each 10 m bed and placement continues only through consecutive beds with
--      positive free capacity.
--
-- This is a guarded one-time data migration. It does not alter crop dates, planned bed metres,
-- statuses, existing allocation rows, Farm Area geometry, RLS, or authorization functions.

begin;

do $$
declare
  v_plan_id uuid;
  v_plan_count integer;
  v_total integer;
  v_assigned integer;
  v_unassigned integer;
  v_alloc_rows integer;
  v_alloc_m numeric;
  v_unassigned_m numeric;
  v_planned_m numeric;
  v_block_count integer;
  v_bed_count integer;
  v_capacity_m numeric;
  v_batch_rows integer;
  v_batch_successions integer;
  v_batch_m numeric;
  v_added_successions integer := 0;
  r_s record;
  r_p record;
  r_sb record;
  r_b record;
  v_block text;
  v_required numeric;
  v_remaining numeric;
  v_peak numeric;
  v_free numeric;
  v_capacity numeric;
  v_allocate numeric;
  v_placed boolean;
  v_blocks text[] := array[
    'Current 01','Current 02','Current 03','Current 04','Current 05',
    'Expansion 01','Expansion 02','Expansion 03'
  ];
  v_batch_note text := 'Operator-authorized deterministic first-fit placement 2026-09-07; chronological by canonical planting start; block order Current 01-05 then Expansion 01-03; existing allocations preserved.';
begin
  select count(*) into v_plan_count
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  if v_plan_count <> 1 then
    raise exception 'Expected one canonical 2026/27 plan, found %', v_plan_count;
  end if;

  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  with ps as (
    select cs.id, cs.planned_bed_m
    from public.orchard_crop_successions cs
    join public.orchard_crop_cycles c on c.id = cs.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and cs.status <> 'cancelled'
  ), pa as (
    select a.*
    from public.orchard_bed_allocations a
    join ps on ps.id = a.crop_succession_id
  )
  select
    (select count(*) from ps),
    (select count(distinct crop_succession_id) from pa),
    (select count(*) from ps where not exists (select 1 from pa where pa.crop_succession_id = ps.id)),
    (select count(*) from pa),
    (select coalesce(sum(allocated_length_m), 0) from pa),
    (select coalesce(sum(planned_bed_m), 0) from ps where not exists (select 1 from pa where pa.crop_succession_id = ps.id)),
    (select coalesce(sum(planned_bed_m), 0) from ps)
  into v_total, v_assigned, v_unassigned, v_alloc_rows, v_alloc_m, v_unassigned_m, v_planned_m;

  if v_total <> 66
     or v_assigned <> 34
     or v_unassigned <> 32
     or v_alloc_rows <> 98
     or v_alloc_m <> 261
     or v_unassigned_m <> 180
     or v_planned_m <> 441 then
    raise exception 'Prestate guard failed total %, assigned %, unassigned %, rows %, alloc_m %, unassigned_m %, planned_m %',
      v_total, v_assigned, v_unassigned, v_alloc_rows, v_alloc_m, v_unassigned_m, v_planned_m;
  end if;

  select count(*) into v_block_count
  from public.orchard_plots
  where status = 'active'
    and name = any(v_blocks);

  select count(*), coalesce(sum(b.length_m), 0)
  into v_bed_count, v_capacity_m
  from public.orchard_beds b
  join public.orchard_plots p on p.id = b.plot_id
  where p.status = 'active'
    and p.name = any(v_blocks)
    and b.status = 'active';

  if v_block_count <> 8 or v_bed_count <> 80 or v_capacity_m <> 800 then
    raise exception 'Canonical block/bed guard failed blocks %, beds %, capacity %',
      v_block_count, v_bed_count, v_capacity_m;
  end if;

  if exists (
    select 1
    from public.orchard_bed_allocations a
    join public.orchard_crop_successions cs on cs.id = a.crop_succession_id
    join public.orchard_crop_cycles c on c.id = cs.crop_cycle_id
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    where c.game_plan_id = v_plan_id
      and not (p.name = any(v_blocks))
  ) then
    raise exception 'Existing plan allocation outside canonical eight blocks';
  end if;

  for r_s in
    select
      cs.id,
      c.crop_name,
      cs.sequence_no,
      cs.planned_bed_m,
      coalesce(cs.planned_transplant_date, cs.planned_sow_date) as start_date,
      coalesce(
        cs.planned_last_harvest_date,
        cs.planned_first_harvest_date,
        cs.planned_transplant_date,
        cs.planned_sow_date
      ) as end_date
    from public.orchard_crop_successions cs
    join public.orchard_crop_cycles c on c.id = cs.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and cs.status <> 'cancelled'
      and cs.planned_bed_m > 0
      and not exists (
        select 1
        from public.orchard_bed_allocations a
        where a.crop_succession_id = cs.id
      )
    order by
      coalesce(cs.planned_transplant_date, cs.planned_sow_date),
      coalesce(
        cs.planned_last_harvest_date,
        cs.planned_first_harvest_date,
        cs.planned_transplant_date,
        cs.planned_sow_date
      ),
      c.crop_name,
      cs.sequence_no,
      cs.id
  loop
    v_required := r_s.planned_bed_m;
    v_placed := false;

    foreach v_block in array v_blocks loop
      select id, name into r_p
      from public.orchard_plots
      where name = v_block
        and status = 'active'
      limit 1;

      for r_sb in
        select id, code, planning_order
        from public.orchard_beds
        where plot_id = r_p.id
          and status = 'active'
        order by planning_order, name, id
      loop
        v_capacity := 0;

        for r_b in
          select id, code, planning_order, length_m, width_m
          from public.orchard_beds
          where plot_id = r_p.id
            and status = 'active'
            and planning_order >= r_sb.planning_order
          order by planning_order, name, id
        loop
          select coalesce(max(x.used_m), 0)
          into v_peak
          from (
            select d::date as day_key, coalesce(sum(a.allocated_length_m), 0) as used_m
            from generate_series(r_s.start_date::timestamp, r_s.end_date::timestamp, interval '1 day') d
            left join public.orchard_bed_allocations a
              on a.bed_id = r_b.id
             and d::date between a.planned_start_date and a.planned_end_date
            group by d
          ) x;

          v_free := greatest(r_b.length_m - v_peak, 0);
          if v_free <= 0.0001 then
            exit;
          end if;

          v_capacity := v_capacity + v_free;
          exit when v_capacity + 0.0001 >= v_required;
        end loop;

        if v_capacity + 0.0001 >= v_required then
          v_remaining := v_required;

          for r_b in
            select id, code, planning_order, length_m, width_m
            from public.orchard_beds
            where plot_id = r_p.id
              and status = 'active'
              and planning_order >= r_sb.planning_order
            order by planning_order, name, id
          loop
            select coalesce(max(x.used_m), 0)
            into v_peak
            from (
              select d::date as day_key, coalesce(sum(a.allocated_length_m), 0) as used_m
              from generate_series(r_s.start_date::timestamp, r_s.end_date::timestamp, interval '1 day') d
              left join public.orchard_bed_allocations a
                on a.bed_id = r_b.id
               and d::date between a.planned_start_date and a.planned_end_date
              group by d
            ) x;

            v_free := greatest(r_b.length_m - v_peak, 0);
            if v_free <= 0.0001 then
              exit;
            end if;

            v_allocate := least(v_free, v_remaining);

            insert into public.orchard_bed_allocations (
              bed_id,
              crop_succession_id,
              planned_start_date,
              planned_end_date,
              allocated_length_m,
              allocated_area_sqm,
              notes
            ) values (
              r_b.id,
              r_s.id,
              r_s.start_date,
              r_s.end_date,
              v_allocate,
              case when r_b.width_m > 0 then v_allocate * r_b.width_m else null end,
              v_batch_note
            );

            v_remaining := v_remaining - v_allocate;
            exit when v_remaining <= 0.0001;
          end loop;

          if v_remaining > 0.0001 then
            raise exception 'Internal placement mismatch for %', r_s.id;
          end if;

          v_placed := true;
          v_added_successions := v_added_successions + 1;
          exit;
        end if;
      end loop;

      exit when v_placed;
    end loop;

    if not v_placed then
      raise exception 'No first-fit capacity for % #% (% m, % to %)',
        r_s.crop_name, r_s.sequence_no, v_required, r_s.start_date, r_s.end_date;
    end if;
  end loop;

  if v_added_successions <> 32 then
    raise exception 'Expected to add 32 successions, added %', v_added_successions;
  end if;

  with ps as (
    select cs.id, cs.planned_bed_m
    from public.orchard_crop_successions cs
    join public.orchard_crop_cycles c on c.id = cs.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and cs.status <> 'cancelled'
  ), pa as (
    select a.*
    from public.orchard_bed_allocations a
    join ps on ps.id = a.crop_succession_id
  )
  select
    (select count(distinct crop_succession_id) from pa),
    (select count(*) from ps where not exists (select 1 from pa where pa.crop_succession_id = ps.id)),
    (select count(*) from pa),
    (select coalesce(sum(allocated_length_m), 0) from pa)
  into v_assigned, v_unassigned, v_alloc_rows, v_alloc_m;

  select count(*), count(distinct crop_succession_id), coalesce(sum(allocated_length_m), 0)
  into v_batch_rows, v_batch_successions, v_batch_m
  from public.orchard_bed_allocations
  where notes = v_batch_note;

  if v_assigned <> 66
     or v_unassigned <> 0
     or v_alloc_rows <> 154
     or v_alloc_m <> 441
     or v_batch_rows <> 56
     or v_batch_successions <> 32
     or v_batch_m <> 180 then
    raise exception 'Poststate guard failed assigned %, unassigned %, rows %, alloc_m %, batch_rows %, batch_successions %, batch_m %',
      v_assigned, v_unassigned, v_alloc_rows, v_alloc_m, v_batch_rows, v_batch_successions, v_batch_m;
  end if;
end $$;

commit;

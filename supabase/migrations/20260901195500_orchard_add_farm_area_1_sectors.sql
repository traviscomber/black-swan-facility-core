-- Add two additional logical cultivation sectors inside the authenticated Heirloom
-- Farm Area 1 reference polygon. Core does not yet store per-plot polygon geometry,
-- so containment is recorded as explicit provenance rather than invented coordinates.
-- Each sector provides four 30 m beds so the two remaining 120 bed-m potato
-- plantings can be assigned without changing canonical Core dates.

begin;

do $$
declare
  v_plan_id uuid;
  v_plan_count integer;
  v_reconciled integer;
  v_assigned integer;
  v_pending integer;
  v_pending_bed_m numeric;
  v_peak numeric;
begin
  select count(*) into v_plan_count
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27' and season = '2026/27';
  if v_plan_count <> 1 then
    raise exception 'Expected one canonical 2026/27 Orchard Game Plan, found %', v_plan_count;
  end if;

  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27' and season = '2026/27';

  select count(*) into v_reconciled
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id
    and s.planned_bed_m is not null
    and s.status <> 'cancelled';
  if v_reconciled <> 32 then
    raise exception 'Expected 32 reconciled plantings, found %', v_reconciled;
  end if;

  select count(distinct s.id) into v_assigned
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  join public.orchard_bed_allocations a on a.crop_succession_id = s.id
  where c.game_plan_id = v_plan_id
    and s.planned_bed_m is not null;

  select count(*), coalesce(sum(s.planned_bed_m),0)
    into v_pending, v_pending_bed_m
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id
    and s.planned_bed_m is not null
    and not exists (
      select 1 from public.orchard_bed_allocations a
      where a.crop_succession_id = s.id
    );

  if v_assigned <> 30 or v_pending <> 2 or v_pending_bed_m <> 240 then
    raise exception 'Expected 30 assigned / 2 pending / 240 pending bed-m, found % / % / %', v_assigned, v_pending, v_pending_bed_m;
  end if;

  if exists (
    select 1
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.planned_bed_m is not null
      and not exists (
        select 1 from public.orchard_bed_allocations a
        where a.crop_succession_id = s.id
      )
      and c.crop_name not in ('Storage Potatoes','New Potatoes')
  ) then
    raise exception 'Pending set is not exactly the two potato plantings';
  end if;

  with plan_rows as (
    select
      s.planned_bed_m,
      coalesce(s.planned_transplant_date,s.planned_sow_date) as start_date,
      coalesce(s.planned_last_harvest_date,s.planned_first_harvest_date,s.planned_transplant_date,s.planned_sow_date) as end_date
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.planned_bed_m is not null
  ), daily as (
    select d::date as day, sum(p.planned_bed_m) as used_m
    from plan_rows p
    cross join lateral generate_series(p.start_date::timestamp,p.end_date::timestamp,interval '1 day') d
    group by d::date
  )
  select coalesce(max(used_m),0) into v_peak from daily;

  if v_peak <> 702 then
    raise exception 'Expected canonical plan peak of 702 bed-m before adding sectors, found %', v_peak;
  end if;
end $$;

insert into public.orchard_plots (
  name, description, plot_type, size_sqm, status, notes
)
select
  x.name,
  'Additional canonical cultivation sector for Fundo Corcovado Crop Plan 2026/27.',
  'vegetable_garden',
  null,
  'active',
  'Farm Area 1 provenance: this logical sector belongs inside the authenticated Heirloom reference polygon. Core does not yet store per-plot GIS geometry, so no coordinates are fabricated. Physical definition: 4 beds x 30 m x 0.76 m.'
from (values
  ('Orchard BlackSwan Campo — Sector 2'),
  ('Orchard BlackSwan Campo — Sector 3')
) as x(name)
where not exists (
  select 1 from public.orchard_plots p where p.name = x.name
);

do $$
declare
  v_name text;
  v_count integer;
begin
  foreach v_name in array array['Orchard BlackSwan Campo — Sector 2','Orchard BlackSwan Campo — Sector 3'] loop
    select count(*) into v_count from public.orchard_plots where name = v_name and status = 'active';
    if v_count <> 1 then
      raise exception 'Expected exactly one active plot named %, found %', v_name, v_count;
    end if;
  end loop;
end $$;

insert into public.orchard_beds (
  plot_id, name, length_m, width_m, status, planning_order, notes
)
select
  p.id,
  gs::text,
  30,
  0.76,
  'active',
  gs,
  'Farm Area 1 expansion bed; physical bed definition 30 m x 0.76 m.'
from public.orchard_plots p
cross join generate_series(1,4) gs
where p.name in ('Orchard BlackSwan Campo — Sector 2','Orchard BlackSwan Campo — Sector 3')
  and not exists (
    select 1 from public.orchard_beds b
    where b.plot_id = p.id and b.name = gs::text
  );

do $$
declare
  v_name text;
  v_beds integer;
  v_capacity numeric;
begin
  foreach v_name in array array['Orchard BlackSwan Campo — Sector 2','Orchard BlackSwan Campo — Sector 3'] loop
    select count(*), coalesce(sum(b.length_m),0)
      into v_beds, v_capacity
    from public.orchard_beds b
    join public.orchard_plots p on p.id = b.plot_id
    where p.name = v_name and b.status = 'active';
    if v_beds <> 4 or v_capacity <> 120 then
      raise exception 'Sector % expected 4 beds / 120 bed-m, found % / %', v_name, v_beds, v_capacity;
    end if;
  end loop;
end $$;

-- Storage Potatoes -> Sector 2, four full beds.
insert into public.orchard_bed_allocations (
  bed_id, crop_succession_id, planned_start_date, planned_end_date,
  allocated_length_m, allocated_area_sqm, notes
)
select
  b.id,
  s.id,
  coalesce(s.planned_transplant_date,s.planned_sow_date),
  coalesce(s.planned_last_harvest_date,s.planned_first_harvest_date,s.planned_transplant_date,s.planned_sow_date),
  30,
  22.8,
  'Farm Area 1 expansion: Storage Potatoes assigned across Sector 2 beds 1-4.'
from public.orchard_game_plans gp
join public.orchard_crop_cycles c on c.game_plan_id = gp.id and c.crop_name = 'Storage Potatoes'
join public.orchard_crop_successions s on s.crop_cycle_id = c.id and s.sequence_no = 1
join public.orchard_plots p on p.name = 'Orchard BlackSwan Campo — Sector 2' and p.status = 'active'
join public.orchard_beds b on b.plot_id = p.id and b.status = 'active'
where gp.name = 'BS Orchard — Crop Plan 2026/27' and gp.season = '2026/27'
  and s.planned_bed_m = 120
  and not exists (
    select 1 from public.orchard_bed_allocations a
    where a.crop_succession_id = s.id and a.bed_id = b.id
  );

-- New Potatoes -> Sector 3, four full beds.
insert into public.orchard_bed_allocations (
  bed_id, crop_succession_id, planned_start_date, planned_end_date,
  allocated_length_m, allocated_area_sqm, notes
)
select
  b.id,
  s.id,
  coalesce(s.planned_transplant_date,s.planned_sow_date),
  coalesce(s.planned_last_harvest_date,s.planned_first_harvest_date,s.planned_transplant_date,s.planned_sow_date),
  30,
  22.8,
  'Farm Area 1 expansion: New Potatoes assigned across Sector 3 beds 1-4.'
from public.orchard_game_plans gp
join public.orchard_crop_cycles c on c.game_plan_id = gp.id and c.crop_name = 'New Potatoes'
join public.orchard_crop_successions s on s.crop_cycle_id = c.id and s.sequence_no = 1
join public.orchard_plots p on p.name = 'Orchard BlackSwan Campo — Sector 3' and p.status = 'active'
join public.orchard_beds b on b.plot_id = p.id and b.status = 'active'
where gp.name = 'BS Orchard — Crop Plan 2026/27' and gp.season = '2026/27'
  and s.planned_bed_m = 120
  and not exists (
    select 1 from public.orchard_bed_allocations a
    where a.crop_succession_id = s.id and a.bed_id = b.id
  );

do $$
declare
  v_plan_id uuid;
  v_assigned integer;
  v_pending integer;
  v_allocated_m numeric;
  v_total_capacity numeric;
  v_peak numeric;
  v_max_bed numeric;
begin
  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27' and season = '2026/27';

  select count(distinct s.id), coalesce(sum(a.allocated_length_m),0)
    into v_assigned, v_allocated_m
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  join public.orchard_bed_allocations a on a.crop_succession_id = s.id
  where c.game_plan_id = v_plan_id and s.planned_bed_m is not null;

  select count(*) into v_pending
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id
    and s.planned_bed_m is not null
    and not exists (select 1 from public.orchard_bed_allocations a where a.crop_succession_id = s.id);

  select coalesce(sum(b.length_m),0) into v_total_capacity
  from public.orchard_beds b
  join public.orchard_plots p on p.id = b.plot_id
  where p.status = 'active'
    and p.name like 'Orchard BlackSwan Campo%'
    and b.status = 'active';

  with plan_rows as (
    select
      s.planned_bed_m,
      coalesce(s.planned_transplant_date,s.planned_sow_date) as start_date,
      coalesce(s.planned_last_harvest_date,s.planned_first_harvest_date,s.planned_transplant_date,s.planned_sow_date) as end_date
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id and s.planned_bed_m is not null
  ), daily as (
    select d::date as day, sum(p.planned_bed_m) as used_m
    from plan_rows p
    cross join lateral generate_series(p.start_date::timestamp,p.end_date::timestamp,interval '1 day') d
    group by d::date
  )
  select coalesce(max(used_m),0) into v_peak from daily;

  with daily_bed as (
    select a.bed_id,d::date as day,sum(a.allocated_length_m) as used_m
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    cross join lateral generate_series(a.planned_start_date::timestamp,a.planned_end_date::timestamp,interval '1 day') d
    where p.name like 'Orchard BlackSwan Campo%'
    group by a.bed_id,d::date
  )
  select coalesce(max(used_m),0) into v_max_bed from daily_bed;

  if v_assigned <> 32 or v_pending <> 0 or v_allocated_m <> 744 then
    raise exception 'Expansion did not close plan: assigned %, pending %, allocated %', v_assigned, v_pending, v_allocated_m;
  end if;
  if v_total_capacity <> 780 then
    raise exception 'Expected total Farm Area 1 logical bed capacity 780 m, found %', v_total_capacity;
  end if;
  if v_peak <> 702 or v_peak > v_total_capacity then
    raise exception 'Plan peak/capacity mismatch after expansion: peak %, capacity %', v_peak, v_total_capacity;
  end if;
  if v_max_bed > 30 then
    raise exception 'Per-bed capacity exceeded after expansion: %', v_max_bed;
  end if;
end $$;

commit;

-- Capacity-safe physical layout for the reconciled 2026/27 Orchard Game Plan.
-- Neutral optimization rule: keep canonical Core dates fixed and maximize the
-- number of assigned plantings without exceeding the 18 x 30 m field block.
-- With no canonical business-priority weights, the unique 30/32 maximum-count
-- solution defers the two 120 m potato plantings. The observed Arugula #1 -> bed
-- 17 placement remains untouched.

begin;

do $$
declare
  v_plan_id uuid;
  v_plot_id uuid;
  v_plan_count integer;
  v_plot_count integer;
  v_reconciled integer;
  v_total_bed_m numeric;
  v_active_beds integer;
  v_capacity numeric;
  v_existing_rows integer;
  v_existing_succ integer;
begin
  select count(*) into v_plan_count
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27' and season = '2026/27';
  if v_plan_count <> 1 then
    raise exception 'Expected exactly one canonical 2026/27 Orchard Game Plan, found %', v_plan_count;
  end if;
  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27' and season = '2026/27';

  select count(*) into v_plot_count
  from public.orchard_plots
  where name = 'Orchard BlackSwan Campo' and status = 'active';
  if v_plot_count <> 1 then
    raise exception 'Expected exactly one active Orchard BlackSwan Campo, found %', v_plot_count;
  end if;
  select id into v_plot_id
  from public.orchard_plots
  where name = 'Orchard BlackSwan Campo' and status = 'active';

  select count(*), coalesce(sum(s.planned_bed_m),0)
    into v_reconciled, v_total_bed_m
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id
    and s.planned_bed_m is not null
    and s.status <> 'cancelled';
  if v_reconciled <> 32 or v_total_bed_m <> 744 then
    raise exception 'Expected 32 reconciled plantings / 744 bed m, found % / %', v_reconciled, v_total_bed_m;
  end if;

  select count(*), coalesce(sum(length_m),0)
    into v_active_beds, v_capacity
  from public.orchard_beds
  where plot_id = v_plot_id and status = 'active';
  if v_active_beds <> 18 or v_capacity <> 540 then
    raise exception 'Expected 18 active beds / 540 m, found % / %', v_active_beds, v_capacity;
  end if;

  select count(*), count(distinct a.crop_succession_id)
    into v_existing_rows, v_existing_succ
  from public.orchard_bed_allocations a
  join public.orchard_crop_successions s on s.id = a.crop_succession_id
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id;
  if v_existing_rows <> 1 or v_existing_succ <> 1 then
    raise exception 'Expected exactly one pre-existing reference allocation, found % row(s) / % succession(s)', v_existing_rows, v_existing_succ;
  end if;

  if not exists (
    select 1
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_crop_successions s on s.id = a.crop_succession_id
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and c.crop_name = 'Arugula'
      and s.sequence_no = 1
      and b.plot_id = v_plot_id
      and b.name = '17'
      and a.allocated_length_m = 9
      and a.planned_start_date = date '2026-11-24'
      and a.planned_end_date = date '2027-01-04'
  ) then
    raise exception 'Observed Arugula #1 reference allocation drifted; aborting optimized layout';
  end if;
end $$;

with mapping(crop_name, sequence_no, expected_bed_m, bed_name) as (
  values
    ('Carrots',1,30::numeric,'1'),
    ('Onion',1,30,'4'),
    ('Broccoli',1,15,'12'),
    ('Cauliflower',1,15,'9'),
    ('Celery',1,15,'17'),
    ('Chili Pepper',1,15,'9'),
    ('Kale',1,15,'7'),
    ('Eggplants (field)',1,15,'8'),
    ('Broccoli',2,15,'13'),
    ('Cauliflower',2,15,'10'),
    ('Onion',2,30,'5'),
    ('Peas',1,30,'3'),
    ('Swiss Chard',1,15,'8'),
    ('Carrots',2,30,'2'),
    ('Bush Beans',1,30,'6'),
    ('Lettuce',1,15,'13'),
    ('Alaska Cucumber (greenhouse)',1,15,'11'),
    ('Broccoli',3,15,'14'),
    ('Cauliflower',3,15,'11'),
    ('Lebanese Cucumber (greenhouse)',1,15,'10'),
    ('Parsley',1,15,'7'),
    ('Dill',1,9,'15'),
    ('Lettuce',2,15,'14'),
    ('Lettuce',3,15,'12'),
    ('Arugula',2,9,'15'),
    ('Dill',2,9,'4'),
    ('Arugula',3,9,'16'),
    ('Lettuce',4,15,'4'),
    ('Arugula',4,9,'1')
), resolved as (
  select
    s.id as succession_id,
    b.id as bed_id,
    m.crop_name,
    m.sequence_no,
    m.expected_bed_m,
    coalesce(s.planned_transplant_date, s.planned_sow_date) as start_date,
    coalesce(s.planned_last_harvest_date, s.planned_first_harvest_date, s.planned_transplant_date, s.planned_sow_date) as end_date,
    b.width_m
  from mapping m
  join public.orchard_game_plans gp
    on gp.name = 'BS Orchard — Crop Plan 2026/27' and gp.season = '2026/27'
  join public.orchard_crop_cycles c
    on c.game_plan_id = gp.id and c.crop_name = m.crop_name
  join public.orchard_crop_successions s
    on s.crop_cycle_id = c.id and s.sequence_no = m.sequence_no
  join public.orchard_plots p
    on p.name = 'Orchard BlackSwan Campo' and p.status = 'active'
  join public.orchard_beds b
    on b.plot_id = p.id and b.name = m.bed_name and b.status = 'active'
  where s.planned_bed_m = m.expected_bed_m
), guard as (
  select
    count(*) as resolved_count,
    count(distinct succession_id) as succession_count,
    count(distinct (crop_name, sequence_no)) as key_count,
    coalesce(sum(expected_bed_m),0) as bed_m
  from resolved
), checked as (
  select 1
  from guard
  where resolved_count = 29
    and succession_count = 29
    and key_count = 29
    and bed_m = 495
)
insert into public.orchard_bed_allocations (
  bed_id,
  crop_succession_id,
  planned_start_date,
  planned_end_date,
  allocated_length_m,
  allocated_area_sqm,
  notes
)
select
  r.bed_id,
  r.succession_id,
  r.start_date,
  r.end_date,
  r.expected_bed_m,
  case when r.width_m is not null and r.width_m > 0 then r.expected_bed_m * r.width_m else null end,
  'Capacity-safe 2026/27 layout: fixed Core dates; maximum planting count under 540 m physical capacity; repeated generations spatially separated.'
from resolved r
cross join checked
where not exists (
  select 1 from public.orchard_bed_allocations a
  where a.crop_succession_id = r.succession_id
);

do $$
declare
  v_plan_id uuid;
  v_plot_id uuid;
  v_assigned_succ integer;
  v_allocation_rows integer;
  v_assigned_bed_m numeric;
  v_pending integer;
  v_peak_global numeric;
  v_peak_bed numeric;
  v_bed18_rows integer;
begin
  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27' and season = '2026/27';
  select id into v_plot_id
  from public.orchard_plots
  where name = 'Orchard BlackSwan Campo' and status = 'active';

  select count(distinct s.id), count(a.id), coalesce(sum(a.allocated_length_m),0)
    into v_assigned_succ, v_allocation_rows, v_assigned_bed_m
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  join public.orchard_bed_allocations a on a.crop_succession_id = s.id
  join public.orchard_beds b on b.id = a.bed_id and b.plot_id = v_plot_id
  where c.game_plan_id = v_plan_id
    and s.planned_bed_m is not null;
  if v_assigned_succ <> 30 or v_allocation_rows <> 30 or v_assigned_bed_m <> 504 then
    raise exception 'Expected 30 assigned plantings / 30 allocation rows / 504 m, found % / % / %', v_assigned_succ, v_allocation_rows, v_assigned_bed_m;
  end if;

  select count(*) into v_pending
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id
    and s.planned_bed_m is not null
    and not exists (select 1 from public.orchard_bed_allocations a where a.crop_succession_id = s.id);
  if v_pending <> 2 then
    raise exception 'Expected exactly two capacity-conflict plantings to remain pending, found %', v_pending;
  end if;

  if exists (
    select 1
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.planned_bed_m is not null
      and not exists (select 1 from public.orchard_bed_allocations a where a.crop_succession_id = s.id)
      and c.crop_name not in ('Storage Potatoes','New Potatoes')
  ) then
    raise exception 'A non-potato planting remained pending; optimized selection drifted';
  end if;

  with assigned as (
    select s.id,
           s.planned_bed_m,
           coalesce(s.planned_transplant_date, s.planned_sow_date) as start_date,
           coalesce(s.planned_last_harvest_date, s.planned_first_harvest_date, s.planned_transplant_date, s.planned_sow_date) as end_date
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.planned_bed_m is not null
      and exists (select 1 from public.orchard_bed_allocations a where a.crop_succession_id = s.id)
  ), daily as (
    select d::date as day, sum(a.planned_bed_m) as used_m
    from assigned a
    cross join lateral generate_series(a.start_date::timestamp, a.end_date::timestamp, interval '1 day') d
    group by d::date
  )
  select coalesce(max(used_m),0) into v_peak_global from daily;
  if v_peak_global > 540 then
    raise exception 'Global assigned peak exceeds physical capacity: % m', v_peak_global;
  end if;

  with daily as (
    select a.bed_id, d::date as day, sum(a.allocated_length_m) as used_m
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id and b.plot_id = v_plot_id
    cross join lateral generate_series(a.planned_start_date::timestamp, a.planned_end_date::timestamp, interval '1 day') d
    group by a.bed_id, d::date
  )
  select coalesce(max(used_m),0) into v_peak_bed from daily;
  if v_peak_bed > 30 then
    raise exception 'Per-bed peak exceeds 30 m: % m', v_peak_bed;
  end if;

  select count(*) into v_bed18_rows
  from public.orchard_bed_allocations a
  join public.orchard_beds b on b.id = a.bed_id
  where b.plot_id = v_plot_id and b.name = '18';
  if v_bed18_rows <> 0 then
    raise exception 'Bed 18 was expected to remain as full operational buffer';
  end if;
end $$;

commit;

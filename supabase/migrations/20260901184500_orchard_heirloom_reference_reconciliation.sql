-- Reconcile the authenticated Heirloom 2026/27 field study with canonical Core rows.
-- The 32-row mapping was verified against both the Heirloom reference queue and
-- Dietrich's Codified Game Plan. Dates remain owned by Core; only validated bed
-- meter demand and the physical field block are written here.

begin;

do $$
declare
  v_plan_count integer;
  v_matches integer;
  v_distinct integer;
  v_total numeric;
  v_plot_count integer;
begin
  select count(*) into v_plan_count
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27' and season = '2026/27';
  if v_plan_count <> 1 then
    raise exception 'Expected exactly one canonical 2026/27 Orchard Game Plan, found %', v_plan_count;
  end if;

  with mapping(core_crop, core_sequence, bed_m) as (
    values
      ('Arugula',1,9::numeric),('Arugula',2,9),('Arugula',3,9),('Arugula',4,9),
      ('Broccoli',1,15),('Broccoli',2,15),('Broccoli',3,15),
      ('Bush Beans',1,30),
      ('Carrots',1,30),('Carrots',2,30),
      ('Cauliflower',1,15),('Cauliflower',2,15),('Cauliflower',3,15),
      ('Celery',1,15),
      ('Alaska Cucumber (greenhouse)',1,15),('Lebanese Cucumber (greenhouse)',1,15),
      ('Dill',1,9),('Dill',2,9),
      ('Eggplants (field)',1,15),('Chili Pepper',1,15),('Kale',1,15),
      ('Lettuce',1,15),('Lettuce',2,15),('Lettuce',3,15),('Lettuce',4,15),
      ('Onion',1,30),('Onion',2,30),('Parsley',1,15),('Peas',1,30),
      ('Storage Potatoes',1,120),('New Potatoes',1,120),('Swiss Chard',1,15)
  ), matched as (
    select s.id as succession_id, m.bed_m
    from mapping m
    join public.orchard_game_plans gp
      on gp.name = 'BS Orchard — Crop Plan 2026/27' and gp.season = '2026/27'
    join public.orchard_crop_cycles c
      on c.crop_name = m.core_crop and c.game_plan_id = gp.id
    join public.orchard_crop_successions s
      on s.crop_cycle_id = c.id and s.sequence_no = m.core_sequence
  )
  select count(*), count(distinct succession_id), coalesce(sum(bed_m),0)
    into v_matches, v_distinct, v_total
  from matched;

  if v_matches <> 32 or v_distinct <> 32 or v_total <> 744 then
    raise exception 'Heirloom reconciliation mismatch: matches %, distinct %, bed_m %', v_matches, v_distinct, v_total;
  end if;

  select count(*) into v_plot_count
  from public.orchard_plots
  where name = 'Orchard BlackSwan Campo';
  if v_plot_count > 1 then
    raise exception 'Multiple Orchard BlackSwan Campo plots exist; manual reconciliation required';
  end if;
end $$;

with mapping(core_crop, core_sequence, bed_m) as (
  values
    ('Arugula',1,9::numeric),('Arugula',2,9),('Arugula',3,9),('Arugula',4,9),
    ('Broccoli',1,15),('Broccoli',2,15),('Broccoli',3,15),
    ('Bush Beans',1,30),
    ('Carrots',1,30),('Carrots',2,30),
    ('Cauliflower',1,15),('Cauliflower',2,15),('Cauliflower',3,15),
    ('Celery',1,15),
    ('Alaska Cucumber (greenhouse)',1,15),('Lebanese Cucumber (greenhouse)',1,15),
    ('Dill',1,9),('Dill',2,9),
    ('Eggplants (field)',1,15),('Chili Pepper',1,15),('Kale',1,15),
    ('Lettuce',1,15),('Lettuce',2,15),('Lettuce',3,15),('Lettuce',4,15),
    ('Onion',1,30),('Onion',2,30),('Parsley',1,15),('Peas',1,30),
    ('Storage Potatoes',1,120),('New Potatoes',1,120),('Swiss Chard',1,15)
), matched as (
  select s.id as succession_id, m.bed_m
  from mapping m
  join public.orchard_game_plans gp
    on gp.name = 'BS Orchard — Crop Plan 2026/27' and gp.season = '2026/27'
  join public.orchard_crop_cycles c
    on c.crop_name = m.core_crop and c.game_plan_id = gp.id
  join public.orchard_crop_successions s
    on s.crop_cycle_id = c.id and s.sequence_no = m.core_sequence
)
update public.orchard_crop_successions s
set planned_bed_m = matched.bed_m,
    updated_at = now()
from matched
where s.id = matched.succession_id
  and s.planned_bed_m is distinct from matched.bed_m;

insert into public.orchard_plots (
  name, description, plot_type, size_sqm, status, notes
)
select
  'Orchard BlackSwan Campo',
  'Canonical Fundo Corcovado field block replicated from the authenticated Heirloom parity study.',
  'vegetable_garden',
  null,
  'active',
  'Heirloom reference 2026-09-01: Farm Area 1; 18 beds x 30 m; standard bed width 0.76 m. This record does not assert a GIS polygon linkage that Core has not yet modeled.'
where not exists (
  select 1 from public.orchard_plots where name = 'Orchard BlackSwan Campo'
);

insert into public.orchard_beds (
  plot_id, name, length_m, width_m, area_sqm, status, planning_order, notes
)
select
  p.id,
  gs::text,
  30,
  0.76,
  22.8,
  'active',
  gs,
  'Canonical physical bed from Heirloom parity study; 30 m x 0.76 m.'
from public.orchard_plots p
cross join generate_series(1,18) as gs
where p.name = 'Orchard BlackSwan Campo'
  and not exists (
    select 1 from public.orchard_beds b
    where b.plot_id = p.id and b.name = gs::text
  );

do $$
declare
  v_plot_id uuid;
  v_active_beds integer;
  v_length_sum numeric;
begin
  select id into v_plot_id
  from public.orchard_plots
  where name = 'Orchard BlackSwan Campo';

  select count(*), coalesce(sum(length_m),0)
    into v_active_beds, v_length_sum
  from public.orchard_beds
  where plot_id = v_plot_id and status = 'active';

  if v_active_beds <> 18 or v_length_sum <> 540 then
    raise exception 'Physical field block mismatch: active beds %, total length %', v_active_beds, v_length_sum;
  end if;
end $$;

-- Replicate the only exact planting placement observed during the authenticated
-- walkthrough: Arugula generation 1, 9 bed m, bed 17, Nov 24 2026-Jan 4 2027.
insert into public.orchard_bed_allocations (
  bed_id, crop_succession_id, planned_start_date, planned_end_date,
  allocated_length_m, allocated_area_sqm, notes
)
select
  b.id,
  s.id,
  date '2026-11-24',
  date '2027-01-04',
  9,
  6.84,
  'Exact authenticated Heirloom parity placement observed 2026-09-01: Arugula generation 1 -> bed 17 -> 9 bed m.'
from public.orchard_plots p
join public.orchard_beds b on b.plot_id = p.id and b.name = '17'
join public.orchard_game_plans gp
  on gp.name = 'BS Orchard — Crop Plan 2026/27' and gp.season = '2026/27'
join public.orchard_crop_cycles c
  on c.game_plan_id = gp.id and c.crop_name = 'Arugula'
join public.orchard_crop_successions s
  on s.crop_cycle_id = c.id and s.sequence_no = 1
where p.name = 'Orchard BlackSwan Campo'
  and not exists (
    select 1 from public.orchard_bed_allocations a
    where a.bed_id = b.id
      and a.crop_succession_id = s.id
      and a.planned_start_date = date '2026-11-24'
      and a.planned_end_date = date '2027-01-04'
  );

commit;

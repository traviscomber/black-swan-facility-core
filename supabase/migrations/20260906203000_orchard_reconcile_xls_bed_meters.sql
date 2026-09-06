-- Reconcile 2026/27 Black Swan Orchard bed-meter demand to the explicit XLS
-- `beds_10m` source semantics after the physical layout moved from the Heirloom
-- 30 m reference geometry to Black Swan's canonical 10 m beds.
--
-- Historical Heirloom migrations remain untouched for auditability. This
-- migration corrects current canonical planning quantities only where the XLS
-- provenance is explicit and internally corroborated by planned_area_sqm.
-- Existing physical bed identities and date ranges are preserved.

begin;

do $$
declare
  v_plan_id uuid;
  v_plan_count integer;
  v_total integer;
  v_numeric integer;
  v_inflated integer;
  v_null_numeric integer;
  v_unknown integer;
  v_area_exact integer;
  v_assigned integer;
  v_current_physical integer;
  v_alloc_total numeric;
  v_alloc_source_total numeric;
begin
  select count(*) into v_plan_count
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  if v_plan_count <> 1 then
    raise exception 'Expected exactly one canonical 2026/27 Orchard Game Plan, found %', v_plan_count;
  end if;

  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  with rows as (
    select
      s.id,
      s.planned_bed_m,
      s.planned_area_sqm,
      case
        when jsonb_typeof(s.knowledge_source_snapshot->'beds_10m') = 'number'
          then (s.knowledge_source_snapshot->>'beds_10m')::numeric
        else null
      end as beds_10m
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.status <> 'cancelled'
  )
  select
    count(*),
    count(*) filter (where beds_10m > 0),
    count(*) filter (where planned_bed_m = beds_10m * 30),
    count(*) filter (where planned_bed_m is null and beds_10m > 0),
    count(*) filter (where planned_bed_m is null and beds_10m is null),
    count(*) filter (
      where beds_10m > 0
        and abs(coalesce(planned_area_sqm, 0) - (beds_10m * 10 * 0.762)) < 0.01
    )
  into v_total, v_numeric, v_inflated, v_null_numeric, v_unknown, v_area_exact
  from rows;

  if v_total <> 66
     or v_numeric <> 65
     or v_inflated <> 48
     or v_null_numeric <> 17
     or v_unknown <> 1
     or v_area_exact <> 65 then
    raise exception 'XLS bed-meter provenance guard failed: total %, numeric %, inflated %, null_numeric %, unknown %, area_exact %',
      v_total, v_numeric, v_inflated, v_null_numeric, v_unknown, v_area_exact;
  end if;

  with source as (
    select
      s.id,
      (s.knowledge_source_snapshot->>'beds_10m')::numeric * 10 as source_bed_m
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.status <> 'cancelled'
      and jsonb_typeof(s.knowledge_source_snapshot->'beds_10m') = 'number'
      and (s.knowledge_source_snapshot->>'beds_10m')::numeric > 0
  ), alloc as (
    select
      a.crop_succession_id,
      sum(a.allocated_length_m) as allocated_m,
      bool_and(p.name ~ '^(Current 0[1-5]|Expansion 0[1-3])$') as current_physical
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    group by a.crop_succession_id
  )
  select
    count(*),
    count(*) filter (where alloc.current_physical),
    coalesce(sum(alloc.allocated_m), 0),
    coalesce(sum(source.source_bed_m), 0)
  into v_assigned, v_current_physical, v_alloc_total, v_alloc_source_total
  from source
  join alloc on alloc.crop_succession_id = source.id;

  if v_assigned <> 34
     or v_current_physical <> 34
     or v_alloc_total <> 783
     or v_alloc_source_total <> 261 then
    raise exception 'Current allocation guard failed: assigned %, current_physical %, allocated %, source %',
      v_assigned, v_current_physical, v_alloc_total, v_alloc_source_total;
  end if;
end $$;

-- Preserve every existing bed ID and date range. Because allocated_length_m is
-- numeric(10,2), independently dividing each fragment by three would introduce
-- cent-level residue. All but the last fragment are rounded proportionally;
-- the final fragment receives only the rounding residue so each succession
-- closes exactly to its explicit XLS source_bed_m.
with plan as (
  select id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27'
), targets as (
  select
    s.id,
    (s.knowledge_source_snapshot->>'beds_10m')::numeric * 10 as source_bed_m
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = (select id from plan)
    and s.status <> 'cancelled'
    and jsonb_typeof(s.knowledge_source_snapshot->'beds_10m') = 'number'
    and (s.knowledge_source_snapshot->>'beds_10m')::numeric > 0
    and s.planned_bed_m = (s.knowledge_source_snapshot->>'beds_10m')::numeric * 30
), ordered as (
  select
    a.id as allocation_id,
    a.crop_succession_id,
    a.allocated_length_m,
    b.width_m,
    t.source_bed_m,
    row_number() over (
      partition by a.crop_succession_id
      order by p.name, b.planning_order nulls last, b.name, a.id
    ) as rn,
    count(*) over (partition by a.crop_succession_id) as fragment_count
  from public.orchard_bed_allocations a
  join targets t on t.id = a.crop_succession_id
  join public.orchard_beds b on b.id = a.bed_id
  join public.orchard_plots p on p.id = b.plot_id
  where p.name ~ '^(Current 0[1-5]|Expansion 0[1-3])$'
), rounded as (
  select
    *,
    round(allocated_length_m / 3, 2) as rounded_length
  from ordered
), resolved as (
  select
    allocation_id,
    width_m,
    case
      when rn < fragment_count then rounded_length
      else source_bed_m - coalesce(
        sum(rounded_length) filter (where rn < fragment_count)
          over (partition by crop_succession_id),
        0
      )
    end as new_length
  from rounded
)
update public.orchard_bed_allocations a
set allocated_length_m = resolved.new_length,
    allocated_area_sqm = resolved.new_length * resolved.width_m,
    notes = concat_ws(
      ' | ',
      nullif(a.notes, ''),
      '2026-09-06 XLS reconciliation: retained existing bed identity/date range; allocation length rescaled from legacy Heirloom 30 m reference to explicit Black Swan beds_10m source.'
    )
from resolved
where a.id = resolved.allocation_id;

-- For all 65 successions with explicit numeric XLS provenance, canonical demand
-- is the number of 10 m beds multiplied by 10 m. This corrects the 48 legacy
-- ×30 values and recovers the 17 source-backed NULLs.
with plan as (
  select id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27'
), source as (
  select
    s.id,
    (s.knowledge_source_snapshot->>'beds_10m')::numeric * 10 as source_bed_m
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = (select id from plan)
    and s.status <> 'cancelled'
    and jsonb_typeof(s.knowledge_source_snapshot->'beds_10m') = 'number'
    and (s.knowledge_source_snapshot->>'beds_10m')::numeric > 0
)
update public.orchard_crop_successions s
set planned_bed_m = source.source_bed_m,
    updated_at = now()
from source
where s.id = source.id
  and s.planned_bed_m is distinct from source.source_bed_m;

do $$
declare
  v_plan_id uuid;
  v_total integer;
  v_reconciled integer;
  v_unknown integer;
  v_total_bed_m numeric;
  v_assigned integer;
  v_alloc_total numeric;
  v_alloc_source_total numeric;
  v_bad_capacity integer;
begin
  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  with rows as (
    select
      s.id,
      s.planned_bed_m,
      case
        when jsonb_typeof(s.knowledge_source_snapshot->'beds_10m') = 'number'
          then (s.knowledge_source_snapshot->>'beds_10m')::numeric
        else null
      end as beds_10m
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.status <> 'cancelled'
  )
  select
    count(*),
    count(*) filter (where beds_10m > 0 and planned_bed_m = beds_10m * 10),
    count(*) filter (where beds_10m is null and planned_bed_m is null),
    coalesce(sum(planned_bed_m), 0)
  into v_total, v_reconciled, v_unknown, v_total_bed_m
  from rows;

  if v_total <> 66
     or v_reconciled <> 65
     or v_unknown <> 1
     or v_total_bed_m <> 426 then
    raise exception 'Post-reconciliation planning guard failed: total %, reconciled %, unknown %, bed_m %',
      v_total, v_reconciled, v_unknown, v_total_bed_m;
  end if;

  with source as (
    select
      s.id,
      (s.knowledge_source_snapshot->>'beds_10m')::numeric * 10 as source_bed_m
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.status <> 'cancelled'
      and jsonb_typeof(s.knowledge_source_snapshot->'beds_10m') = 'number'
      and (s.knowledge_source_snapshot->>'beds_10m')::numeric > 0
  ), alloc as (
    select
      a.crop_succession_id,
      sum(a.allocated_length_m) as allocated_m
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    where p.name ~ '^(Current 0[1-5]|Expansion 0[1-3])$'
    group by a.crop_succession_id
  )
  select
    count(*),
    coalesce(sum(alloc.allocated_m), 0),
    coalesce(sum(source.source_bed_m), 0)
  into v_assigned, v_alloc_total, v_alloc_source_total
  from source
  join alloc on alloc.crop_succession_id = source.id;

  if v_assigned <> 34
     or v_alloc_total <> 261
     or v_alloc_source_total <> 261 then
    raise exception 'Post-reconciliation allocation guard failed: assigned %, allocated %, source %',
      v_assigned, v_alloc_total, v_alloc_source_total;
  end if;

  select count(*) into v_bad_capacity
  from public.orchard_bed_allocations a
  join public.orchard_beds b on b.id = a.bed_id
  join public.orchard_plots p on p.id = b.plot_id
  where p.name ~ '^(Current 0[1-5]|Expansion 0[1-3])$'
    and (a.allocated_length_m <= 0 or a.allocated_length_m > b.length_m);

  if v_bad_capacity <> 0 then
    raise exception 'Post-reconciliation per-allocation capacity guard failed: % invalid row(s)', v_bad_capacity;
  end if;
end $$;

commit;

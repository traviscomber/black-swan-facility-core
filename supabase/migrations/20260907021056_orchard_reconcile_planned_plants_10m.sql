-- Reconcile transplant planned plant counts after the physical plan moved from
-- the legacy Heirloom 30 m bed reference to Black Swan's canonical 10 m beds.
--
-- Evidence: every one of the 22 currently populated 2026/27 transplant rows
-- equals ceil(beds_10m * 30 m * rows_per_bed * 100 / plant_spacing_cm).
-- The bed-metre source has already been reconciled to beds_10m * 10 m, so this
-- applies the identical source layout rule to the current canonical bed metres.
-- It also deterministically fills the 18 transplant rows whose planned_plants
-- remained null. No crop dates, bed allocations, status, germination evidence,
-- purchasing state, RLS or authorization logic is changed.

begin;

do $$
declare
  v_plan_id uuid;
  v_plan_count integer;
  v_total integer;
  v_numeric_layout integer;
  v_bed_m_reconciled integer;
  v_populated integer;
  v_missing integer;
  v_legacy_matches integer;
  v_seed_requests integer;
  v_old_total integer;
  v_target_total numeric;
  v_post_populated integer;
  v_post_total numeric;
  v_post_mismatch integer;
begin
  select count(*) into v_plan_count
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  if v_plan_count = 0 then
    raise notice 'Skipping planned-plants reconciliation: canonical 2026/27 Game Plan absent';
    return;
  end if;
  if v_plan_count <> 1 then
    raise exception 'Expected exactly one canonical 2026/27 Game Plan, found %', v_plan_count;
  end if;

  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  with x as (
    select
      cs.id,
      cs.planned_bed_m,
      cs.planned_plants,
      case
        when jsonb_typeof(cs.knowledge_source_snapshot->'beds_10m') = 'number'
          then (cs.knowledge_source_snapshot->>'beds_10m')::numeric
        else null
      end as beds_10m,
      cs.knowledge_source_snapshot->'black_swan_canonical'->>'rows_per_bed' as rows_text,
      cs.knowledge_source_snapshot->'black_swan_canonical'->>'plant_spacing_cm' as spacing_text
    from public.orchard_crop_successions cs
    join public.orchard_crop_cycles c on c.id = cs.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and cs.status <> 'cancelled'
      and c.cycle_type = 'transplant'
  )
  select
    count(*),
    count(*) filter (
      where rows_text ~ '^[0-9]+(?:\.[0-9]+)?$'
        and spacing_text ~ '^[0-9]+(?:\.[0-9]+)?$'
    ),
    count(*) filter (where beds_10m > 0 and planned_bed_m = beds_10m * 10),
    count(*) filter (where planned_plants is not null),
    count(*) filter (where planned_plants is null),
    count(*) filter (
      where planned_plants is not null
        and rows_text ~ '^[0-9]+(?:\.[0-9]+)?$'
        and spacing_text ~ '^[0-9]+(?:\.[0-9]+)?$'
        and planned_plants = ceil(beds_10m * 30 * rows_text::numeric * 100 / spacing_text::numeric)
    ),
    coalesce(sum(planned_plants), 0),
    coalesce(sum(
      case
        when rows_text ~ '^[0-9]+(?:\.[0-9]+)?$'
          and spacing_text ~ '^[0-9]+(?:\.[0-9]+)?$'
        then ceil(planned_bed_m * rows_text::numeric * 100 / spacing_text::numeric)
        else 0
      end
    ), 0)
  into v_total, v_numeric_layout, v_bed_m_reconciled, v_populated, v_missing,
       v_legacy_matches, v_old_total, v_target_total
  from x;

  select count(*) into v_seed_requests
  from public.procurement_requests
  where source_type = 'orchard_seed_plan';

  if v_total <> 40
     or v_numeric_layout <> 40
     or v_bed_m_reconciled <> 40
     or v_populated <> 22
     or v_missing <> 18
     or v_legacy_matches <> 22
     or v_old_total <> 3248
     or v_target_total <> 2551
     or v_seed_requests <> 0 then
    raise exception 'Prestate guard failed total %, numeric_layout %, bed_m_reconciled %, populated %, missing %, legacy_matches %, old_total %, target_total %, seed_requests %',
      v_total, v_numeric_layout, v_bed_m_reconciled, v_populated, v_missing,
      v_legacy_matches, v_old_total, v_target_total, v_seed_requests;
  end if;

  with target as (
    select
      cs.id,
      ceil(
        cs.planned_bed_m
        * (cs.knowledge_source_snapshot->'black_swan_canonical'->>'rows_per_bed')::numeric
        * 100
        / (cs.knowledge_source_snapshot->'black_swan_canonical'->>'plant_spacing_cm')::numeric
      )::integer as target_plants
    from public.orchard_crop_successions cs
    join public.orchard_crop_cycles c on c.id = cs.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and cs.status <> 'cancelled'
      and c.cycle_type = 'transplant'
  )
  update public.orchard_crop_successions cs
  set planned_plants = target.target_plants,
      knowledge_source_snapshot = jsonb_set(
        coalesce(cs.knowledge_source_snapshot, '{}'::jsonb),
        '{planned_plants_reconciliation}',
        jsonb_build_object(
          'source', 'Black Swan Crop Plan 26-27 XLS / Crop Chart',
          'source_file', 'Copy of Crop Plan 26-27 Black Swan Test.xlsx',
          'workbook_sha256', 'e29b581d0c2190b8ea43d8116ce19cfac85f8b9be6f1abdb2b676e984d186683',
          'reconciliation_class', 'legacy_30m_to_canonical_10m',
          'rule', 'ceil(planned_bed_m * rows_per_bed * 100 / plant_spacing_cm)',
          'evidence_status', 'deterministic_source_semantics_reconciliation',
          'note', 'All 22 previously populated transplant rows matched this source layout rule at the legacy 30 m reference; the same rule is applied to reconciled Black Swan 10 m bed metres.'
        ),
        true
      ),
      updated_at = now()
  from target
  where cs.id = target.id;

  with x as (
    select
      cs.planned_plants,
      ceil(
        cs.planned_bed_m
        * (cs.knowledge_source_snapshot->'black_swan_canonical'->>'rows_per_bed')::numeric
        * 100
        / (cs.knowledge_source_snapshot->'black_swan_canonical'->>'plant_spacing_cm')::numeric
      )::integer as target_plants
    from public.orchard_crop_successions cs
    join public.orchard_crop_cycles c on c.id = cs.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and cs.status <> 'cancelled'
      and c.cycle_type = 'transplant'
  )
  select
    count(*) filter (where planned_plants is not null),
    coalesce(sum(planned_plants), 0),
    count(*) filter (where planned_plants is distinct from target_plants)
  into v_post_populated, v_post_total, v_post_mismatch
  from x;

  if v_post_populated <> 40 or v_post_total <> 2551 or v_post_mismatch <> 0 then
    raise exception 'Poststate guard failed populated %, total %, mismatches %',
      v_post_populated, v_post_total, v_post_mismatch;
  end if;
end $$;

commit;

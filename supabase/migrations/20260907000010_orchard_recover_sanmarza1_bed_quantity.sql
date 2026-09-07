-- Recover the final 2026/27 Orchard bed quantity from the original Black Swan XLS.
--
-- Source evidence (two Library copies are byte-identical, SHA-256 below):
--   file: Copy of Crop Plan 26-27 Black Swan Test.xlsx
--   sheet: Codified Game Plan
--   row/code: 54 / sanmarza1
--   column F header: Beds quantity
--   raw XLS value: Excel serial 46143.0
--   number format: d.m
--   displayed cell value: 1.5
--
-- F54 is the only non-numeric Beds quantity among the 67 populated crop rows.
-- The stored serial was being multiplied as if it were a bed count, producing the
-- cached 6,152,400 kg yield in J54. This is an Excel date-coercion defect, not an
-- agronomic estimate. Recover the displayed 1.5-bed source quantity using Black
-- Swan's canonical 10 m x 0.762 m bed geometry. Physical placement remains a
-- separate human decision and is not modified here.

begin;

do $$
declare
  v_plan_id uuid;
  v_plan_count integer;
  v_target_id uuid;
  v_target_count integer;
  v_total integer;
  v_numeric_source integer;
  v_unknown integer;
  v_with_bed_m integer;
  v_planned_bed_m_total numeric;
  v_area_total numeric;
  v_target_allocations integer;
  v_audit_before integer;
  v_audit_after integer;
  v_assigned integer;
  v_ready integer;
  v_blocked integer;
begin
  select count(*) into v_plan_count
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  if v_plan_count = 0 then
    raise notice 'Skipping sanmarza1 source recovery: canonical imported 2026/27 Game Plan is absent in this environment';
    return;
  end if;

  if v_plan_count <> 1 then
    raise exception 'Expected exactly one canonical 2026/27 Orchard Game Plan, found %', v_plan_count;
  end if;

  select id into v_plan_id
  from public.orchard_game_plans
  where name = 'BS Orchard — Crop Plan 2026/27'
    and season = '2026/27';

  select count(*) into v_target_count
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id
    and s.status <> 'cancelled'
    and s.knowledge_source_snapshot->>'code' = 'sanmarza1';

  if v_target_count <> 1 then
    raise exception 'Expected exactly one sanmarza1 succession in the canonical plan, found %', v_target_count;
  end if;

  select s.id into v_target_id
  from public.orchard_crop_successions s
  join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
  where c.game_plan_id = v_plan_id
    and s.status <> 'cancelled'
    and s.knowledge_source_snapshot->>'code' = 'sanmarza1';

  with rows as (
    select
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
    count(*) filter (where beds_10m is null and planned_bed_m is null),
    count(*) filter (where planned_bed_m is not null),
    coalesce(sum(planned_bed_m), 0),
    coalesce(sum(planned_area_sqm), 0)
  into v_total, v_numeric_source, v_unknown, v_with_bed_m, v_planned_bed_m_total, v_area_total
  from rows;

  if v_total <> 66
     or v_numeric_source <> 65
     or v_unknown <> 1
     or v_with_bed_m <> 65
     or v_planned_bed_m_total <> 426
     or v_area_total <> 324.612 then
    raise exception 'Pre-recovery production guard failed: total %, numeric_source %, unknown %, with_bed_m %, bed_m %, area %',
      v_total, v_numeric_source, v_unknown, v_with_bed_m, v_planned_bed_m_total, v_area_total;
  end if;

  if not exists (
    select 1
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where s.id = v_target_id
      and c.game_plan_id = v_plan_id
      and c.crop_name = 'Tomatoes (greenhouse)'
      and s.sequence_no = 2
      and s.status = 'planned'
      and s.planned_bed_m is null
      and s.planned_area_sqm is null
      and s.planned_sow_date = date '2026-06-02'
      and s.planned_transplant_date = date '2026-07-27'
      and s.planned_first_harvest_date = date '2026-10-04'
      and s.planned_last_harvest_date = date '2027-02-01'
      and s.knowledge_source_snapshot->>'source_file' = 'Copy of Crop Plan 26-27 Black Swan Test.xlsx'
      and s.knowledge_source_snapshot->>'code' = 'sanmarza1'
      and s.knowledge_source_snapshot->'beds_10m' = 'null'::jsonb
      and s.notes = 'XLS code=sanmarza1; beds(10m)=MALFORMED/UNKNOWN'
  ) then
    raise exception 'sanmarza1 source-row guard failed';
  end if;

  select count(*) into v_target_allocations
  from public.orchard_bed_allocations
  where crop_succession_id = v_target_id;

  if v_target_allocations <> 0 then
    raise exception 'sanmarza1 must remain physically unassigned before source recovery, found % allocation rows', v_target_allocations;
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.orchard_crop_successions'::regclass
      and tgname = 'orchard_crop_successions_planned_bed_m_audit'
      and not tgisinternal
  ) then
    raise exception 'Orchard planned-bed-metre audit trigger must exist before source recovery';
  end if;

  select count(*) into v_audit_before
  from public.critical_action_audit_log
  where entity_type = 'orchard_crop_successions'
    and entity_id = v_target_id
    and category = 'orchard_planning';

  update public.orchard_crop_successions
  set planned_bed_m = 15.00,
      planned_area_sqm = 11.430,
      knowledge_source_snapshot = coalesce(knowledge_source_snapshot, '{}'::jsonb)
        || jsonb_build_object(
          'beds_10m', 1.5,
          'source_recovery', jsonb_build_object(
            'recovery_class', 'excel_date_coercion',
            'evidence_status', 'deterministic_source_type_recovery',
            'source_file', 'Copy of Crop Plan 26-27 Black Swan Test.xlsx',
            'source_sheet', 'Codified Game Plan',
            'source_cell', 'F54',
            'source_column', 'Beds quantity',
            'source_code', 'sanmarza1',
            'raw_excel_serial', 46143.0,
            'cell_number_format', 'd.m',
            'displayed_value', '1.5',
            'recovered_beds_10m', 1.5,
            'workbook_sha256', 'e29b581d0c2190b8ea43d8116ce19cfac85f8b9be6f1abdb2b676e984d186683',
            'validation', 'Only non-numeric Beds quantity among 67 populated crop rows; adjacent rows are numeric and the raw date serial creates a nonsensical cached yield when multiplied as bed count.',
            'planned_bed_m_rule', '1.5 beds x 10 m = 15 m',
            'planned_area_rule', '1.5 beds x 10 m x 0.762 m = 11.43 m2'
          )
        ),
      notes = 'XLS code=sanmarza1; beds(10m)=1.5; recovered from Codified Game Plan!F54 Excel date coercion (raw serial 46143.0, format d.m, displayed 1.5). No physical placement inferred.',
      updated_at = now()
  where id = v_target_id
    and planned_bed_m is null;

  if not found then
    raise exception 'sanmarza1 source recovery did not update exactly the expected unresolved row';
  end if;

  with rows as (
    select
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
    count(*) filter (where beds_10m is null and planned_bed_m is null),
    count(*) filter (where planned_bed_m is not null),
    coalesce(sum(planned_bed_m), 0),
    coalesce(sum(planned_area_sqm), 0)
  into v_total, v_numeric_source, v_unknown, v_with_bed_m, v_planned_bed_m_total, v_area_total
  from rows;

  if v_total <> 66
     or v_numeric_source <> 66
     or v_unknown <> 0
     or v_with_bed_m <> 66
     or v_planned_bed_m_total <> 441
     or v_area_total <> 336.042 then
    raise exception 'Post-recovery planning guard failed: total %, numeric_source %, unknown %, with_bed_m %, bed_m %, area %',
      v_total, v_numeric_source, v_unknown, v_with_bed_m, v_planned_bed_m_total, v_area_total;
  end if;

  if not exists (
    select 1
    from public.orchard_crop_successions
    where id = v_target_id
      and planned_bed_m = 15.00
      and planned_area_sqm = 11.430
      and knowledge_source_snapshot->'beds_10m' = '1.5'::jsonb
      and knowledge_source_snapshot->'source_recovery'->>'recovery_class' = 'excel_date_coercion'
      and knowledge_source_snapshot->'source_recovery'->>'workbook_sha256' = 'e29b581d0c2190b8ea43d8116ce19cfac85f8b9be6f1abdb2b676e984d186683'
  ) then
    raise exception 'sanmarza1 recovered-value/provenance guard failed';
  end if;

  select count(*) into v_target_allocations
  from public.orchard_bed_allocations
  where crop_succession_id = v_target_id;

  if v_target_allocations <> 0 then
    raise exception 'Source recovery must not physically place sanmarza1; found % allocation rows', v_target_allocations;
  end if;

  with plan_successions as (
    select
      s.id,
      s.planned_bed_m,
      s.planned_sow_date,
      s.planned_transplant_date,
      s.planned_first_harvest_date,
      s.planned_last_harvest_date
    from public.orchard_crop_successions s
    join public.orchard_crop_cycles c on c.id = s.crop_cycle_id
    where c.game_plan_id = v_plan_id
      and s.status <> 'cancelled'
  ), assigned as (
    select distinct a.crop_succession_id
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    join public.orchard_plots p on p.id = b.plot_id
    where p.name ~ '^(Current 0[1-5]|Expansion 0[1-3])$'
  )
  select
    count(*) filter (where a.crop_succession_id is not null),
    count(*) filter (
      where a.crop_succession_id is null
        and ps.planned_bed_m > 0
        and coalesce(ps.planned_transplant_date, ps.planned_sow_date) is not null
        and coalesce(ps.planned_last_harvest_date, ps.planned_first_harvest_date) is not null
    ),
    count(*) filter (
      where a.crop_succession_id is null
        and not (
          ps.planned_bed_m > 0
          and coalesce(ps.planned_transplant_date, ps.planned_sow_date) is not null
          and coalesce(ps.planned_last_harvest_date, ps.planned_first_harvest_date) is not null
        )
    )
  into v_assigned, v_ready, v_blocked
  from plan_successions ps
  left join assigned a on a.crop_succession_id = ps.id;

  if v_assigned <> 34 or v_ready <> 32 or v_blocked <> 0 then
    raise exception 'Post-recovery Crop Map queue guard failed: assigned %, ready %, blocked %',
      v_assigned, v_ready, v_blocked;
  end if;

  select count(*) into v_audit_after
  from public.critical_action_audit_log
  where entity_type = 'orchard_crop_successions'
    and entity_id = v_target_id
    and category = 'orchard_planning';

  if v_audit_after <> v_audit_before + 1 then
    raise exception 'Expected exactly one new orchard_planning audit event for sanmarza1, before %, after %',
      v_audit_before, v_audit_after;
  end if;

  if not exists (
    select 1
    from public.critical_action_audit_log
    where entity_type = 'orchard_crop_successions'
      and entity_id = v_target_id
      and category = 'orchard_planning'
      and action = 'UPDATE'
      and changed_fields @> array['planned_bed_m']::text[]
      and new_data->>'planned_bed_m' = '15.00'
    order by occurred_at desc
    limit 1
  ) then
    raise exception 'sanmarza1 audit evidence guard failed';
  end if;
end $$;

commit;

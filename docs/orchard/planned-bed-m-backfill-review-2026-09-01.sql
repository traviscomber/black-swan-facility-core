-- REVIEW-ONLY SQL — DO NOT ADD TO supabase/migrations.
-- Black Swan 2026/27 direct-sow planned_bed_m reconciliation.
--
-- Evidence:
-- - For all 10 existing direct-sow rows that already have planned_bed_m,
--   planned_bed_m / knowledge_source_snapshot.beds_10m = 30 exactly.
-- - Therefore the imported `beds_10m` key is semantically a fraction of the
--   30 m production bed standard in this workbook/import path.
-- - The 16 rows below already preserve the source value in their knowledge
--   snapshot; this file only records the deterministic reconstruction.
--
-- This file intentionally contains no executable UPDATE statements.

with reviewed_backfill(succession_id, crop_name, sequence_no, source_beds_10m, reviewed_planned_bed_m) as (
  values
    ('7bb240b1-1b6e-48f9-9e4c-d9225e491c31'::uuid, 'Corn',                  1, 1.0::numeric, 30.0::numeric),
    ('951c2cc9-d284-46b7-a8a8-0c6d2b97488f'::uuid, 'Mizuna',                1, 0.3::numeric,  9.0::numeric),
    ('b147ddca-35a4-4d8c-a4e3-e06f688b8bb7'::uuid, 'Mizuna',                2, 0.3::numeric,  9.0::numeric),
    ('97b7fd01-5255-4ac4-96a3-41e8fcb2a825'::uuid, 'Mizuna',                3, 0.3::numeric,  9.0::numeric),
    ('d85e4ff6-09dc-46c3-a422-2efc66b22def'::uuid, 'Mizuna',                4, 0.3::numeric,  9.0::numeric),
    ('18c2ffea-d857-4b77-83d6-d8d44f073053'::uuid, 'Radishes',              1, 0.3::numeric,  9.0::numeric),
    ('455029dc-c7e5-4bba-8d98-f2b360325428'::uuid, 'Radishes',              2, 0.3::numeric,  9.0::numeric),
    ('5e9c83c5-d005-45a6-b6a4-68eda4236cd6'::uuid, 'Radishes',              3, 0.3::numeric,  9.0::numeric),
    ('f1cb7e10-7d2e-4639-ad49-4f848220ba51'::uuid, 'Radishes',              4, 0.3::numeric,  9.0::numeric),
    ('0c88066d-7b1b-4476-9bf9-f5ad68e70df9'::uuid, 'Shallots',              1, 0.5::numeric, 15.0::numeric),
    ('bcecafad-4008-43fb-93eb-8388c2d17cb0'::uuid, 'Storage Beetroot',      1, 0.5::numeric, 15.0::numeric),
    ('9bd04e56-be43-4a69-87e2-df2e9c96f0d0'::uuid, 'Tatsoi',                1, 0.3::numeric,  9.0::numeric),
    ('55b369d7-94f0-4b28-aade-ef75f7ebd434'::uuid, 'Tatsoi',                2, 0.3::numeric,  9.0::numeric),
    ('ef467f4f-caa7-4a43-ab36-7e9b40365b70'::uuid, 'Tatsoi',                3, 0.3::numeric,  9.0::numeric),
    ('53a2b38b-9796-447f-a714-56dc5a74f952'::uuid, 'Tatsoi',                4, 0.3::numeric,  9.0::numeric),
    ('072c9f1b-a4d0-4cea-b046-f84be0f79a15'::uuid, 'White Radish (Daikon)', 1, 0.3::numeric,  9.0::numeric)
)
select
  r.crop_name,
  r.sequence_no,
  r.source_beds_10m,
  r.reviewed_planned_bed_m,
  s.planned_bed_m as current_planned_bed_m,
  (s.knowledge_source_snapshot->>'beds_10m')::numeric as current_source_beds_10m,
  case
    when s.id is null then 'missing_succession'
    when s.planned_bed_m is not null then 'already_populated'
    when (s.knowledge_source_snapshot->>'beds_10m')::numeric is distinct from r.source_beds_10m then 'source_changed'
    when r.reviewed_planned_bed_m <> r.source_beds_10m * 30 then 'conversion_error'
    else 'ready_for_authorized_backfill'
  end as review_status
from reviewed_backfill r
left join public.orchard_crop_successions s on s.id = r.succession_id
order by r.crop_name, r.sequence_no;

-- Expected review result before any authorized write:
-- 16 rows, all `ready_for_authorized_backfill`.
-- Total reconstructed planned bed length: 177 m.
--
-- Any future write must re-check the source snapshot immediately beforehand
-- and preserve/update lineage metadata. Do not use this review file as an
-- executable migration.
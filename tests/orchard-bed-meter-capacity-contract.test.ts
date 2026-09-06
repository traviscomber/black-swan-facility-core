import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = "supabase/migrations/20260901183000_orchard_bed_meter_capacity.sql"
const xlsReconciliationPath = "supabase/migrations/20260906203000_orchard_reconcile_xls_bed_meters.sql"

test("bed-meter migration stores explicit planning and allocation quantities", async () => {
  const source = await readFile(migrationPath, "utf8")
  assert.match(source, /planned_bed_m numeric/)
  assert.match(source, /allocated_length_m numeric/)
  assert.match(source, /planned_bed_m is null or planned_bed_m > 0/)
  assert.match(source, /allocated_length_m > 0/)
})

test("bed-meter capacity replaces whole-bed exclusion with serialized cumulative validation", async () => {
  const source = await readFile(migrationPath, "utf8")
  assert.match(source, /drop constraint if exists orchard_bed_allocations_no_overlap/)
  assert.match(source, /for update/)
  assert.match(source, /generate_series/)
  assert.match(source, /sum\(a\.allocated_length_m\)/)
  assert.match(source, /Bed-meter capacity exceeded/)
})

test("bed-meter parity does not invent an unobserved within-bed offset", async () => {
  const source = await readFile(migrationPath, "utf8")
  assert.doesNotMatch(source, /start_offset_m|end_offset_m/)
  assert.match(source, /orchard_allocate_bed_meters/)
})

test("capacity cockpit reads the verified eight-block model and temporal occupancy", async () => {
  const source = await readFile("app/orchard/game-plan/capacity/page.tsx", "utf8")
  assert.match(source, /\^\(Current 0\[1-5\]\|Expansion 0\[1-3\]\)\$/)
  assert.match(source, /orchard_beds/)
  assert.match(source, /length_m/)
  assert.match(source, /planned_start_date/)
  assert.match(source, /planned_end_date/)
  assert.match(source, /allocated_length_m/)
  assert.match(source, /peakUsage/)
  assert.match(source, /current \+= delta/)
  assert.match(source, /capacityM-peak\.meters/)
  assert.match(source, /new Set\(scopedAllocations\.map\(\(allocation\)=>allocation\.crop_succession_id\)\)\.size/)
  assert.doesNotMatch(source, /does not yet contain enough verified bed geometry/i)
  assert.doesNotMatch(source, /no contiene suficiente geometría/i)
})

test("production forecast is bounded by physical Crop Map reconciliation", async () => {
  const source = await readFile("app/orchard/game-plan/forecast/page.tsx", "utf8")
  assert.match(source, /from\("orchard_bed_allocations"\)/)
  assert.match(source, /allocatedSuccessionIds\.has\(succession\.id\)/)
  assert.match(source, /planned_first_harvest_date/)
  assert.match(source, /planned_last_harvest_date/)
  assert.match(source, /cycleTargetQuantity/)
  assert.match(source, /cycle-level, not per succession/)
  assert.match(source, /no implica volumen semanal uniforme/)
  assert.doesNotMatch(source, /weekly volume.*=/i)
})

test("harvest desk attributes actual output only through exact reconciled succession lineage", async () => {
  const source = await readFile("app/orchard/harvest/desk/page.tsx", "utf8")
  assert.match(source, /from\("orchard_bed_allocations"\)/)
  assert.match(source, /allocatedIds\.has\(s\.id\)/)
  assert.match(source, /successionById\.has\(h\.crop_succession_id\)/)
  assert.match(source, /actualBySuccession/)
  assert.match(source, /new Map<string,ActualSummary>/)
  assert.match(source, /byUnit:new Map<string,number>/)
  assert.match(source, /(?:units|entries)\.length===1/)
  assert.match(source, /mixed units/)
  assert.doesNotMatch(source, /totals\.get\(crop\)/)
  assert.doesNotMatch(source, /harvests\.filter\([^\n]*harvest_date[^\n]*planned_/)
  assert.doesNotMatch(source, /find\([^\n]*harvest_date[^\n]*planned_/)
})

test("Black Swan bed metres follow explicit XLS 10m-bed provenance instead of the legacy Heirloom 30m geometry", async () => {
  const source = await readFile(xlsReconciliationPath, "utf8")
  assert.match(source, /knowledge_source_snapshot->'beds_10m'/)
  assert.match(source, /\* 10 as source_bed_m/)
  assert.match(source, /planned_bed_m = beds_10m \* 30/)
  assert.match(source, /planned_bed_m = beds_10m \* 10/)
  assert.match(source, /beds_10m \* 10 \* 0\.762/)
})

test("XLS bed-meter reconciliation is guarded to the verified production state", async () => {
  const source = await readFile(xlsReconciliationPath, "utf8")
  assert.match(source, /v_total <> 66/)
  assert.match(source, /v_numeric <> 65/)
  assert.match(source, /v_inflated <> 48/)
  assert.match(source, /v_null_numeric <> 17/)
  assert.match(source, /v_unknown <> 1/)
  assert.match(source, /v_area_exact <> 65/)
  assert.match(source, /v_alloc_total <> 783/)
  assert.match(source, /v_alloc_source_total <> 261/)
})

test("XLS correction preserves bed identities and closes numeric(10,2) residue per succession", async () => {
  const source = await readFile(xlsReconciliationPath, "utf8")
  assert.match(source, /round\(allocated_length_m \/ 3, 2\) as rounded_length/)
  assert.match(source, /source_bed_m - coalesce\(/)
  assert.match(source, /partition by crop_succession_id/)
  assert.match(source, /allocated_length_m = resolved\.new_length/)
  assert.match(source, /allocated_area_sqm = resolved\.new_length \* resolved\.width_m/)
  assert.doesNotMatch(source, /delete from public\.orchard_bed_allocations/i)
  assert.doesNotMatch(source, /insert into public\.orchard_bed_allocations/i)
  assert.doesNotMatch(source, /bed_id\s*=/i)
  assert.match(source, /v_reconciled <> 65/)
  assert.match(source, /v_unknown <> 1/)
  assert.match(source, /v_total_bed_m <> 426/)
  assert.match(source, /v_alloc_total <> 261/)
  assert.match(source, /v_bad_capacity <> 0/)
})

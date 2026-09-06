import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = "supabase/migrations/20260901183000_orchard_bed_meter_capacity.sql"

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

test("missing bed metres are resolved only through explicit operator input", async () => {
  const source = await readFile("app/orchard/game-plan/bed-meters/page.tsx", "utf8")

  assert.match(source, /planned_bed_m:value/)
  assert.match(source, /Number\(values\[item\.id\]\)/)
  assert.match(source, /value<=0/)
  assert.match(source, /\.is\("planned_bed_m",null\)/)
  assert.match(source, /never estimates or auto-fills a value/)
  assert.match(source, /Do not infer metres from plants, area, yield or another crop/)
  assert.doesNotMatch(source, /planned_area_sqm\s*[*/+-]/)
  assert.doesNotMatch(source, /planned_plants\s*[*/+-]/)
})

test("Crop Map sends bed-meter blockers to the explicit planning-input workspace", async () => {
  const source = await readFile("app/orchard/crop-map/overview/quick-assign.tsx", "utf8")

  assert.match(source, /missingBedMeters = blocked\.filter/)
  assert.match(source, /\/orchard\/game-plan\/bed-meters/)
  assert.match(source, /resolveBedMeters/)
  assert.match(source, /Nothing is placed automatically/)
  assert.match(source, /orchard_place_succession_bed_meters/)
})

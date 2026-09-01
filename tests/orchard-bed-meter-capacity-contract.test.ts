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

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Heirloom reconciliation remains explicit, idempotent and bed-meter based", async () => {
  const migration = await readFile("supabase/migrations/20260901184500_orchard_heirloom_reference_reconciliation.sql", "utf8")
  const placement = await readFile("supabase/migrations/20260901190000_orchard_place_succession_bed_meters.sql", "utf8")
  const optimizedLayout = await readFile("supabase/migrations/20260901194500_orchard_capacity_safe_reference_layout.sql", "utf8")
  const page = await readFile("app/orchard/crop-map/auto-place/page.tsx", "utf8")
  const parity = await readFile("lib/orchard/heirloom-parity.ts", "utf8")

  assert.match(migration, /BS Orchard — Crop Plan 2026\/27/)
  assert.match(migration, /v_matches <> 32/)
  assert.match(migration, /v_total <> 744/)
  assert.match(migration, /Orchard BlackSwan Campo/)
  assert.match(migration, /generate_series\(1,18\)/)
  assert.match(migration, /Arugula generation 1 -> bed 17 -> 9 bed m/)
  assert.doesNotMatch(migration, /3bdcad00-b8e5-4f73-bb8b-fdea96da9262/)

  assert.match(placement, /orchard_place_succession_bed_meters/)
  assert.match(placement, /for update/)
  assert.match(placement, /allocated_length_m/)
  assert.match(placement, /Insufficient contiguous bed-meter capacity/)
  assert.match(placement, /Planting already has a bed allocation/)

  assert.match(optimizedLayout, /maximum-count/)
  assert.match(optimizedLayout, /Storage Potatoes/)
  assert.match(optimizedLayout, /New Potatoes/)
  assert.match(optimizedLayout, /v_assigned_succ <> 30/)
  assert.match(optimizedLayout, /v_assigned_bed_m <> 504/)
  assert.match(optimizedLayout, /v_peak_global > 540/)
  assert.match(optimizedLayout, /b\.name = '18'/)
  assert.doesNotMatch(optimizedLayout, /min\(id\)/)

  assert.match(page, /planned_bed_m/)
  assert.match(page, /allocated_length_m/)
  assert.match(page, /orchard_place_succession_bed_meters/)
  assert.match(page, /\$\{assigned\}\/\$\{scoped\.length\}/)
  assert.match(page, /peakDemand/)
  assert.match(page, /assignedPeak/)
  assert.match(page, /capacityConflict/)
  assert.match(page, /spareBeds/)
  assert.match(page, /Orchard BlackSwan Campo/)

  assert.match(parity, /fieldBlockBeds: 18/)
  assert.match(parity, /fieldBlockBedLengthM: 30/)
  assert.match(parity, /HEIRLOOM_REFERENCE_PLANTINGS/)
})

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = "supabase/migrations/20260906203000_orchard_reconcile_xls_bed_meters.sql"

test("Black Swan bed metres follow explicit XLS 10m-bed provenance instead of the legacy Heirloom 30m geometry", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.match(source, /knowledge_source_snapshot->'beds_10m'/)
  assert.match(source, /source_bed_m/)
  assert.match(source, /\* 10 as source_bed_m/)
  assert.match(source, /planned_bed_m = beds_10m \* 30/)
  assert.match(source, /planned_bed_m = beds_10m \* 10/)
  assert.match(source, /planned_area_sqm/)
  assert.match(source, /beds_10m \* 10 \* 0\.762/)
})

test("reconciliation is tightly guarded to the observed 66-row 2026/27 source state", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.match(source, /v_total <> 66/)
  assert.match(source, /v_numeric <> 65/)
  assert.match(source, /v_inflated <> 48/)
  assert.match(source, /v_null_numeric <> 17/)
  assert.match(source, /v_unknown <> 1/)
  assert.match(source, /v_area_exact <> 65/)
  assert.match(source, /v_alloc_total <> 783/)
  assert.match(source, /v_alloc_source_total <> 261/)
})

test("existing physical bed identities are preserved while only inflated allocation lengths shrink", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.match(source, /allocated_length_m = a\.allocated_length_m \/ 3/)
  assert.match(source, /allocated_area_sqm = \(a\.allocated_length_m \/ 3\) \* b\.width_m/)
  assert.doesNotMatch(source, /update public\.orchard_bed_allocations[\s\S]{0,400}set[\s\S]{0,200}bed_id\s*=/i)
  assert.doesNotMatch(source, /delete from public\.orchard_bed_allocations/i)
  assert.doesNotMatch(source, /insert into public\.orchard_bed_allocations/i)
})

test("post-reconciliation state leaves only the malformed XLS row unresolved", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.match(source, /v_reconciled <> 65/)
  assert.match(source, /v_unknown <> 1/)
  assert.match(source, /v_total_bed_m <> 426/)
  assert.match(source, /v_alloc_total <> 261/)
  assert.match(source, /v_alloc_source_total <> 261/)
  assert.match(source, /v_bad_capacity <> 0/)
})

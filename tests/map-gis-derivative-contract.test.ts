import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL("../supabase/migrations/20260825000100_add_gis_overlay_runtime_derivatives.sql", import.meta.url)

test("GIS derivative migration is additive and finance-free", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase()
  for (const column of ["derived_geojson_url", "derived_source_version", "derived_feature_count", "derived_generated_at"]) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`))
  }
  assert.doesNotMatch(sql, /drop\s+column\s+file_url/)
  assert.doesNotMatch(sql, /delete\s+from\s+(public\.)?gis_overlays/)
  assert.doesNotMatch(sql, /invoice|payment|billing|accounting/)
})

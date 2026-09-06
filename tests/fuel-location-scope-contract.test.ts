import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  new URL("../supabase/migrations/20260904005051_enforce_fuel_location_scope.sql", import.meta.url),
  "utf8",
)
const uploadRoute = readFileSync(
  new URL("../app/api/fuel-consumption/upload/route.ts", import.meta.url),
  "utf8",
)

test("new Fuel records require a canonical operational location", () => {
  assert.match(migration, /tg_op = 'INSERT' and new\.location_id is null/)
  assert.match(migration, /old\.location_id is not null\s+and new\.location_id is null/)
  assert.match(migration, /before insert or update of location_id on public\.fuel_consumption/)
  assert.match(migration, /location_id is not null\s+and public\.can_access_operational_scope\('fuel', location_id\)/)
})

test("legacy NULL Fuel history is visible only through broad Fuel scope", () => {
  assert.match(migration, /location_id is null and public\.can_access_operational_scope\('fuel', null\)/)
  assert.match(migration, /location_id is not null and public\.can_access_operational_scope\('fuel', location_id\)/)
  assert.doesNotMatch(migration, /location_id is null\s+or/)
})

test("Fuel review and location directory enforce authorization internally", () => {
  assert.match(migration, /get_fuel_location_directory\(\)/)
  assert.match(migration, /public\.can_app_action\('fuel\.review'\)/)
  assert.match(migration, /public\.can_access_operational_scope\('fuel', l\.id\)/)
  assert.match(migration, /if not public\.can_access_operational_scope\('fuel', v_location_id\)/)
  assert.match(migration, /revoke all on function public\.get_fuel_location_directory\(\) from public, anon/)
})

test("the stale direct-import endpoint cannot persist Fuel records", () => {
  assert.match(uploadRoute, /FUEL_IMPORT_PERSISTENCE_DISABLED/)
  assert.match(uploadRoute, /status:\s*410/)
  assert.doesNotMatch(uploadRoute, /\.from\(['"]fuel_consumption['"]\)/)
  assert.doesNotMatch(uploadRoute, /\.insert\(/)
})

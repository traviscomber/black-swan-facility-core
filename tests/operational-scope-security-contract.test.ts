import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  new URL("../supabase/migrations/20260827184610_fail_closed_null_operational_scope.sql", import.meta.url),
  "utf8",
)

test("location-specific operational scopes fail closed when an object has no location", () => {
  assert.match(migration, /s\.location_id is null/)
  assert.match(migration, /p_location_id is not null and s\.location_id=p_location_id/)
  assert.doesNotMatch(migration, /or p_location_id is null/)
})

test("operational scope hardening preserves authentication and admin boundaries", () => {
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /auth\.role\(\)/)
  assert.match(migration, /v_role = 'admin'/)
  assert.match(migration, /current_app_role\(\)/)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const nullLocationMigration = readFileSync(
  new URL("../supabase/migrations/20260827184610_fail_closed_null_operational_scope.sql", import.meta.url),
  "utf8",
)
const activeProfileMigration = readFileSync(
  new URL("../supabase/migrations/20260827184757_fail_closed_missing_operational_profile.sql", import.meta.url),
  "utf8",
)

test("location-specific operational scopes fail closed when an object has no location", () => {
  assert.match(nullLocationMigration, /s\.location_id is null/)
  assert.match(nullLocationMigration, /p_location_id is not null and s\.location_id=p_location_id/)
  assert.doesNotMatch(nullLocationMigration, /or p_location_id is null/)
})

test("operational scope denies users without an active access profile", () => {
  assert.match(activeProfileMigration, /v_role in \('none','disabled'\) then return false/)
  assert.match(activeProfileMigration, /current_app_role\(\)/)
  assert.match(activeProfileMigration, /auth\.uid\(\)/)
})

test("operational scope hardening preserves service and admin boundaries", () => {
  assert.match(activeProfileMigration, /auth\.role\(\)/)
  assert.match(activeProfileMigration, /'service_role'/)
  assert.match(activeProfileMigration, /v_role = 'admin'/)
  assert.match(activeProfileMigration, /p_location_id is not null and s\.location_id=p_location_id/)
})

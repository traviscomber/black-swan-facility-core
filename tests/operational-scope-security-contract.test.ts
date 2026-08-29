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
const orchardWorkPage = readFileSync(new URL("../app/orchard/work/page.tsx", import.meta.url), "utf8")
const orchardTaskSourceMigration = readFileSync(
  new URL("../supabase/migrations/20260829144501_allow_orchard_task_source_types.sql", import.meta.url),
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

test("every Orchard task source emitted by the Work cockpit is accepted by the database contract", () => {
  const uiSources = [...new Set([...orchardWorkPage.matchAll(/["`](orchard_(?:general|succession(?:_(?:sow|transplant|harvest))?))["`]/g)].map((match) => match[1]))].sort()
  assert.deepEqual(uiSources, [
    "orchard_general",
    "orchard_succession",
    "orchard_succession_harvest",
    "orchard_succession_sow",
    "orchard_succession_transplant",
  ])
  for (const source of uiSources) assert.match(orchardTaskSourceMigration, new RegExp(`'${source}'::text`))
})

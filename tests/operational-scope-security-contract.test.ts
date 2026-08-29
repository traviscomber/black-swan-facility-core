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
const orchardReferenceMigration = readFileSync(
  new URL("../supabase/migrations/20260829152000_orchard_reference_gaps_1_4.sql", import.meta.url),
  "utf8",
)
const orchardTriggerRpcMigration = readFileSync(
  new URL("../supabase/migrations/20260829235500_orchard_trigger_functions_not_rpc.sql", import.meta.url),
  "utf8",
)
const orchardChartsPage = readFileSync(new URL("../app/orchard/charts/page.tsx", import.meta.url), "utf8")
const orchardServiceWorker = readFileSync(new URL("../public/orchard-sw.js", import.meta.url), "utf8")

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

test("new Orchard intelligence and commercial tables stay behind Orchard RLS", () => {
  for (const table of ["orchard_crop_library", "orchard_cultivar_library", "orchard_sales_channels", "orchard_revenue_targets", "orchard_chart_definitions"]) {
    assert.match(orchardReferenceMigration, new RegExp(`alter table public\\.${table} enable row level security`))
  }
  assert.match(orchardReferenceMigration, /can_access_orchard_global\(\)/)
  assert.match(orchardReferenceMigration, /can_access_orchard_succession\(crop_succession_id\)/)
})

test("multi-bed auto placement is RLS-aware and keeps overlap authority in the database", () => {
  assert.match(orchardReferenceMigration, /security invoker/)
  assert.match(orchardReferenceMigration, /can_access_orchard_succession\(p_succession_id\)/)
  assert.match(orchardReferenceMigration, /can_access_orchard_plot\(p_plot_id\)/)
  assert.match(orchardReferenceMigration, /daterange\(a\.planned_start_date, a\.planned_end_date, '\[\]'\)/)
  assert.match(orchardReferenceMigration, /Insufficient conflict-free bed area/)
})

test("custom Orchard charts are whitelist-driven rather than arbitrary SQL", () => {
  assert.match(orchardChartsPage, /const config(?:\s*:\s*Record<[^\n]+>)?\s*=\s*\{harvest:/)
  assert.match(orchardChartsPage, /commercial:\{metrics:/)
  assert.match(orchardChartsPage, /performance:\{metrics:/)
  assert.doesNotMatch(orchardChartsPage, /\.rpc\([^)]*sql/i)
  assert.doesNotMatch(orchardChartsPage, /from\(form\./)
})

test("Orchard trigger helpers are not exposed as client-callable RPCs", () => {
  assert.match(orchardTriggerRpcMigration, /revoke execute on function public\.normalize_orchard_ai_commitment_currency\(\) from public, anon, authenticated/i)
  assert.match(orchardTriggerRpcMigration, /revoke execute on function public\.orchard_lifecycle_trigger\(\) from public, anon, authenticated/i)
})

test("Orchard PWA never caches API responses or offline mutations", () => {
  assert.match(orchardServiceWorker, /if \(request\.method !== "GET"\) return/)
  assert.match(orchardServiceWorker, /url\.pathname\.startsWith\("\/api\/"\)/)
  assert.match(orchardServiceWorker, /request\.mode === "navigate"/)
  assert.doesNotMatch(orchardServiceWorker, /indexedDB|backgroundSync|sync\.register/)
})

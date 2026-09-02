import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const migration = readFileSync(new URL("../supabase/migrations/20260827220000_it_control_center_v1.sql", import.meta.url), "utf8")
const dataHealthMigration = readFileSync(new URL("../supabase/migrations/20260831002000_add_it_data_health_snapshot.sql", import.meta.url), "utf8")
const dataHealthHardeningMigration = readFileSync(new URL("../supabase/migrations/20260831004500_harden_booking_health_and_vehicle_data_health.sql", import.meta.url), "utf8")
const page = readFileSync(new URL("../app/admin/it-control/page.tsx", import.meta.url), "utf8")
const component = readFileSync(new URL("../components/it-control-center.tsx", import.meta.url), "utf8")
const dataHealth = readFileSync(new URL("../components/it-data-health.tsx", import.meta.url), "utf8")
const sidebar = readFileSync(new URL("../components/sidebar.tsx", import.meta.url), "utf8")
const shellTranslations = readFileSync(new URL("../lib/translations/shell.ts", import.meta.url), "utf8")
const deTranslations = readFileSync(new URL("../lib/translations/de.ts", import.meta.url), "utf8")
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8")
const adminPage = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8")
const adminOverview = readFileSync(new URL("../components/admin-overview.tsx", import.meta.url), "utf8")
const legacySecurityPage = readFileSync(new URL("../app/admin/security/page.tsx", import.meta.url), "utf8")

test("IT snapshot is fail-closed and restricted to admin or active IT scope", () => {
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /current_app_role\(\)/)
  assert.match(migration, /v_role in \('none', 'disabled'\)/)
  assert.match(migration, /user_operational_scopes/)
  assert.match(migration, /lower\(coalesce\(s\.department, ''\)\) = 'it'/)
  assert.match(migration, /v_role <> 'admin' and not v_has_it_scope/)
  assert.match(migration, /revoke all on function public\.get_it_control_center_snapshot\(\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.get_it_control_center_snapshot\(\) to authenticated/i)
})

test("IT snapshot exposes live read-only control-plane evidence without error messages", () => {
  assert.match(migration, /private\.get_integration_job_health\(\)/)
  assert.match(migration, /public\.integration_job_runs/)
  assert.match(migration, /pg_policies/)
  assert.match(migration, /user_access_profiles/)
  assert.match(migration, /tables_without_policy_names/)
  assert.doesNotMatch(migration, /'error_message'/)
  assert.doesNotMatch(page, /service_role|SUPABASE_SERVICE_ROLE_KEY/i)
  assert.doesNotMatch(component, /insert\(|update\(|delete\(/i)
})

test("IT data health uses the same fail-closed admin-or-IT authority", () => {
  assert.match(dataHealthMigration, /auth\.uid\(\)/)
  assert.match(dataHealthMigration, /current_app_role\(\)/)
  assert.match(dataHealthMigration, /user_operational_scopes/)
  assert.match(dataHealthMigration, /v_role <> 'admin' and not v_has_it_scope/)
  assert.match(dataHealthMigration, /revoke all on function public\.get_it_data_health_snapshot\(\) from public/)
  assert.match(dataHealthMigration, /revoke all on function public\.get_it_data_health_snapshot\(\) from anon/)
  assert.match(dataHealthMigration, /grant execute on function public\.get_it_data_health_snapshot\(\) to authenticated/)
})

test("data health reports observed canonical coverage without manufacturing a score", () => {
  assert.match(dataHealthMigration, /booking_health_runs/)
  assert.match(dataHealthMigration, /vehicle_registry_health/)
  assert.match(dataHealthMigration, /classification_scheme = 'black_swan_canonical'/)
  assert.match(dataHealthMigration, /classification_code = 'fundo_corcovado'/)
  assert.match(dataHealthMigration, /source_type is not null and t\.source_id is null/)
  assert.match(dataHealth, /These are counts, not synthetic quality scores/)
  assert.match(dataHealth, /Son conteos, no scores sintéticos de calidad/)
  assert.match(dataHealth, /keine synthetischen Qualitätsscores/)
  assert.doesNotMatch(dataHealth, /\.insert\(|\.update\(|\.delete\(/)
})

test("Booking Health is a scheduled observable control-plane job", () => {
  assert.match(dataHealthHardeningMigration, /private\.evaluate_booking_health/)
  assert.match(dataHealthHardeningMigration, /private\.execute_booking_health_snapshot/)
  assert.match(dataHealthHardeningMigration, /private\.run_booking_health_snapshot/)
  assert.match(dataHealthHardeningMigration, /'booking-health-snapshot'/)
  assert.match(dataHealthHardeningMigration, /'5,20,35,50 \* \* \* \*'/)
  assert.match(dataHealthHardeningMigration, /public\.integration_job_runs/)
  assert.match(dataHealthHardeningMigration, /public\.booking_health_runs/)
  assert.match(dataHealthHardeningMigration, /cron\.schedule/)
  assert.match(dataHealthHardeningMigration, /max_attempts[^\n]*,?[\s\S]*?1/)
})

test("vehicle health separates canonical identity from unrecorded external identifiers", () => {
  assert.match(dataHealthHardeningMigration, /canonical_identity_present/)
  assert.match(dataHealthHardeningMigration, /external_identifier_unrecorded/)
  assert.match(dataHealthHardeningMigration, /nullif\(btrim\(v\.code\), ''\) is not null/)
  assert.match(dataHealthHardeningMigration, /v\.plate_number/)
  assert.match(dataHealthHardeningMigration, /v\.vin/)
  assert.match(dataHealthHardeningMigration, /v\.serial_number/)
  assert.match(dataHealth, /ID canónico presente/)
  assert.match(dataHealth, /ID externo no registrado/)
  assert.match(dataHealth, /nunca se infieren/)
})

test("IT route reads both privileged snapshots only from the server client", () => {
  assert.match(page, /@\/lib\/supabase\/server/)
  assert.match(page, /rpc\("get_it_control_center_snapshot"\)/)
  assert.match(page, /rpc\("get_it_data_health_snapshot"\)/)
  assert.match(page, /<ItDataHealth snapshot=\{dataHealth\} \/>/)
  assert.match(page, /dynamic = "force-dynamic"/)
  assert.doesNotMatch(page, /@\/lib\/supabase\/client/)
})

test("navigation exposes IT control only to admin or IT-scoped users", () => {
  assert.match(sidebar, /access\.is_admin \|\| access\.departments\.includes\("it"\)/)
  assert.match(sidebar, /href="\/admin\/it-control"/)
  assert.match(sidebar, /shell\.it_control/)
})

test("German global controls use the labels already established inside their modules", () => {
  assert.match(deTranslations, /'nav\.sovereignty': 'Souveränität'/)
  assert.match(deTranslations, /'nav\.sovereignty_dashboard': 'Souveränität'/)
  assert.match(shellTranslations, /"shell\.it_control": "IT-Kontrollzentrum"/)
  assert.match(component, /de: \{[\s\S]*?title: "IT-Kontrollzentrum"/)
  assert.match(adminOverview, /itTitle: "IT-Kontrollzentrum"/)
})

test("Spanish IT control uses the Administration label consistently", () => {
  assert.match(shellTranslations, /es: \{[\s\S]*?"shell\.it_control": "Centro de control TI"/)
  assert.match(component, /es: \{[\s\S]*?title: "Centro de control TI"/)
  assert.match(adminOverview, /itTitle: "Centro de control TI"/)
})

test("middleware aligns the IT route with the same admin-or-IT policy", () => {
  assert.match(proxy, /isItControlPath\(pathname\)/)
  assert.match(proxy, /if \(isItControlPath\(pathname\)\) return null/)
  assert.match(proxy, /rpc\(\s*"get_current_user_effective_access"/)
  assert.match(proxy, /departments\.includes\("it"\)/)
  assert.match(proxy, /effectiveAccessError \|\| \(!isAdmin && !departments\.includes\("it"\)\)/)
})

test("administration no longer ships stale security KPI theater", () => {
  assert.doesNotMatch(adminPage, /publicTables:\s*129/)
  assert.doesNotMatch(adminPage, /permissiveTables:\s*75/)
  assert.doesNotMatch(adminPage, /verifiedOn:\s*"26-07-2026"/)
  assert.match(adminPage, /href="\/admin\/it-control"/)
  assert.match(legacySecurityPage, /it-control\/page/)
})

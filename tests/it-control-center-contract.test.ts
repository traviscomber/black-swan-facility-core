import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const migration = readFileSync(new URL("../supabase/migrations/20260827220000_it_control_center_v1.sql", import.meta.url), "utf8")
const page = readFileSync(new URL("../app/admin/it-control/page.tsx", import.meta.url), "utf8")
const component = readFileSync(new URL("../components/it-control-center.tsx", import.meta.url), "utf8")
const sidebar = readFileSync(new URL("../components/sidebar.tsx", import.meta.url), "utf8")
const adminPage = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8")
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

test("IT route reads the privileged snapshot only from the server client", () => {
  assert.match(page, /@\/lib\/supabase\/server/)
  assert.match(page, /rpc\("get_it_control_center_snapshot"\)/)
  assert.match(page, /dynamic = "force-dynamic"/)
  assert.doesNotMatch(page, /@\/lib\/supabase\/client/)
})

test("navigation exposes IT control only to admin or IT-scoped users", () => {
  assert.match(sidebar, /access\.is_admin \|\| access\.departments\.includes\("it"\)/)
  assert.match(sidebar, /href="\/admin\/it-control"/)
  assert.match(sidebar, /shell\.it_control/)
})

test("administration no longer ships stale security KPI theater", () => {
  assert.doesNotMatch(adminPage, /publicTables:\s*129/)
  assert.doesNotMatch(adminPage, /permissiveTables:\s*75/)
  assert.doesNotMatch(adminPage, /verifiedOn:\s*"26-07-2026"/)
  assert.match(adminPage, /href="\/admin\/it-control"/)
  assert.match(legacySecurityPage, /it-control\/page/)
})

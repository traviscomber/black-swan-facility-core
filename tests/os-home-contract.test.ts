import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { rankAreasForPersona } from "../lib/os/personas.ts"

const source = readFileSync(new URL("../components/os-home.tsx", import.meta.url), "utf8")
const personaSource = readFileSync(new URL("../lib/os/personas.ts", import.meta.url), "utf8")
const personaHook = readFileSync(new URL("../lib/hooks/use-os-persona.ts", import.meta.url), "utf8")
const osEntry = readFileSync(new URL("../components/os-entry.tsx", import.meta.url), "utf8")
const fieldAdminHome = readFileSync(new URL("../components/field-admin-home.tsx", import.meta.url), "utf8")
const osPage = readFileSync(new URL("../app/os/page.tsx", import.meta.url), "utf8")
const proxySource = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8")
const rootPage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")
const bookingsPage = readFileSync(new URL("../app/bookings/page.tsx", import.meta.url), "utf8")
const hospitalityStrip = readFileSync(new URL("../components/hospitality-command-strip.tsx", import.meta.url), "utf8")
const personaMigration = readFileSync(new URL("../supabase/migrations/20260826204906_add_os_persona_profiles.sql", import.meta.url), "utf8")
const employeeMigration = readFileSync(new URL("../supabase/migrations/20260826210614_link_os_users_to_employees.sql", import.meta.url), "utf8")
const workspaceMigration = readFileSync(new URL("../supabase/migrations/20260826233705_set_os_primary_workspace_profiles.sql", import.meta.url), "utf8")

test("OS home keeps server-authorized navigation as the source of truth", () => {
  assert.match(source, /\/v1\/os\/navigation/)
  assert.match(source, /authorization: `Bearer \$\{token\}`/)
  assert.match(source, /hasNavKey\(navigation/)
})

test("Today is actionable instead of a workspace-only catalog", () => {
  assert.match(source, /Requiere atención/)
  assert.match(source, /Operación de hoy/)
  assert.match(source, /Acciones rápidas/)
  assert.match(source, /finance_approval_queue/)
  assert.match(source, /inventory_stock_status/)
  assert.match(source, /America\/Santiago/)
})

test("area selection is additive and keeps canonical item hrefs", () => {
  assert.match(source, /searchParams\.get\('area'\)/)
  assert.match(source, /href=\{item\.href\}/)
})

test("persona is UX-only and never an authorization primitive", () => {
  assert.match(personaSource, /UX-only ordering/)
  assert.match(personaSource, /MUST preserve every entry/)
  assert.match(personaHook, /UX context only/)
  assert.match(personaMigration, /Never use for authorization/)
  assert.match(workspaceMigration, /Never grants authorization/)
  assert.match(workspaceMigration, /target route is still capability\/RLS protected/)
})

test("Santiago profile is CEO plus Hospitality and starts in the reservation calendar", () => {
  assert.match(workspaceMigration, /os_primary_domain = 'hospitality'/)
  assert.match(workspaceMigration, /os_start_path = '\/bookings'/)
  assert.match(workspaceMigration, /santiago@blackswn\.org/)
  assert.match(personaSource, /CEO · Hospitality/)
  assert.match(personaHook, /os_primary_domain, os_start_path/)
})

test("Hospitality keeps the reservation calendar primary and removes duplicate permanent trays", () => {
  assert.match(bookingsPage, /HospitalityCommandStrip/)
  assert.match(bookingsPage, /BookingOperationsTimelinePage/)
  assert.doesNotMatch(bookingsPage, /DailyOperationsPanel/)
  assert.doesNotMatch(bookingsPage, /CompactBookingQuickActions/)
})

test("Hospitality command strip is read-only and grounded in canonical operational state", () => {
  assert.match(hospitalityStrip, /reservation_room_readiness/)
  assert.match(hospitalityStrip, /reservation_operational_exceptions/)
  assert.match(hospitalityStrip, /hospitality_requests/)
  assert.match(hospitalityStrip, /America\/Santiago/)
  assert.match(hospitalityStrip, /is_ready_for_checkin/)
  assert.match(hospitalityStrip, /blocks_check_in/)
  assert.doesNotMatch(hospitalityStrip, /\.insert\(/)
  assert.doesNotMatch(hospitalityStrip, /\.update\(/)
  assert.doesNotMatch(hospitalityStrip, /\.delete\(/)
})

test("Raimundo field admin gets a dedicated OS desktop instead of Santiago's experience", () => {
  assert.match(osEntry, /persona === 'field_admin'/)
  assert.match(osEntry, /<FieldAdminHome/)
  assert.match(osEntry, /<OsHome/)
  assert.match(osPage, /<OsEntry/)
})

test("field desktop keeps authorized navigation as the gate for every operational query", () => {
  assert.match(fieldAdminHome, /\/v1\/os\/navigation/)
  assert.match(fieldAdminHome, /authorization: `Bearer \$\{token\}`/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'tasks'\)/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'maintenance'\)/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'inventory'\)/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'bookings'\)/)
})

test("Raimundo personal work uses canonical employee assignments and does not fabricate work", () => {
  assert.match(fieldAdminHome, /task_assignments/)
  assert.match(fieldAdminHome, /\.eq\('employee_id', employeeId\)/)
  assert.match(fieldAdminHome, /maintenance_tasks/)
  assert.match(fieldAdminHome, /\.eq\('assigned_to', employeeId\)/)
  assert.match(fieldAdminHome, /housekeeping_tasks/)
  assert.match(fieldAdminHome, /Mi trabajo/)
  assert.match(fieldAdminHome, /No tienes tareas, mantenimiento ni housekeeping asignados directamente/)
  assert.doesNotMatch(fieldAdminHome, /\.insert\(/)
  assert.doesNotMatch(fieldAdminHome, /\.update\(/)
})

test("field desktop puts personal work before field exceptions and workspaces", () => {
  const personalIndex = fieldAdminHome.indexOf('<h2 className="text-lg font-semibold">Mi trabajo</h2>')
  const attentionIndex = fieldAdminHome.indexOf('<h2 className="text-lg font-semibold">Campo requiere atención</h2>')
  const workspacesIndex = fieldAdminHome.indexOf('<h2 className="text-base font-semibold">Workspaces</h2>')
  assert.ok(personalIndex >= 0)
  assert.ok(attentionIndex > personalIndex)
  assert.ok(workspacesIndex > attentionIndex)
})

test("root navigation respects profile start path but still validates route capability", () => {
  assert.match(proxySource, /effectivePathname === "\/"/)
  assert.match(proxySource, /select\("os_start_path"\)/)
  assert.match(proxySource, /getRouteRequirement\(preferredStartPath\)/)
  assert.match(proxySource, /startAllowed \? preferredStartPath : "\/os"/)
})

test("employee identity remains canonical context only", () => {
  assert.match(employeeMigration, /references public\.employees\(id\)/)
  assert.match(employeeMigration, /never grants authorization/)
  assert.doesNotMatch(employeeMigration, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
})

test("persona ordering preserves every already-authorized area", () => {
  const areas = [
    { key: "network" as const },
    { key: "operations" as const },
    { key: "finance" as const },
    { key: "today" as const },
  ]
  const executive = rankAreasForPersona(areas, "executive")
  const fieldAdmin = rankAreasForPersona(areas, "field_admin")

  assert.deepEqual(new Set(executive.map((area) => area.key)), new Set(areas.map((area) => area.key)))
  assert.deepEqual(new Set(fieldAdmin.map((area) => area.key)), new Set(areas.map((area) => area.key)))
  assert.equal(executive[0]?.key, "operations")
  assert.equal(executive[1]?.key, "today")
  assert.equal(fieldAdmin[0]?.key, "today")
  assert.equal(fieldAdmin[1]?.key, "operations")
})

test("app page remains a safe OS fallback when proxy context is unavailable", () => {
  assert.match(rootPage, /redirect\("\/os"\)/)
})

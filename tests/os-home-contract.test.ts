import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { rankAreasForPersona } from "../lib/os/personas.ts"

const source = readFileSync(new URL("../components/os-home.tsx", import.meta.url), "utf8")
const navigationLoader = readFileSync(new URL("../lib/os/authorized-navigation-client.ts", import.meta.url), "utf8")
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
  assert.match(source, /loadAuthorizedNavigation/)
  assert.match(navigationLoader, /\/v1\/os\/navigation/)
  assert.match(navigationLoader, /authorization: `Bearer \$\{token\}`/)
  assert.match(navigationLoader, /rpc\('get_current_route_access'\)/)
  assert.match(navigationLoader, /filterOsAreas\(osAreas, normalizeCapabilitySnapshot\(routeAccess\)/)
  assert.match(navigationLoader, /rpc\('get_black_swan_os_navigation'\)/)
  assert.match(navigationLoader, /const merged = new Map/)
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

test("Santiago sees canonical invoice approvals from Hospitality only when finance approval is allowed", () => {
  assert.match(hospitalityStrip, /rpc\("can_finance_approve"\)/)
  assert.match(hospitalityStrip, /finance_approval_queue/)
  assert.match(hospitalityStrip, /eq\("approval_status", "ready"\)/)
  assert.match(hospitalityStrip, /canApproveFinance && <PulseLink/)
  assert.match(hospitalityStrip, /href="\/budgets\/approvals"/)
  assert.match(hospitalityStrip, /label="Aprobaciones"/)
  assert.doesNotMatch(hospitalityStrip, /approve_finance_document/)
  assert.doesNotMatch(hospitalityStrip, /reject_finance_document/)
})

test("Hospitality finance pulse fails closed without taking the reservation cockpit down", () => {
  assert.match(hospitalityStrip, /const financeAllowed = !financePermissionResult\.error && Boolean\(financePermissionResult\.data\)/)
  assert.match(hospitalityStrip, /const firstError = arrivalsResult\.error \|\| departuresResult\.error \|\| requestsResult\.error \|\| exceptionsResult\.error/)
  assert.match(hospitalityStrip, /financeResult\.error \? null : financeResult\.count \?\? 0/)
  assert.doesNotMatch(hospitalityStrip, /setError\(financePermissionResult\.error\.message\)/)
})

test("Raimundo field admin gets a dedicated OS desktop instead of Santiago's experience", () => {
  assert.match(osEntry, /persona === 'field_admin'/)
  assert.match(osEntry, /<FieldAdminHome/)
  assert.match(osEntry, /<OsHome/)
  assert.match(osPage, /<OsEntry/)
})

test("field desktop keeps authorized navigation as the gate for every operational query", () => {
  assert.match(fieldAdminHome, /loadAuthorizedNavigation/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'tasks'\)/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'maintenance'\)/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'issues'\)/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'inventory'\)/)
  assert.match(fieldAdminHome, /hasNavKey\(nav, 'bookings'\)/)
})

test("Raimundo invoice approvals are permission checked, grouped by cost center and always one click away", () => {
  assert.match(fieldAdminHome, /rpc\('can_finance_approve'\)/)
  assert.match(fieldAdminHome, /finance_approval_queue/)
  assert.match(fieldAdminHome, /approval_status', 'ready'/)
  assert.match(fieldAdminHome, /operational_label \|\| row\.cost_center_name/)
  assert.match(fieldAdminHome, /Facturas por aprobar/)
  assert.match(fieldAdminHome, /agrupados por centro de costo/)
  assert.match(fieldAdminHome, /Revisar aprobaciones/)
  assert.match(fieldAdminHome, /href="\/budgets\/approvals"/)
  assert.doesNotMatch(fieldAdminHome, /approve_finance_document/)
  assert.doesNotMatch(fieldAdminHome, /reject_finance_document/)
})

test("field finance pulse degrades independently from field operations", () => {
  assert.match(fieldAdminHome, /const financeAllowed = !financePermissionResult\.error && Boolean\(financePermissionResult\.data\)/)
  assert.match(fieldAdminHome, /setFinanceLoadError\(financeResult\.error\.message\)/)
  assert.match(fieldAdminHome, /La cola canónica de aprobaciones sigue disponible/)
  assert.doesNotMatch(fieldAdminHome, /if \(financePermissionResult\.error\) throw financePermissionResult\.error/)
  assert.doesNotMatch(fieldAdminHome, /if \(financeResult\.error\) throw financeResult\.error/)
})

test("Raimundo unified work keeps canonical assignments and turns unlinked issues into triage", () => {
  assert.match(fieldAdminHome, /task_assignments/)
  assert.match(fieldAdminHome, /\.eq\('employee_id', employeeId\)/)
  assert.match(fieldAdminHome, /maintenance_tasks/)
  assert.match(fieldAdminHome, /\.eq\('assigned_to', employeeId\)/)
  assert.match(fieldAdminHome, /housekeeping_tasks/)
  assert.match(fieldAdminHome, /issue_task_assignments\(task_id\)/)
  assert.match(fieldAdminHome, /\.filter\(\(item\) => \(item\.issue_task_assignments \?\? \[\]\)\.length === 0\)/)
  assert.match(fieldAdminHome, /kind: 'issue' as const/)
  assert.match(fieldAdminHome, /scope: 'triage' as const/)
  assert.match(fieldAdminHome, /sortWorkItems\(personal, today\)/)
  assert.match(fieldAdminHome, /workFilter/)
  assert.match(fieldAdminHome, /Una sola cola para tareas, mantenimiento, housekeeping e incidencias/)
  assert.match(fieldAdminHome, /No tienes trabajo asignado ni incidencias pendientes de triaje/)
  assert.doesNotMatch(fieldAdminHome, /\.insert\(/)
  assert.doesNotMatch(fieldAdminHome, /\.update\(/)
})

test("field desktop puts invoice decisions before personal work, field exceptions and workspaces", () => {
  const financeIndex = fieldAdminHome.indexOf('<h2 className="text-lg font-semibold">Facturas por aprobar</h2>')
  const personalIndex = fieldAdminHome.indexOf('<h2 className="text-lg font-semibold">Mi trabajo</h2>')
  const attentionIndex = fieldAdminHome.indexOf('<h2 className="text-lg font-semibold">Campo requiere atención</h2>')
  const workspacesIndex = fieldAdminHome.indexOf('<h2 className="text-base font-semibold">Workspaces</h2>')
  assert.ok(financeIndex >= 0)
  assert.ok(personalIndex > financeIndex)
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

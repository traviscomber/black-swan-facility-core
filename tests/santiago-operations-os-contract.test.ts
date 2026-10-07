import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const osHome = readFileSync(new URL("../components/os-home.tsx", import.meta.url), "utf8")
const cockpit = readFileSync(new URL("../components/santiago-operations-cockpit.tsx", import.meta.url), "utf8")

test("Santiago OS prioritizes booking and staff before cross-module alerts", () => {
  const cockpitIndex = osHome.indexOf("<SantiagoOperationsCockpit")
  const alertsIndex = osHome.indexOf("systemAlertsTitle")
  assert.ok(cockpitIndex >= 0)
  assert.ok(alertsIndex >= 0)
  assert.match(osHome, /persona === 'santiago'/)
  assert.match(osHome, /Alertas del sistema/)
  assert.match(osHome, /Excepciones activas de todos los módulos autorizados/)
})

test("Santiago cockpit uses canonical booking calendar and staff tasks", () => {
  assert.match(cockpit, /from\('reservations'\)/)
  assert.match(cockpit, /check_in/)
  assert.match(cockpit, /check_out/)
  assert.match(cockpit, /\/bookings\/calendar/)
  assert.match(cockpit, /from\('tasks'\)/)
  assert.match(cockpit, /task_assignments\(employee_id,employees\(id,name,role\)\)/)
  assert.match(cockpit, /\/tasks\?new=1/)
  assert.match(cockpit, /\/tasks\?selected=/)
})

test("Santiago staff cockpit excludes demo and Asana snapshot work", () => {
  assert.match(cockpit, /startsWith\('\[DEMO\]'\)/)
  assert.match(cockpit, /startsWith\('asana_import'\)/)
  assert.match(cockpit, /startsWith\('Asana ·'\)/)
  assert.match(cockpit, /task_assignments\?\.some/)
})

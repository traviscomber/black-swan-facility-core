import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const osHome = readFileSync(new URL("../components/os-home.tsx", import.meta.url), "utf8")
const cockpit = readFileSync(new URL("../components/santiago-operations-cockpit.tsx", import.meta.url), "utf8")
const addTaskDialog = readFileSync(new URL("../components/add-task-dialog.tsx", import.meta.url), "utf8")

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


test("Santiago can turn an upcoming booking into a traced hospitality task", () => {
  assert.match(cockpit, /sourceType: 'hospitality_request'/)
  assert.match(cockpit, /template: 'hosp-checkin'/)
  assert.match(cockpit, /area: 'hospitalidad'/)
  assert.match(cockpit, /dueDate: booking\.check_in/)
  assert.match(cockpit, /arrivalTaskHref\(booking, language\)/)
  assert.match(cockpit, /Preparar llegada/)
})


test("Santiago booking and task flow is mobile-first", () => {
  assert.match(cockpit, /snap-x snap-mandatory overflow-x-auto/)
  assert.match(cockpit, /h-11 flex-1 sm:h-9/)
  assert.match(addTaskDialog, /h-\[100dvh\].*w-screen/)
  assert.match(addTaskDialog, /Más opciones/)
  assert.match(addTaskDialog, /sticky bottom-0/)
  assert.match(addTaskDialog, /min-h-12 cursor-pointer/)
})

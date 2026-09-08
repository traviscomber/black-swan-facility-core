import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../components/field-admin-home.tsx", import.meta.url), "utf8")

test("field dashboard mirrors Asana-style due-date organization with Today first", () => {
  assert.match(source, /type TaskDateBucket = 'today' \| 'overdue' \| 'upcoming' \| 'later' \| 'unscheduled'/)
  assert.match(source, /TASK_DATE_BUCKET_ORDER: TaskDateBucket\[\] = \['today', 'overdue', 'upcoming', 'later', 'unscheduled'\]/)
  assert.match(source, /Filtrar tareas por fecha/)
  assert.match(source, /taskDateBucket/)
  assert.match(source, /sortDashboardTasks\(nextTasks, today\)/)
  assert.match(source, /Hoy/)
  assert.match(source, /Vencidas/)
  assert.match(source, /Próximas/)
  assert.match(source, /Más tarde/)
  assert.match(source, /Sin fecha/)
})

test("date filtering changes presentation only and keeps Asana-first consolidation read-only", () => {
  assert.match(source, /taskDateFilter/)
  assert.match(source, /visibleTaskBuckets/)
  assert.match(source, /source: 'asana'/)
  assert.match(source, /source: 'system'/)
  assert.doesNotMatch(source, /\.insert\(/)
  assert.doesNotMatch(source, /\.update\(/)
})

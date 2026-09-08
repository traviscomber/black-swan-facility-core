import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const asanaLive = readFileSync(new URL("../app/asana-live/page.tsx", import.meta.url), "utf8")
const taskDetail = readFileSync(new URL("../components/task-detail-panel.tsx", import.meta.url), "utf8")

test("live Asana evidence separates current, legacy, private and unclassified observations", () => {
  assert.match(asanaLive, /type RecencyFilter = "all" \| "current_2026" \| "legacy_open" \| "browser_only" \| "unclassified"/)
  assert.match(asanaLive, /These counts are evidence classes, not a total of current tasks/)
  assert.match(asanaLive, /Estos conteos son clases de evidencia, no un total de tareas actuales/)
  assert.doesNotMatch(asanaLive, /value=\{observations\.length\}/)
  assert.match(asanaLive, /observationClass\(row\) === recencyFilter/)
  assert.match(asanaLive, /current2026Count/)
  assert.match(asanaLive, /legacyOpenCount/)
  assert.match(asanaLive, /privateObservedCount/)
  assert.match(asanaLive, /unclassifiedCount/)
})

test("historical Asana snapshots remain read-only in task details", () => {
  assert.match(taskDetail, /isHistoricalAsanaSnapshot/)
  assert.match(taskDetail, /const readOnlyAsanaSnapshot = isHistoricalAsanaSnapshot\(task\)/)
  assert.match(taskDetail, /if \(readOnlyAsanaSnapshot \|\| status === task\.status\) return/)
  assert.match(taskDetail, /if \(readOnlyAsanaSnapshot\) return/)
  assert.match(taskDetail, /Snapshot histórico de Asana · sólo lectura/)
  assert.match(taskDetail, /!readOnlyAsanaSnapshot && <Button variant="outline" size="icon" onClick=\{\(\) => onEdit\(task\)\}/)
  assert.match(taskDetail, /Estado histórico/)
  assert.match(taskDetail, /No editable/)
})

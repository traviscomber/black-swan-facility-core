import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const asanaHistory = readFileSync(new URL("../app/asana-live/page.tsx", import.meta.url), "utf8")
const asanaSync = readFileSync(new URL("../app/api/asana-live/sync/route.ts", import.meta.url), "utf8")
const taskDetail = readFileSync(new URL("../components/task-detail-panel.tsx", import.meta.url), "utf8")

test("historical Asana evidence is explicitly separated from current work", () => {
  assert.match(asanaHistory, /Histórico Asana/)
  assert.match(asanaHistory, /No se usa para calcular tus tareas vigentes/)
  assert.match(asanaHistory, /Archivo · sólo lectura/)
  assert.match(asanaHistory, /asana_live_observations/)
  assert.doesNotMatch(asanaHistory, /\/api\/asana-live\/sync/)
})

test("historical Asana uses canonical identity links instead of local-part guessing", () => {
  assert.match(asanaHistory, /asana_identity_links/)
  assert.match(asanaHistory, /select\("asana_email"\)/)
  assert.match(asanaHistory, /function belongsToIdentity/)
  assert.doesNotMatch(asanaHistory, /ASANA_EMAIL_BY_EMPLOYEE/)
  assert.doesNotMatch(asanaHistory, /function localPart/)
})

test("current Asana API state is persisted separately from historical observation evidence", () => {
  assert.match(asanaSync, /\.from\("asana_current_tasks"\)/)
  assert.match(asanaSync, /upsert\(currentRows, \{ onConflict: "external_task_id" \}\)/)
  assert.doesNotMatch(asanaSync, /\.from\("asana_live_observations"\)/)
  assert.match(asanaSync, /created_at_source/)
  assert.match(asanaSync, /last_synced_at/)
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

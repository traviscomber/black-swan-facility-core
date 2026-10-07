import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const myTasks = readFileSync(new URL("../app/my-tasks/page.tsx", import.meta.url), "utf8")
const detail = readFileSync(new URL("../components/task-detail-panel.tsx", import.meta.url), "utf8")
const migration = readFileSync(new URL("../supabase/migrations/20261007203000_people_assigned_task_execution.sql", import.meta.url), "utf8")

test("personal task workspace defaults to today's actionable work", () => {
  assert.match(myTasks, /type ViewTab = "hoy" \| "pendientes" \| "completadas" \| "todas"/)
  assert.match(myTasks, /useState<ViewTab>\("hoy"\)/)
  assert.match(myTasks, /tabToday/)
  assert.match(myTasks, /requiresAttentionToday/)
  assert.match(myTasks, /mode="execute"/)
})

test("worker execution mode exposes narrow start, evidence and completion actions", () => {
  assert.match(detail, /mode\?: "manage" \| "execute"/)
  assert.match(detail, /update_assigned_operational_task_status/)
  assert.match(detail, /capture="environment"/)
  assert.match(detail, /Iniciar tarea/)
  assert.match(detail, /Finalizar tarea/)
})

test("assigned worker status RPC only permits forward execution transitions", () => {
  assert.match(migration, /p_status not in \('en_progreso','completada'\)/)
  assert.match(migration, /a\.employee_id = v_employee_id/)
  assert.match(migration, /v_old_status = 'nueva' and p_status = 'en_progreso'/)
  assert.match(migration, /v_old_status = 'en_progreso' and p_status = 'completada'/)
  assert.match(migration, /can_access_task_evidence_storage/)
})

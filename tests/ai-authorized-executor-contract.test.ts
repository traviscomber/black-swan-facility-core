import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { parseAuthorizedAction } from "../lib/ai/authorized-executor.ts"

const migration = readFileSync(
  new URL("../supabase/migrations/20260908131500_create_ai_action_executor_v1.sql", import.meta.url),
  "utf8",
)
const route = readFileSync(new URL("../app/api/ai/orchestrate/route.ts", import.meta.url), "utf8")

test("authorized action parser only recognizes explicit internal task creation", () => {
  assert.deepEqual(parseAuthorizedAction("Crea una tarea para revisar la bomba norte"), {
    capability: "task.create_internal",
    title: "revisar la bomba norte",
    description: null,
  })
  assert.deepEqual(parseAuthorizedAction("Create an internal task to inspect the north pump"), {
    capability: "task.create_internal",
    title: "inspect the north pump",
    description: null,
  })
  assert.equal(parseAuthorizedAction("Aprueba la orden de compra 42"), null)
  assert.equal(parseAuthorizedAction("Elimina la tarea 42"), null)
  assert.equal(parseAuthorizedAction("Envía un correo al proveedor"), null)
})

test("proposal envelope is owner-bound, expiring and immutable from authenticated clients", () => {
  assert.match(migration, /created_by uuid not null default auth\.uid\(\)/i)
  assert.match(migration, /expires_at timestamptz not null default \(now\(\) \+ interval '15 minutes'\)/i)
  assert.match(migration, /revoke all on table public\.ai_action_proposals from anon, authenticated/i)
  assert.match(migration, /grant select on table public\.ai_action_proposals to authenticated/i)
  assert.match(migration, /using \(created_by = auth\.uid\(\)\)/i)
})

test("executor has a static capability allowlist and revalidates access and operational scope", () => {
  assert.match(migration, /capability in \('task\.create_internal'\)/i)
  assert.match(migration, /v_proposal\.capability <> 'task\.create_internal'/i)
  assert.match(migration, /ai_agentic_access[\s\S]*enabled = true/i)
  assert.match(migration, /can_access_operational_task_scope\(v_operational_area, v_location_id\)/i)
  assert.doesNotMatch(migration, /execute\s+format|execute\s+v_|http|net\.http|pg_net/i)
})

test("execution is one-time and records terminal success or failure", () => {
  assert.match(migration, /for update;/i)
  assert.match(migration, /v_proposal\.status <> 'awaiting_confirmation'/i)
  assert.match(migration, /set status = 'executing'/i)
  assert.match(migration, /set status = 'succeeded'/i)
  assert.match(migration, /set status = 'failed'/i)
  assert.match(migration, /set status = 'expired'/i)
})

test("task execution remains deliberately low-risk", () => {
  assert.match(migration, /insert into public\.tasks\(title, description, status, location_id, operational_area\)/i)
  assert.match(migration, /values \(v_title, v_description, 'nueva', v_location_id, v_operational_area\)/i)
  assert.doesNotMatch(migration, /assigned_to|estimated_cost_clp|purchase|invoice|payment|email|webhook/i)
})

test("confirmation carries only proposal identity rather than a replacement action payload", () => {
  assert.match(route, /proposalId/)
  assert.match(route, /explicit_confirmation_required/)
  assert.match(route, /execute_ai_action_proposal/)
  assert.match(route, /blocked_unsupported_capability/)
  assert.doesNotMatch(route, /execute_ai_action_proposal[\s\S]{0,300}p_payload/i)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { parseAuthorizedAction } from "../lib/ai/authorized-executor.ts"

const nullLocationMigration = readFileSync(
  new URL("../supabase/migrations/20260827184610_fail_closed_null_operational_scope.sql", import.meta.url),
  "utf8",
)
const activeProfileMigration = readFileSync(
  new URL("../supabase/migrations/20260827184757_fail_closed_missing_operational_profile.sql", import.meta.url),
  "utf8",
)
const orchardWorkPage = readFileSync(new URL("../app/orchard/work/page.tsx", import.meta.url), "utf8")
const orchardTaskSourceMigration = readFileSync(
  new URL("../supabase/migrations/20260829144501_allow_orchard_task_source_types.sql", import.meta.url),
  "utf8",
)
const orchardReferenceMigration = readFileSync(
  new URL("../supabase/migrations/20260829152000_orchard_reference_gaps_1_4.sql", import.meta.url),
  "utf8",
)
const orchardTriggerRpcMigration = readFileSync(
  new URL("../supabase/migrations/20260829234905_orchard_trigger_functions_not_rpc.sql", import.meta.url),
  "utf8",
)
const orchardChartsPage = readFileSync(new URL("../app/orchard/charts/page.tsx", import.meta.url), "utf8")
const orchardServiceWorker = readFileSync(new URL("../public/orchard-sw.js", import.meta.url), "utf8")
const aiExecutorMigration = readFileSync(
  new URL("../supabase/migrations/20260908131500_create_ai_action_executor_v1.sql", import.meta.url),
  "utf8",
)
const aiOrchestrateRoute = readFileSync(new URL("../app/api/ai/orchestrate/route.ts", import.meta.url), "utf8")

test("location-specific operational scopes fail closed when an object has no location", () => {
  assert.match(nullLocationMigration, /s\.location_id is null/)
  assert.match(nullLocationMigration, /p_location_id is not null and s\.location_id=p_location_id/)
  assert.doesNotMatch(nullLocationMigration, /or p_location_id is null/)
})

test("operational scope denies users without an active access profile", () => {
  assert.match(activeProfileMigration, /v_role in \('none','disabled'\) then return false/)
  assert.match(activeProfileMigration, /current_app_role\(\)/)
  assert.match(activeProfileMigration, /auth\.uid\(\)/)
})

test("operational scope hardening preserves service and admin boundaries", () => {
  assert.match(activeProfileMigration, /auth\.role\(\)/)
  assert.match(activeProfileMigration, /'service_role'/)
  assert.match(activeProfileMigration, /v_role = 'admin'/)
  assert.match(activeProfileMigration, /p_location_id is not null and s\.location_id=p_location_id/)
})

test("every Orchard task source emitted by the Work cockpit is accepted by the database contract", () => {
  const uiSources = [...new Set([...orchardWorkPage.matchAll(/["`](orchard_(?:general|succession(?:_(?:sow|transplant|harvest))?))["`]/g)].map((match) => match[1]))].sort()
  assert.deepEqual(uiSources, [
    "orchard_general",
    "orchard_succession",
    "orchard_succession_harvest",
    "orchard_succession_sow",
    "orchard_succession_transplant",
  ])
  for (const source of uiSources) assert.match(orchardTaskSourceMigration, new RegExp(`'${source}'::text`))
})

test("new Orchard intelligence and commercial tables stay behind Orchard RLS", () => {
  for (const table of ["orchard_crop_library", "orchard_cultivar_library", "orchard_sales_channels", "orchard_revenue_targets", "orchard_chart_definitions"]) {
    assert.match(orchardReferenceMigration, new RegExp(`alter table public\\.${table} enable row level security`))
  }
  assert.match(orchardReferenceMigration, /can_access_orchard_global\(\)/)
  assert.match(orchardReferenceMigration, /can_access_orchard_succession\(crop_succession_id\)/)
})

test("multi-bed auto placement is RLS-aware and keeps overlap authority in the database", () => {
  assert.match(orchardReferenceMigration, /security invoker/)
  assert.match(orchardReferenceMigration, /can_access_orchard_succession\(p_succession_id\)/)
  assert.match(orchardReferenceMigration, /can_access_orchard_plot\(p_plot_id\)/)
  assert.match(orchardReferenceMigration, /daterange\(a\.planned_start_date, a\.planned_end_date, '\[\]'\)/)
  assert.match(orchardReferenceMigration, /Insufficient conflict-free bed area/)
})

test("custom Orchard charts are whitelist-driven rather than arbitrary SQL", () => {
  assert.match(orchardChartsPage, /const config(?:\s*:\s*Record<[^\n]+>)?\s*=\s*\{harvest:/)
  assert.match(orchardChartsPage, /commercial:\{metrics:/)
  assert.match(orchardChartsPage, /performance:\{metrics:/)
  assert.doesNotMatch(orchardChartsPage, /\.rpc\([^)]*sql/i)
  assert.doesNotMatch(orchardChartsPage, /from\(form\./)
})

test("Orchard trigger helpers are not exposed as client-callable RPCs", () => {
  assert.match(orchardTriggerRpcMigration, /revoke execute on function public\.normalize_orchard_ai_commitment_currency\(\) from public, anon, authenticated/i)
  assert.match(orchardTriggerRpcMigration, /revoke execute on function public\.orchard_lifecycle_trigger\(\) from public, anon, authenticated/i)
})

test("Orchard PWA never caches API responses or offline mutations", () => {
  assert.match(orchardServiceWorker, /if \(request\.method !== "GET"\) return/)
  assert.match(orchardServiceWorker, /url\.pathname\.startsWith\("\/api\/"\)/)
  assert.match(orchardServiceWorker, /request\.mode === "navigate"/)
  assert.doesNotMatch(orchardServiceWorker, /indexedDB|backgroundSync|sync\.register/)
})

test("AI executor recognizes only explicit low-risk internal task creation", () => {
  assert.deepEqual(parseAuthorizedAction("Crea una tarea para revisar la bomba norte"), {
    capability: "task.create_internal",
    title: "revisar la bomba norte",
    description: null,
  })
  assert.deepEqual(parseAuthorizedAction("Cree una tarea para revisar la bomba norte"), {
    capability: "task.create_internal",
    title: "revisar la bomba norte",
    description: null,
  })
  assert.equal(parseAuthorizedAction("Aprueba la orden de compra 42"), null)
  assert.equal(parseAuthorizedAction("Elimina la tarea 42"), null)
  assert.equal(parseAuthorizedAction("Envía un correo al proveedor"), null)
})

test("AI proposals are owner-bound, expiring and not directly writable by authenticated clients", () => {
  assert.match(aiExecutorMigration, /created_by uuid not null default auth\.uid\(\)/i)
  assert.match(aiExecutorMigration, /expires_at timestamptz not null default \(now\(\) \+ interval '15 minutes'\)/i)
  assert.match(aiExecutorMigration, /revoke all on table public\.ai_action_proposals from anon, authenticated/i)
  assert.match(aiExecutorMigration, /grant select on table public\.ai_action_proposals to authenticated/i)
  assert.match(aiExecutorMigration, /using \(created_by = auth\.uid\(\)\)/i)
})

test("AI executor is static-allowlisted, scope-aware and replay-resistant", () => {
  assert.match(aiExecutorMigration, /capability in \('task\.create_internal'\)/i)
  assert.match(aiExecutorMigration, /v_proposal\.capability <> 'task\.create_internal'/i)
  assert.match(aiExecutorMigration, /ai_agentic_access[\s\S]*enabled = true/i)
  assert.match(aiExecutorMigration, /can_access_operational_task_scope\(v_operational_area, v_location_id\)/i)
  assert.match(aiExecutorMigration, /for update;/i)
  assert.match(aiExecutorMigration, /v_proposal\.status <> 'awaiting_confirmation'/i)
  assert.doesNotMatch(aiExecutorMigration, /execute\s+format|execute\s+v_|net\.http|pg_net/i)
})

test("AI task execution remains low-risk and terminal state is audited", () => {
  assert.match(aiExecutorMigration, /insert into public\.tasks\(title, description, status, location_id, operational_area\)/i)
  assert.match(aiExecutorMigration, /values \(v_title, v_description, 'nueva', v_location_id, v_operational_area\)/i)
  assert.match(aiExecutorMigration, /set status = 'executing'/i)
  assert.match(aiExecutorMigration, /set status = 'succeeded'/i)
  assert.match(aiExecutorMigration, /set status = 'failed'/i)
  assert.match(aiExecutorMigration, /set status = 'expired'/i)
  assert.doesNotMatch(aiExecutorMigration, /assigned_to|estimated_cost_clp|purchase|invoice|payment|webhook/i)
})

test("AI confirmation is bound to proposal identity and unsupported capabilities fail closed", () => {
  assert.match(aiOrchestrateRoute, /proposalId/)
  assert.match(aiOrchestrateRoute, /explicit_confirmation_required/)
  assert.match(aiOrchestrateRoute, /execute_ai_action_proposal/)
  assert.match(aiOrchestrateRoute, /blocked_unsupported_capability/)
  assert.doesNotMatch(aiOrchestrateRoute, /execute_ai_action_proposal[\s\S]{0,300}p_payload/i)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { classifyCentralAIMode } from "../lib/ai/central-router"

const routeSource = readFileSync(new URL("../app/api/ai/orchestrate/route.ts", import.meta.url), "utf8")
const routerSource = readFileSync(new URL("../lib/ai/central-router.ts", import.meta.url), "utf8")
const canonicalContextSource = readFileSync(new URL("../lib/ai/canonical-context.ts", import.meta.url), "utf8")
const accessMigrationSource = readFileSync(
  new URL("../supabase/migrations/20260908143000_ai_agentic_access.sql", import.meta.url),
  "utf8",
)
const accessAclMigrationSource = readFileSync(
  new URL("../supabase/migrations/20260908162000_harden_ai_agentic_access_acl.sql", import.meta.url),
  "utf8",
)

test("central AI router keeps trivial interactions deterministic", () => {
  assert.equal(classifyCentralAIMode("Hola"), "DIRECT")
  assert.equal(classifyCentralAIMode("Gracias!"), "DIRECT")
})

test("central AI router sends read-only reasoning to FASTTRACK", () => {
  assert.equal(classifyCentralAIMode("Analiza el estado operativo de esta semana"), "FASTTRACK")
  assert.equal(classifyCentralAIMode("Cómo crear una tarea en Asana?"), "FASTTRACK")
})

test("central AI router forces requested side effects through FULL_AGENTIC", () => {
  assert.equal(classifyCentralAIMode("Crea una tarea para mañana"), "FULL_AGENTIC")
  assert.equal(classifyCentralAIMode("Cree una tarea para revisar la bomba"), "FULL_AGENTIC")
  assert.equal(classifyCentralAIMode("Puedes enviar este resumen al equipo?"), "FULL_AGENTIC")
  assert.equal(classifyCentralAIMode("Necesito que actualices la reserva"), "FULL_AGENTIC")
})

test("FULL_AGENTIC requires an explicit per-user grant", () => {
  assert.match(routeSource, /from\(["']ai_agentic_access["']\)/)
  assert.match(routeSource, /select\(["']enabled["']\)/)
  assert.match(routeSource, /eq\(["']user_id["'], user\.id\)/)
  assert.match(routeSource, /agentic_access_denied/)
  assert.match(routeSource, /status: 403/)
  assert.match(routeSource, /agentic_access_check_failed/)
  assert.match(accessMigrationSource, /auth\.uid\(\) = user_id/)
  assert.match(accessMigrationSource, /santiago@blackswn\.org/)
  assert.match(accessMigrationSource, /tomas@blackswn\.org/)
  assert.match(accessMigrationSource, /juan@n3uralia\.com/)
  assert.match(accessMigrationSource, /raimundo@blackswn\.org/)
})

test("agentic access registry is read-only and self-scoped for authenticated clients", () => {
  assert.match(accessAclMigrationSource, /revoke all on table public\.ai_agentic_access from anon/i)
  assert.match(
    accessAclMigrationSource,
    /revoke insert, update, delete, truncate, references, trigger on table public\.ai_agentic_access from authenticated/i,
  )
  assert.match(accessAclMigrationSource, /grant select on table public\.ai_agentic_access to authenticated/i)
  assert.match(accessAclMigrationSource, /for select[\s\S]*to authenticated[\s\S]*auth\.uid\(\)\) = user_id/i)
})

test("FULL_AGENTIC only executes the allowlisted internal task capability after explicit proposal confirmation", () => {
  assert.match(routeSource, /proposalId/)
  assert.match(routeSource, /explicit_confirmation_required/)
  assert.match(routeSource, /execute_ai_action_proposal/)
  assert.match(routeSource, /create_ai_task_proposal/)
  assert.match(routeSource, /blocked_unsupported_capability/)
  assert.doesNotMatch(routerSource, /agentService\.executeAgentAction/)
  assert.doesNotMatch(routerSource, /concierge\/webhook/)
  assert.doesNotMatch(routerSource, /GREEN_API|sendMessage/)
})

test("server AI calls remain on the canonical direct Responses API wrapper", () => {
  assert.match(routerSource, /callOpenAIDirect/)
  assert.doesNotMatch(routerSource, /from ["']ai["']/)
  assert.doesNotMatch(routeSource, /from ["']ai["']/)
})

test("orchestration authenticates with Supabase but does not send user identifiers to the model", () => {
  assert.match(routeSource, /supabase\.auth\.getUser\(\)/)
  assert.match(routeSource, /status: 401/)
  assert.match(routeSource, /authorization:\s*\{ authenticated: true \}/)
  assert.doesNotMatch(routeSource, /email:\s*user\.email/)
  assert.doesNotMatch(routeSource, /context:\s*\{[\s\S]*id:\s*user\.id/)
})

test("FASTTRACK and FULL_AGENTIC receive bounded capability-scoped canonical OS evidence", () => {
  assert.match(routeSource, /if \(mode !== ["']DIRECT["']\)/)
  assert.match(routeSource, /buildCentralAICanonicalContext\(supabase, mode\)/)
  assert.match(canonicalContextSource, /get_current_route_access/)
  assert.match(canonicalContextSource, /normalizeCapabilitySnapshot/)
  assert.match(canonicalContextSource, /hasCapability\(capabilities, ["']booking["'], ["']view["']\)/)
  assert.match(canonicalContextSource, /hasCapability\(capabilities, ["']maintenance["'], ["']view["']\)/)
  assert.match(canonicalContextSource, /hasCapability\(capabilities, ["']procurement["'], ["']view["']\)/)
  assert.match(canonicalContextSource, /hasCapability\(capabilities, ["']operations["'], ["']view["']\)/)
  assert.match(canonicalContextSource, /hasCapability\(capabilities, ["']finance["'], ["']view["']\)/)
  assert.match(canonicalContextSource, /const ROW_LIMIT = 5/)
  assert.match(canonicalContextSource, /attention: attention\.slice\(0, 20\)/)
})

test("canonical AI context mirrors the OS attention surfaces and degrades explicitly", () => {
  for (const source of [
    "reservation_operational_exceptions",
    "finance_approval_queue",
    "maintenance_tasks",
    "procurement_requests",
    "tasks",
    "issues",
  ]) {
    assert.match(canonicalContextSource, new RegExp(source))
  }
  assert.match(canonicalContextSource, /unavailableSources/)
  assert.match(canonicalContextSource, /America\/Santiago/)
  assert.match(routerSource, /DATO OBSERVADO/)
  assert.match(routerSource, /INTERPRETACION/)
  assert.match(routerSource, /PROPUESTA/)
  assert.match(routerSource, /Nunca interpretes una fuente ausente o unavailableSources como cero/)
  assert.doesNotMatch(canonicalContextSource, /select\([^\n]*(email|phone|user_id|auth_id|token|secret)/i)
})

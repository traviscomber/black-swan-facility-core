import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { classifyCentralAIMode } from "../lib/ai/central-router"

const routeSource = readFileSync(new URL("../app/api/ai/orchestrate/route.ts", import.meta.url), "utf8")
const routerSource = readFileSync(new URL("../lib/ai/central-router.ts", import.meta.url), "utf8")

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
  assert.equal(classifyCentralAIMode("Puedes enviar este resumen al equipo?"), "FULL_AGENTIC")
  assert.equal(classifyCentralAIMode("Necesito que actualices la reserva"), "FULL_AGENTIC")
})

test("FULL_AGENTIC is confirmation-gated and cannot execute external effects yet", () => {
  assert.match(routeSource, /mode === ["']FULL_AGENTIC["'] && confirmed/)
  assert.match(routeSource, /execution_not_enabled/)
  assert.match(routeSource, /blocked_no_authorized_executor/)
  assert.doesNotMatch(routerSource, /agentService\.executeAgentAction/)
  assert.doesNotMatch(routerSource, /concierge\/webhook/)
  assert.doesNotMatch(routerSource, /GREEN_API|sendMessage/)
})

test("server AI calls remain on the canonical direct Responses API wrapper", () => {
  assert.match(routerSource, /callOpenAIDirect/)
  assert.doesNotMatch(routerSource, /from ["']ai["']/)
  assert.doesNotMatch(routeSource, /from ["']ai["']/)
})

test("orchestration API requires authenticated Supabase user context", () => {
  assert.match(routeSource, /supabase\.auth\.getUser\(\)/)
  assert.match(routeSource, /status: 401/)
  assert.match(routeSource, /user:\s*\{[\s\S]*id: user\.id,[\s\S]*email: user\.email/)
})

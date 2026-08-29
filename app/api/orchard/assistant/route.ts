import { createClient } from "@/lib/supabase/server"
import { getOpenAIApiKey, ORCHARD_AI_MODEL, orchardSkillsPrompt } from "@/lib/orchard-ai/config"
import { orchardAiScopeLabel, resolveOrchardAiGamePlanScope, scopeOrchardAiSnapshot } from "@/lib/orchard-ai/game-plan-scope"

const MODEL = ORCHARD_AI_MODEL
const PROMPT_VERSION = "orchard-assistant-v5-game-plan-scope"
const MAX_QUESTION_LENGTH = 2000
const MAX_HISTORY_TURNS = 8

type HistoryTurn = { question: string; answer: string }
type VisualContext = {
  overdueTasks: Array<{ title: string; dueDate: string | null; priority: string | null; location: string | null }>
  harvests: Array<{ crop: string; variety: string | null; date: string | null; status: string | null }>
  nursery: Array<{ status: string | null; ready: number; transplanted: number; expectedReady: string | null; location: string | null }>
  health: Array<{ cropId: string | null; issue: string; severity: string | null; date: string | null }>
  careGaps: Array<{ crop: string; variety: string | null }>
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : []
}
function text(value: unknown) { return typeof value === "string" ? value : null }
function numberValue(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0 }
function localDateKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
function cleanHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return []
  return value.slice(-MAX_HISTORY_TURNS).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {}
    return {
      question: typeof row.question === "string" ? row.question.trim().slice(0, MAX_QUESTION_LENGTH) : "",
      answer: typeof row.answer === "string" ? row.answer.trim().slice(0, 6000) : "",
    }
  }).filter((item) => item.question && item.answer)
}
function gamePlanFromReferer(request: Request) {
  const referer = request.headers.get("referer")
  if (!referer) return null
  try { return new URL(referer).searchParams.get("game_plan") } catch { return null }
}

function buildVisualContext(snapshot: Record<string, unknown[]>): VisualContext {
  const tasks = asRows(snapshot.tasks)
  const crops = asRows(snapshot.crops)
  const nursery = asRows(snapshot.nursery_batches)
  const health = asRows(snapshot.health_logs)
  const care = asRows(snapshot.care_logs)
  const today = localDateKey()
  const completed = new Set(["done", "completed", "cancelled", "canceled"])
  const caredCropIds = new Set(care.map((row) => text(row.crop_id)).filter(Boolean) as string[])

  const overdueTasks = tasks.filter((row) => {
    const due = text(row.due_date); const status = (text(row.status) ?? "").toLowerCase()
    return Boolean(due && due < today && !completed.has(status))
  }).sort((a, b) => (text(a.due_date) ?? "").localeCompare(text(b.due_date) ?? "")).slice(0, 4)
    .map((row) => ({ title: text(row.title) ?? "Untitled task", dueDate: text(row.due_date), priority: text(row.priority), location: text(row.location_name) }))

  const harvests = crops.filter((row) => Boolean(text(row.expected_harvest_date)))
    .sort((a, b) => (text(a.expected_harvest_date) ?? "").localeCompare(text(b.expected_harvest_date) ?? "")).slice(0, 4)
    .map((row) => ({ crop: text(row.crop_name) ?? "Crop", variety: text(row.variety), date: text(row.expected_harvest_date), status: text(row.status) }))

  const nurseryRows = nursery.filter((row) => numberValue(row.ready_count) > numberValue(row.transplanted_count) || (text(row.status) ?? "").toLowerCase().includes("ready"))
    .slice(0, 4).map((row) => ({ status: text(row.status), ready: numberValue(row.ready_count), transplanted: numberValue(row.transplanted_count), expectedReady: text(row.expected_ready_date), location: text(row.location) }))

  const healthRows = health.slice(0, 4).map((row) => ({ cropId: text(row.crop_id), issue: text(row.pest_type) ?? text(row.disease_name) ?? "Health observation", severity: text(row.severity_level), date: text(row.observation_date) }))
  const careGaps = crops.filter((row) => { const cropId = text(row.id); return Boolean(cropId && !caredCropIds.has(cropId)) }).slice(0, 6)
    .map((row) => ({ crop: text(row.crop_name) ?? "Crop", variety: text(row.variety) }))
  return { overdueTasks, harvests, nursery: nurseryRows, health: healthRows, careGaps }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null) as { question?: unknown; history?: unknown; game_plan_id?: unknown } | null
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, MAX_QUESTION_LENGTH) : ""
  const history = cleanHistory(body?.history)
  const requestedGamePlanId = typeof body?.game_plan_id === "string" && body.game_plan_id.trim() ? body.game_plan_id.trim() : gamePlanFromReferer(request)
  if (!question) return Response.json({ error: "Question is required" }, { status: 400 })

  const apiKey = getOpenAIApiKey()
  if (!apiKey) return Response.json({ error: "Orchard AI is not configured: OPENAI_API_KEY is missing" }, { status: 503 })

  const sources = await Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status,objective").limit(50),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,cycle_type,planned_start_date,target_harvest_date,status,planned_area_sqm,target_quantity,target_unit").limit(150),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_plants,planned_area_sqm,status").limit(250),
    supabase.from("orchard_succession_lifecycle").select("crop_succession_id,crop_cycle_id,sequence_no,effective_status,persisted_status,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,transplanted_count,first_planting_date,first_harvest_date,harvest_passes").limit(250),
    supabase.from("orchard_plots").select("id,name,plot_type,size_sqm,status,soil_type,irrigation_type").limit(100),
    supabase.from("orchard_beds").select("id,plot_id,name,area_sqm,status,orientation").limit(250),
    supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,planned_plants").limit(300),
    supabase.from("orchard_seed_lots").select("id,crop_name,variety,lot_code,quantity_seeds,germination_rate_pct,expiry_date,storage_location").limit(150),
    supabase.from("orchard_nursery_batches").select("id,crop_succession_id,sow_date,seeds_sown,emerged_count,ready_count,transplanted_count,expected_ready_date,status,location").limit(200),
    supabase.from("orchard_crops").select("id,plot_id,crop_succession_id,crop_name,variety,planting_date,expected_harvest_date,status,estimated_yield,actual_yield,yield_unit").limit(250),
    supabase.from("orchard_care_logs").select("crop_id,activity_date,activity_type,hours_spent,weather_conditions,observations").order("activity_date", { ascending: false }).limit(250),
    supabase.from("orchard_pest_logs").select("crop_id,observation_date,pest_type,disease_name,severity_level,affected_percentage,treatment_applied,treatment_effectiveness,notes").order("observation_date", { ascending: false }).limit(250),
    supabase.from("orchard_harvest_records").select("crop_id,crop_succession_id,bed_allocation_id,sales_channel_id,harvest_lot_code,harvest_date,quantity_harvested,harvest_unit,quality_rating,storage_method,storage_location,total_market_value,market_value_per_unit,notes").order("harvest_date", { ascending: false }).limit(250),
    supabase.from("orchard_revenue_targets").select("crop_succession_id,sales_channel_id,planned_quantity,unit,target_price_per_unit,planned_revenue,notes").limit(200),
    supabase.from("orchard_sales_commitments").select("sales_channel_id,crop_succession_id,crop_name,variety,delivery_start,delivery_end,quantity,unit,price_per_unit,currency,status,customer_reference,notes").limit(200),
    supabase.from("orchard_sales_channels").select("id,name,channel_type,status,default_price_per_unit,default_unit,currency").limit(100),
    supabase.from("orchard_notes").select("crop_id,crop_succession_id,plot_id,bed_id,note_type,title,body,observed_at").order("observed_at", { ascending: false }).limit(150),
    supabase.from("tasks").select("id,title,priority,status,due_date,location_name,task_category,estimated_minutes,source_type,source_id,source_label").eq("operational_area", "huerto_vinedo").limit(250),
  ])

  const sourceNames = ["game_plans","crop_cycles","successions","lifecycle","plots","beds","bed_allocations","seed_lots","nursery_batches","crops","care_logs","health_logs","harvests","revenue_targets","sales_commitments","sales_channels","notes","tasks"]
  const unscopedSnapshot: Record<string, unknown[]> = {}
  for (let index = 0; index < sources.length; index += 1) {
    const result = sources[index]
    if (result.error) return Response.json({ error: `Could not read ${sourceNames[index]}` }, { status: 500 })
    unscopedSnapshot[sourceNames[index]] = result.data ?? []
  }

  const scope = resolveOrchardAiGamePlanScope(unscopedSnapshot, requestedGamePlanId)
  if (requestedGamePlanId && !scope) return Response.json({ error: "Requested Game Plan is not accessible" }, { status: 400 })
  const snapshot = scopeOrchardAiSnapshot(unscopedSnapshot, scope)
  const sourceCounts = Object.fromEntries(sourceNames.map((name) => [name, snapshot[name]?.length ?? 0]))
  const visualContext = buildVisualContext(snapshot)
  const scopeLabel = orchardAiScopeLabel(scope)

  const instructions = `You are the Orchard operations assistant inside Blackswan Facility Core.
Use ONLY the authorized ORCHARD_SNAPSHOT supplied in the current user input for factual claims. The CONVERSATION_HISTORY is context for follow-up references, not an independent factual source.
ACTIVE_GAME_PLAN_SCOPE: ${scopeLabel}.
${scope ? "The snapshot has already been filtered to this Game Plan. Never infer, mention, compare, or use records from another Game Plan unless the user explicitly leaves this scope and starts a new request without a Game Plan scope." : "No Game Plan filter is active; the snapshot contains all authorized Orchard records."}
Never invent rows, weather, agronomy facts, prices, yields, tasks, dates, or actions that are not present.

Configured read skill:\n${orchardSkillsPrompt("read")}

You may calculate deterministic totals, compare dates, identify missing links, summarize risks, connect plan-to-execution-to-harvest-to-commercial outcomes, and explain operational context.
When evidence is insufficient, say exactly what is missing.
Do not claim that an action was executed. Action proposals are handled by the separate approval workflow.
Do not recommend pesticides, chemicals, dosages, or other safety-sensitive treatment instructions; instead surface recorded health context and recommend review by the responsible operator/agronomist.
Use concise operational English unless the user's question is Spanish, then answer in Spanish.
Resolve pronouns and follow-up questions from CONVERSATION_HISTORY when possible.
Prefer a clear answer first, then short bullets when useful. Avoid long preambles.
For factual claims, append one or more dataset labels in square brackets, such as [harvests], [crops], [tasks], [sales_commitments], [lifecycle].
Distinguish recorded facts from inferences. Label inferred conclusions as "Inference" or "Inferencia".`

  const conversation = history.length ? history.map((turn, index) => `TURN ${index + 1}\nUSER: ${turn.question}\nASSISTANT: ${turn.answer}`).join("\n\n") : "No prior turns."
  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, instructions, input: `CONVERSATION_HISTORY:\n${conversation}\n\nQUESTION:\n${question}\n\nACTIVE_GAME_PLAN_SCOPE:\n${scopeLabel}\n\nORCHARD_SNAPSHOT:\n${JSON.stringify(snapshot)}`, reasoning: { effort: "medium" }, max_output_tokens: 2200, stream: true }),
  })

  if (!openaiResponse.ok || !openaiResponse.body) {
    const payload = await openaiResponse.json().catch(() => ({}))
    const errorMessage = typeof (payload as { error?: { message?: unknown } }).error?.message === "string" ? (payload as { error: { message: string } }).error.message : `OpenAI request failed (${openaiResponse.status})`
    await supabase.from("orchard_ai_queries").insert({ question, model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts, status: "failed", error_message: errorMessage })
    return Response.json({ error: "Orchard AI could not answer right now" }, { status: 502 })
  }

  const encoder = new TextEncoder(); const decoder = new TextDecoder(); const upstream = openaiResponse.body.getReader(); let answer = ""; let buffer = ""
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        send({ type: "meta", model: MODEL, sourceCounts, visualContext, historyTurns: history.length, gamePlanScope: scope ? { id: scope.gamePlanId, label: scopeLabel } : null })
        while (true) {
          const { done, value } = await upstream.read(); if (done) break
          buffer += decoder.decode(value, { stream: true }); const blocks = buffer.split("\n\n"); buffer = blocks.pop() ?? ""
          for (const block of blocks) {
            const dataLine = block.split("\n").find((line) => line.startsWith("data:")); if (!dataLine) continue
            const raw = dataLine.slice(5).trim(); if (!raw || raw === "[DONE]") continue
            try {
              const event = JSON.parse(raw) as { type?: string; delta?: string; error?: { message?: string } }
              if (event.type === "response.output_text.delta" && typeof event.delta === "string") { answer += event.delta; send({ type: "delta", delta: event.delta }) }
              else if (event.type === "error") throw new Error(event.error?.message || "OpenAI streaming error")
            } catch (parseError) { if (parseError instanceof SyntaxError) continue; throw parseError }
          }
        }
        if (!answer.trim()) throw new Error("Orchard AI returned an empty answer")
        await supabase.from("orchard_ai_queries").insert({ question, answer, model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts, status: "completed" })
        send({ type: "done" }); controller.close()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        await supabase.from("orchard_ai_queries").insert({ question, model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts, status: "failed", error_message: errorMessage })
        send({ type: "error", error: "Orchard AI could not answer right now" }); controller.close()
      } finally { upstream.releaseLock() }
    }, cancel() { void upstream.cancel() },
  })

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } })
}

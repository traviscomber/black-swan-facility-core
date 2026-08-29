import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOpenAIApiKey, ORCHARD_AI_MODEL, orchardSkillsPrompt } from "@/lib/orchard-ai/config"

const MODEL = ORCHARD_AI_MODEL
const PROMPT_VERSION = "orchard-actions-v4-conversation"
const MAX_INTENT_LENGTH = 2000
const MAX_HISTORY_TURNS = 8
const MAX_HISTORY_TEXT = 4000

type ActionType = "create_task" | "create_game_plan" | "create_crop_cycle" | "create_succession" | "allocate_bed" | "none"
type HistoryTurn = { question: string; answer: string }
type ProposalShape = {
  action_type: ActionType
  summary: string
  rationale: string | null
  title: string | null
  description: string | null
  priority: string | null
  due_date: string | null
  estimated_minutes: number | null
  location_id: string | null
  name: string | null
  season: string | null
  start_date: string | null
  end_date: string | null
  objective: string | null
  notes: string | null
  game_plan_id: string | null
  crop_name: string | null
  variety: string | null
  cycle_type: string | null
  planned_start_date: string | null
  target_harvest_date: string | null
  planned_area_sqm: number | null
  target_quantity: number | null
  target_unit: string | null
  crop_cycle_id: string | null
  crop_succession_id: string | null
  bed_id: string | null
  planned_sow_date: string | null
  planned_transplant_date: string | null
  planned_first_harvest_date: string | null
  planned_last_harvest_date: string | null
  planned_end_date: string | null
  days_to_maturity: number | null
  planned_plants: number | null
  allocated_area_sqm: number | null
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const response = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  if (typeof response.output_text === "string") return response.output_text
  return (response.output ?? []).flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text" && typeof item.text === "string").map((item) => item.text as string).join("\n")
}

function clean(value: string | null) { return value?.trim() || null }
function isIsoDate(value: string | null) { return value == null || /^\d{4}-\d{2}-\d{2}$/.test(value) }
function cleanHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return []
  return value.slice(-MAX_HISTORY_TURNS).flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const turn = item as { question?: unknown; answer?: unknown }
    if (typeof turn.question !== "string" || typeof turn.answer !== "string") return []
    const question = turn.question.trim().slice(0, 1200)
    const answer = turn.answer.trim().slice(0, MAX_HISTORY_TEXT)
    return question && answer ? [{ question, answer }] : []
  })
}

function validateProposal(
  proposal: ProposalShape,
  accessiblePlanIds: Set<string>,
  accessibleLocationIds: Set<string>,
  accessibleCycleIds: Set<string>,
  accessibleSuccessionIds: Set<string>,
  accessibleBedIds: Set<string>,
) {
  if (proposal.action_type === "none") return null
  if (!proposal.summary.trim()) return "Proposal summary is required"

  if (proposal.action_type === "create_task") {
    if (!clean(proposal.title)) return "Task title is required"
    if (proposal.priority && !["baja", "media", "alta", "urgente"].includes(proposal.priority)) return "Invalid task priority"
    if (!isIsoDate(proposal.due_date)) return "Invalid due date"
    if (proposal.estimated_minutes != null && (proposal.estimated_minutes < 5 || proposal.estimated_minutes > 1440)) return "Estimated minutes must be between 5 and 1440"
    if (proposal.location_id && !accessibleLocationIds.has(proposal.location_id)) return "Proposed location is not accessible"
    return null
  }

  if (proposal.action_type === "create_game_plan") {
    if (!clean(proposal.name)) return "Game plan name is required"
    if (!proposal.start_date || !proposal.end_date || !isIsoDate(proposal.start_date) || !isIsoDate(proposal.end_date)) return "Valid game plan dates are required"
    if (proposal.end_date < proposal.start_date) return "Game plan end date must be on or after start date"
    return null
  }

  if (proposal.action_type === "create_crop_cycle") {
    if (!proposal.game_plan_id || !accessiblePlanIds.has(proposal.game_plan_id)) return "An accessible game plan is required"
    if (!clean(proposal.crop_name)) return "Crop name is required"
    if (!proposal.planned_start_date || !isIsoDate(proposal.planned_start_date)) return "Valid planned start date is required"
    if (proposal.target_harvest_date && (!isIsoDate(proposal.target_harvest_date) || proposal.target_harvest_date < proposal.planned_start_date)) return "Invalid target harvest date"
    if (proposal.cycle_type && !["direct_sow", "transplant", "perennial", "cover_crop"].includes(proposal.cycle_type)) return "Invalid cycle type"
    if (proposal.planned_area_sqm != null && proposal.planned_area_sqm < 0) return "Planned area cannot be negative"
    if (proposal.target_quantity != null && proposal.target_quantity < 0) return "Target quantity cannot be negative"
    return null
  }

  if (proposal.action_type === "create_succession") {
    if (!proposal.crop_cycle_id || !accessibleCycleIds.has(proposal.crop_cycle_id)) return "An accessible crop cycle is required"
    if (!proposal.planned_sow_date || !isIsoDate(proposal.planned_sow_date)) return "Valid planned sow date is required"
    if (proposal.planned_transplant_date && (!isIsoDate(proposal.planned_transplant_date) || proposal.planned_transplant_date < proposal.planned_sow_date)) return "Invalid transplant date"
    if (proposal.planned_first_harvest_date && (!isIsoDate(proposal.planned_first_harvest_date) || proposal.planned_first_harvest_date < proposal.planned_sow_date)) return "Invalid first harvest date"
    if (proposal.planned_last_harvest_date && (!proposal.planned_first_harvest_date || !isIsoDate(proposal.planned_last_harvest_date) || proposal.planned_last_harvest_date < proposal.planned_first_harvest_date)) return "Invalid last harvest date"
    if (proposal.days_to_maturity != null && proposal.days_to_maturity <= 0) return "Days to maturity must be positive"
    if (proposal.planned_plants != null && proposal.planned_plants < 0) return "Planned plants cannot be negative"
    if (proposal.planned_area_sqm != null && proposal.planned_area_sqm < 0) return "Planned area cannot be negative"
    return null
  }

  if (!proposal.bed_id || !accessibleBedIds.has(proposal.bed_id)) return "An accessible active bed is required"
  if (!proposal.crop_succession_id || !accessibleSuccessionIds.has(proposal.crop_succession_id)) return "An accessible succession is required"
  if (!proposal.planned_start_date || !proposal.planned_end_date || !isIsoDate(proposal.planned_start_date) || !isIsoDate(proposal.planned_end_date)) return "Valid allocation dates are required"
  if (proposal.planned_end_date < proposal.planned_start_date) return "Allocation end date must be on or after start date"
  if (proposal.allocated_area_sqm != null && proposal.allocated_area_sqm <= 0) return "Allocated area must be positive"
  if (proposal.planned_plants != null && proposal.planned_plants < 0) return "Planned plants cannot be negative"
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null) as { intent?: unknown; history?: unknown } | null
  const intent = typeof body?.intent === "string" ? body.intent.trim().slice(0, MAX_INTENT_LENGTH) : ""
  const history = cleanHistory(body?.history)
  if (!intent) return NextResponse.json({ error: "Intent is required" }, { status: 400 })

  const apiKey = getOpenAIApiKey()
  if (!apiKey) return NextResponse.json({ error: "Orchard AI is not configured: OPENAI_API_KEY is missing" }, { status: 503 })

  const [plansResult, cyclesResult, successionsResult, plotsResult, bedsResult, allocationsResult, tasksResult, lifecycleResult] = await Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status,objective").limit(50),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,cycle_type,planned_start_date,target_harvest_date,status").limit(150),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_plants,planned_area_sqm,status").neq("status", "cancelled").limit(300),
    supabase.from("orchard_plots").select("id,name,location_id,status,size_sqm").limit(100),
    supabase.from("orchard_beds").select("id,plot_id,name,code,status,area_sqm,length_m,width_m").eq("status", "active").limit(250),
    supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,planned_plants").limit(500),
    supabase.from("tasks").select("id,title,priority,status,due_date,location_id,estimated_minutes").eq("operational_area", "huerto_vinedo").limit(150),
    supabase.from("orchard_succession_lifecycle").select("crop_succession_id,effective_status,planned_sow_date,planned_transplant_date,planned_first_harvest_date").limit(300),
  ])
  const readError = plansResult.error ?? cyclesResult.error ?? successionsResult.error ?? plotsResult.error ?? bedsResult.error ?? allocationsResult.error ?? tasksResult.error ?? lifecycleResult.error
  if (readError) return NextResponse.json({ error: "Could not read authorized Orchard context" }, { status: 500 })

  const snapshot = {
    game_plans: plansResult.data ?? [],
    crop_cycles: cyclesResult.data ?? [],
    successions: successionsResult.data ?? [],
    plots: plotsResult.data ?? [],
    beds: bedsResult.data ?? [],
    allocations: allocationsResult.data ?? [],
    tasks: tasksResult.data ?? [],
    lifecycle: lifecycleResult.data ?? [],
  }
  const sourceCounts = Object.fromEntries(Object.entries(snapshot).map(([key, rows]) => [key, rows.length]))
  const accessiblePlanIds = new Set((plansResult.data ?? []).map((item) => item.id))
  const accessibleCycleIds = new Set((cyclesResult.data ?? []).map((item) => item.id))
  const accessibleSuccessionIds = new Set((successionsResult.data ?? []).map((item) => item.id))
  const accessibleBedIds = new Set((bedsResult.data ?? []).map((item) => item.id))
  const accessibleLocationIds = new Set((plotsResult.data ?? []).map((item) => item.location_id).filter((id): id is string => typeof id === "string"))

  const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] }
  const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] }
  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "action_type","summary","rationale","title","description","priority","due_date","estimated_minutes","location_id","name","season","start_date","end_date","objective","notes",
      "game_plan_id","crop_name","variety","cycle_type","planned_start_date","target_harvest_date","planned_area_sqm","target_quantity","target_unit",
      "crop_cycle_id","crop_succession_id","bed_id","planned_sow_date","planned_transplant_date","planned_first_harvest_date","planned_last_harvest_date","planned_end_date","days_to_maturity","planned_plants","allocated_area_sqm",
    ],
    properties: {
      action_type: { type: "string", enum: ["create_task","create_game_plan","create_crop_cycle","create_succession","allocate_bed","none"] },
      summary: { type: "string" }, rationale: nullableString,
      title: nullableString, description: nullableString, priority: nullableString, due_date: nullableString, estimated_minutes: nullableNumber, location_id: nullableString,
      name: nullableString, season: nullableString, start_date: nullableString, end_date: nullableString, objective: nullableString, notes: nullableString,
      game_plan_id: nullableString, crop_name: nullableString, variety: nullableString, cycle_type: nullableString, planned_start_date: nullableString,
      target_harvest_date: nullableString, planned_area_sqm: nullableNumber, target_quantity: nullableNumber, target_unit: nullableString,
      crop_cycle_id: nullableString, crop_succession_id: nullableString, bed_id: nullableString,
      planned_sow_date: nullableString, planned_transplant_date: nullableString, planned_first_harvest_date: nullableString, planned_last_harvest_date: nullableString, planned_end_date: nullableString,
      days_to_maturity: nullableNumber, planned_plants: nullableNumber, allocated_area_sqm: nullableNumber,
    },
  }

  const instructions = `You propose ONE safe Orchard action for human approval inside Blackswan Facility Core.
Use only the authorized ORCHARD_CONTEXT for factual claims and exact IDs. CONVERSATION_HISTORY is only for understanding references and intent; it is not an independent source of truth. Never claim an action was executed.

Configured proposal skills:\n${orchardSkillsPrompt("proposal")}

Allowed actions: create_task, create_game_plan, create_crop_cycle, create_succession, allocate_bed, or none.
Choose none if the user's intent is ambiguous, asks for edit/delete/destructive actions, harvest/care/health writes, chemical/pesticide/dosage actions, or lacks enough current context to choose exact authorized IDs and dates.
Resolve follow-up references like "that crop", "the previous one", or "do that" using CONVERSATION_HISTORY, but independently verify all resulting entities and dates against ORCHARD_CONTEXT.
For create_crop_cycle, game_plan_id MUST be an exact ID present in game_plans.
For create_succession, crop_cycle_id MUST be an exact ID present in crop_cycles. Do not invent sequence_no; the server assigns it transactionally.
For allocate_bed, bed_id MUST be an exact active ID from beds and crop_succession_id MUST be an exact ID from successions. Use the succession's planned transplant date as planned_start_date when available, otherwise planned sow date. Use planned last harvest as planned_end_date when available, otherwise planned first harvest, otherwise planned_start_date. The server independently validates access, bed capacity, and date overlap.
For create_task, location_id must be null or an exact location_id present in plots. Priority must be baja, media, alta, or urgente.
Dates must be YYYY-MM-DD. Keep rationale concise. Populate irrelevant fields as null.`

  const conversation = history.length ? history.map((turn, index) => `TURN ${index + 1}\nUSER: ${turn.question}\nASSISTANT: ${turn.answer}`).join("\n\n") : "No prior turns."

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: `CONVERSATION_HISTORY:\n${conversation}\n\nUSER_INTENT:\n${intent}\n\nORCHARD_CONTEXT:\n${JSON.stringify(snapshot)}`,
        reasoning: { effort: "medium" },
        text: { format: { type: "json_schema", name: "orchard_action_proposal", schema, strict: true } },
        max_output_tokens: 1600,
      }),
    })
    const raw = await response.json().catch(() => ({}))
    if (!response.ok) return NextResponse.json({ error: "Orchard AI could not create a proposal" }, { status: 502 })
    const output = extractOutputText(raw)
    const proposal = JSON.parse(output) as ProposalShape
    const validationError = validateProposal(proposal, accessiblePlanIds, accessibleLocationIds, accessibleCycleIds, accessibleSuccessionIds, accessibleBedIds)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })
    if (proposal.action_type === "none") return NextResponse.json({ proposal: null, explanation: proposal.summary || proposal.rationale || "No safe action proposed.", model: MODEL, sourceCounts })

    let payload: Record<string, unknown>
    if (proposal.action_type === "create_task") {
      payload = { title: clean(proposal.title), description: clean(proposal.description), priority: proposal.priority || "media", due_date: proposal.due_date, estimated_minutes: proposal.estimated_minutes, location_id: proposal.location_id }
    } else if (proposal.action_type === "create_game_plan") {
      payload = { name: clean(proposal.name), season: clean(proposal.season), start_date: proposal.start_date, end_date: proposal.end_date, objective: clean(proposal.objective), notes: clean(proposal.notes) }
    } else if (proposal.action_type === "create_crop_cycle") {
      payload = { game_plan_id: proposal.game_plan_id, crop_name: clean(proposal.crop_name), variety: clean(proposal.variety), cycle_type: proposal.cycle_type || "direct_sow", planned_start_date: proposal.planned_start_date, target_harvest_date: proposal.target_harvest_date, planned_area_sqm: proposal.planned_area_sqm, target_quantity: proposal.target_quantity, target_unit: clean(proposal.target_unit), notes: clean(proposal.notes) }
    } else if (proposal.action_type === "create_succession") {
      payload = { crop_cycle_id: proposal.crop_cycle_id, planned_sow_date: proposal.planned_sow_date, planned_transplant_date: proposal.planned_transplant_date, planned_first_harvest_date: proposal.planned_first_harvest_date, planned_last_harvest_date: proposal.planned_last_harvest_date, days_to_maturity: proposal.days_to_maturity, planned_plants: proposal.planned_plants, planned_area_sqm: proposal.planned_area_sqm, notes: clean(proposal.notes) }
    } else {
      payload = { bed_id: proposal.bed_id, crop_succession_id: proposal.crop_succession_id, planned_start_date: proposal.planned_start_date, planned_end_date: proposal.planned_end_date, allocated_area_sqm: proposal.allocated_area_sqm, planned_plants: proposal.planned_plants, notes: clean(proposal.notes) }
    }

    const inserted = await supabase.from("orchard_ai_action_proposals").insert({
      intent, action_type: proposal.action_type, summary: proposal.summary.trim(), rationale: clean(proposal.rationale), payload,
      model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts,
    }).select("id,action_type,summary,rationale,payload,status,created_at").single()
    if (inserted.error) return NextResponse.json({ error: "Could not persist action proposal" }, { status: 500 })
    return NextResponse.json({ proposal: inserted.data, model: MODEL, sourceCounts })
  } catch {
    return NextResponse.json({ error: "Orchard AI could not create a valid proposal" }, { status: 502 })
  }
}

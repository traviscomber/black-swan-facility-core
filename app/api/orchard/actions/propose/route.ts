import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MODEL = "gpt-5.6-sol"
const PROMPT_VERSION = "orchard-actions-v1"
const MAX_INTENT_LENGTH = 2000

type ActionType = "create_task" | "create_game_plan" | "create_crop_cycle" | "none"
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
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const response = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  if (typeof response.output_text === "string") return response.output_text
  return (response.output ?? []).flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text" && typeof item.text === "string").map((item) => item.text as string).join("\n")
}

function clean(value: string | null) { return value?.trim() || null }
function isIsoDate(value: string | null) { return value == null || /^\d{4}-\d{2}-\d{2}$/.test(value) }

function validateProposal(proposal: ProposalShape, accessiblePlanIds: Set<string>, accessibleLocationIds: Set<string>) {
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

  if (!proposal.game_plan_id || !accessiblePlanIds.has(proposal.game_plan_id)) return "An accessible game plan is required"
  if (!clean(proposal.crop_name)) return "Crop name is required"
  if (!proposal.planned_start_date || !isIsoDate(proposal.planned_start_date)) return "Valid planned start date is required"
  if (proposal.target_harvest_date && (!isIsoDate(proposal.target_harvest_date) || proposal.target_harvest_date < proposal.planned_start_date)) return "Invalid target harvest date"
  if (proposal.cycle_type && !["direct_sow", "transplant", "perennial", "cover_crop"].includes(proposal.cycle_type)) return "Invalid cycle type"
  if (proposal.planned_area_sqm != null && proposal.planned_area_sqm < 0) return "Planned area cannot be negative"
  if (proposal.target_quantity != null && proposal.target_quantity < 0) return "Target quantity cannot be negative"
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null) as { intent?: unknown } | null
  const intent = typeof body?.intent === "string" ? body.intent.trim().slice(0, MAX_INTENT_LENGTH) : ""
  if (!intent) return NextResponse.json({ error: "Intent is required" }, { status: 400 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Orchard AI is not configured" }, { status: 503 })

  const [plansResult, cyclesResult, plotsResult, tasksResult, decisionsResult] = await Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status,objective").limit(50),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,cycle_type,planned_start_date,target_harvest_date,status").limit(150),
    supabase.from("orchard_plots").select("id,name,location_id,status,size_sqm").limit(100),
    supabase.from("tasks").select("id,title,priority,status,due_date,location_id,estimated_minutes").eq("operational_area", "huerto_vinedo").limit(150),
    supabase.from("orchard_succession_lifecycle").select("crop_succession_id,effective_status,planned_sow_date,planned_transplant_date,planned_first_harvest_date").limit(250),
  ])
  const readError = plansResult.error ?? cyclesResult.error ?? plotsResult.error ?? tasksResult.error ?? decisionsResult.error
  if (readError) return NextResponse.json({ error: "Could not read authorized Orchard context" }, { status: 500 })

  const snapshot = {
    game_plans: plansResult.data ?? [],
    crop_cycles: cyclesResult.data ?? [],
    plots: plotsResult.data ?? [],
    tasks: tasksResult.data ?? [],
    lifecycle: decisionsResult.data ?? [],
  }
  const sourceCounts = Object.fromEntries(Object.entries(snapshot).map(([key, rows]) => [key, rows.length]))
  const accessiblePlanIds = new Set((plansResult.data ?? []).map((item) => item.id))
  const accessibleLocationIds = new Set((plotsResult.data ?? []).map((item) => item.location_id).filter((id): id is string => typeof id === "string"))

  const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] }
  const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] }
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["action_type","summary","rationale","title","description","priority","due_date","estimated_minutes","location_id","name","season","start_date","end_date","objective","notes","game_plan_id","crop_name","variety","cycle_type","planned_start_date","target_harvest_date","planned_area_sqm","target_quantity","target_unit"],
    properties: {
      action_type: { type: "string", enum: ["create_task","create_game_plan","create_crop_cycle","none"] },
      summary: { type: "string" }, rationale: nullableString,
      title: nullableString, description: nullableString, priority: nullableString, due_date: nullableString, estimated_minutes: nullableNumber, location_id: nullableString,
      name: nullableString, season: nullableString, start_date: nullableString, end_date: nullableString, objective: nullableString, notes: nullableString,
      game_plan_id: nullableString, crop_name: nullableString, variety: nullableString, cycle_type: nullableString, planned_start_date: nullableString,
      target_harvest_date: nullableString, planned_area_sqm: nullableNumber, target_quantity: nullableNumber, target_unit: nullableString,
    },
  }

  const instructions = `You propose ONE safe Orchard action for human approval inside Blackswan Facility Core.
Use only the authorized ORCHARD_CONTEXT. Never claim an action was executed.
Allowed actions: create_task, create_game_plan, create_crop_cycle, or none.
Choose none if the user's intent is ambiguous, asks for a destructive/edit/delete action, requires creating successions/bed allocations/harvest/care/health records, or lacks required IDs/dates.
For create_crop_cycle, game_plan_id MUST be an exact ID present in game_plans.
For create_task, location_id must be null or an exact location_id present in plots. Priority must be baja, media, alta, or urgente.
Do not propose pesticide/chemical/dosage actions.
Dates must be YYYY-MM-DD. Keep rationale concise. Populate irrelevant fields as null.`

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: `USER_INTENT:\n${intent}\n\nORCHARD_CONTEXT:\n${JSON.stringify(snapshot)}`,
        reasoning: { effort: "medium" },
        text: { format: { type: "json_schema", name: "orchard_action_proposal", schema, strict: true } },
        max_output_tokens: 1200,
      }),
    })
    const raw = await response.json().catch(() => ({}))
    if (!response.ok) return NextResponse.json({ error: "Orchard AI could not create a proposal" }, { status: 502 })
    const output = extractOutputText(raw)
    const proposal = JSON.parse(output) as ProposalShape
    const validationError = validateProposal(proposal, accessiblePlanIds, accessibleLocationIds)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })
    if (proposal.action_type === "none") return NextResponse.json({ proposal: null, explanation: proposal.summary || proposal.rationale || "No safe action proposed.", model: MODEL, sourceCounts })

    const payload = proposal.action_type === "create_task" ? {
      title: clean(proposal.title), description: clean(proposal.description), priority: proposal.priority || "media", due_date: proposal.due_date,
      estimated_minutes: proposal.estimated_minutes, location_id: proposal.location_id,
    } : proposal.action_type === "create_game_plan" ? {
      name: clean(proposal.name), season: clean(proposal.season), start_date: proposal.start_date, end_date: proposal.end_date,
      objective: clean(proposal.objective), notes: clean(proposal.notes),
    } : {
      game_plan_id: proposal.game_plan_id, crop_name: clean(proposal.crop_name), variety: clean(proposal.variety), cycle_type: proposal.cycle_type || "direct_sow",
      planned_start_date: proposal.planned_start_date, target_harvest_date: proposal.target_harvest_date, planned_area_sqm: proposal.planned_area_sqm,
      target_quantity: proposal.target_quantity, target_unit: clean(proposal.target_unit), notes: clean(proposal.notes),
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

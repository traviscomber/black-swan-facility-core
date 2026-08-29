import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOpenAIApiKey, ORCHARD_AI_MODEL, orchardSkillsPrompt } from "@/lib/orchard-ai/config"

const MODEL = ORCHARD_AI_MODEL
const PROMPT_VERSION = "orchard-actions-v5-operations"
const MAX_INTENT_LENGTH = 2000
const MAX_HISTORY_TURNS = 8
const MAX_HISTORY_TEXT = 4000

type ActionType = "create_task" | "create_game_plan" | "create_crop_cycle" | "create_succession" | "allocate_bed" | "log_care" | "record_health_observation" | "record_harvest" | "create_sales_commitment" | "none"
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
  crop_id: string | null
  activity_date: string | null
  activity_type: string | null
  hours_spent: number | null
  weather_conditions: string | null
  temperature_c: number | null
  humidity_percent: number | null
  observations: string | null
  observation_date: string | null
  pest_type: string | null
  disease_name: string | null
  severity_level: string | null
  affected_percentage: number | null
  harvest_date: string | null
  quantity_harvested: number | null
  harvest_unit: string | null
  quality_rating: number | null
  storage_method: string | null
  storage_location: string | null
  shelf_life_days: number | null
  market_value_per_unit: number | null
  sales_channel_id: string | null
  delivery_start: string | null
  delivery_end: string | null
  quantity: number | null
  unit: string | null
  price_per_unit: number | null
  currency: string | null
  customer_reference: string | null
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
  ids: { plans: Set<string>; locations: Set<string>; cycles: Set<string>; successions: Set<string>; beds: Set<string>; crops: Set<string>; salesChannels: Set<string> },
) {
  if (proposal.action_type === "none") return null
  if (!proposal.summary.trim()) return "Proposal summary is required"

  if (proposal.action_type === "create_task") {
    if (!clean(proposal.title)) return "Task title is required"
    if (proposal.priority && !["baja", "media", "alta", "urgente"].includes(proposal.priority)) return "Invalid task priority"
    if (!isIsoDate(proposal.due_date)) return "Invalid due date"
    if (proposal.estimated_minutes != null && (proposal.estimated_minutes < 5 || proposal.estimated_minutes > 1440)) return "Estimated minutes must be between 5 and 1440"
    if (proposal.location_id && !ids.locations.has(proposal.location_id)) return "Proposed location is not accessible"
    return null
  }
  if (proposal.action_type === "create_game_plan") {
    if (!clean(proposal.name)) return "Game plan name is required"
    if (!proposal.start_date || !proposal.end_date || !isIsoDate(proposal.start_date) || !isIsoDate(proposal.end_date)) return "Valid game plan dates are required"
    if (proposal.end_date < proposal.start_date) return "Game plan end date must be on or after start date"
    return null
  }
  if (proposal.action_type === "create_crop_cycle") {
    if (!proposal.game_plan_id || !ids.plans.has(proposal.game_plan_id)) return "An accessible game plan is required"
    if (!clean(proposal.crop_name)) return "Crop name is required"
    if (!proposal.planned_start_date || !isIsoDate(proposal.planned_start_date)) return "Valid planned start date is required"
    if (proposal.target_harvest_date && (!isIsoDate(proposal.target_harvest_date) || proposal.target_harvest_date < proposal.planned_start_date)) return "Invalid target harvest date"
    if (proposal.cycle_type && !["direct_sow", "transplant", "perennial", "cover_crop"].includes(proposal.cycle_type)) return "Invalid cycle type"
    if (proposal.planned_area_sqm != null && proposal.planned_area_sqm < 0) return "Planned area cannot be negative"
    if (proposal.target_quantity != null && proposal.target_quantity < 0) return "Target quantity cannot be negative"
    return null
  }
  if (proposal.action_type === "create_succession") {
    if (!proposal.crop_cycle_id || !ids.cycles.has(proposal.crop_cycle_id)) return "An accessible crop cycle is required"
    if (!proposal.planned_sow_date || !isIsoDate(proposal.planned_sow_date)) return "Valid planned sow date is required"
    if (proposal.planned_transplant_date && (!isIsoDate(proposal.planned_transplant_date) || proposal.planned_transplant_date < proposal.planned_sow_date)) return "Invalid transplant date"
    if (proposal.planned_first_harvest_date && (!isIsoDate(proposal.planned_first_harvest_date) || proposal.planned_first_harvest_date < proposal.planned_sow_date)) return "Invalid first harvest date"
    if (proposal.planned_last_harvest_date && (!proposal.planned_first_harvest_date || !isIsoDate(proposal.planned_last_harvest_date) || proposal.planned_last_harvest_date < proposal.planned_first_harvest_date)) return "Invalid last harvest date"
    if (proposal.days_to_maturity != null && proposal.days_to_maturity <= 0) return "Days to maturity must be positive"
    if (proposal.planned_plants != null && proposal.planned_plants < 0) return "Planned plants cannot be negative"
    if (proposal.planned_area_sqm != null && proposal.planned_area_sqm < 0) return "Planned area cannot be negative"
    return null
  }
  if (proposal.action_type === "allocate_bed") {
    if (!proposal.bed_id || !ids.beds.has(proposal.bed_id)) return "An accessible active bed is required"
    if (!proposal.crop_succession_id || !ids.successions.has(proposal.crop_succession_id)) return "An accessible succession is required"
    if (!proposal.planned_start_date || !proposal.planned_end_date || !isIsoDate(proposal.planned_start_date) || !isIsoDate(proposal.planned_end_date)) return "Valid allocation dates are required"
    if (proposal.planned_end_date < proposal.planned_start_date) return "Allocation end date must be on or after start date"
    if (proposal.allocated_area_sqm != null && proposal.allocated_area_sqm <= 0) return "Allocated area must be positive"
    if (proposal.planned_plants != null && proposal.planned_plants < 0) return "Planned plants cannot be negative"
    return null
  }
  if (proposal.action_type === "log_care") {
    if (!proposal.crop_id || !ids.crops.has(proposal.crop_id)) return "An accessible crop is required"
    if (!proposal.activity_date || !isIsoDate(proposal.activity_date)) return "Valid activity date is required"
    if (!clean(proposal.activity_type)) return "Care activity type is required"
    if (proposal.hours_spent != null && (proposal.hours_spent < 0 || proposal.hours_spent > 24)) return "Hours spent must be between 0 and 24"
    if (proposal.humidity_percent != null && (proposal.humidity_percent < 0 || proposal.humidity_percent > 100)) return "Humidity must be between 0 and 100"
    return null
  }
  if (proposal.action_type === "record_health_observation") {
    if (!proposal.crop_id || !ids.crops.has(proposal.crop_id)) return "An accessible crop is required"
    if (!proposal.observation_date || !isIsoDate(proposal.observation_date)) return "Valid observation date is required"
    if (!clean(proposal.pest_type) && !clean(proposal.disease_name)) return "Pest type or disease name is required"
    if (proposal.severity_level && !["low", "medium", "high", "critical"].includes(proposal.severity_level)) return "Invalid severity level"
    if (proposal.affected_percentage != null && (proposal.affected_percentage < 0 || proposal.affected_percentage > 100)) return "Affected percentage must be between 0 and 100"
    return null
  }
  if (proposal.action_type === "record_harvest") {
    if (!proposal.crop_id || !ids.crops.has(proposal.crop_id)) return "An accessible crop is required"
    if (!proposal.harvest_date || !isIsoDate(proposal.harvest_date)) return "Valid harvest date is required"
    if (proposal.quantity_harvested == null || proposal.quantity_harvested <= 0) return "Harvest quantity must be positive"
    if (!clean(proposal.harvest_unit)) return "Harvest unit is required"
    if (proposal.quality_rating != null && (proposal.quality_rating < 1 || proposal.quality_rating > 5 || !Number.isInteger(proposal.quality_rating))) return "Quality rating must be an integer from 1 to 5"
    if (proposal.shelf_life_days != null && proposal.shelf_life_days < 0) return "Shelf life cannot be negative"
    if (proposal.market_value_per_unit != null && proposal.market_value_per_unit < 0) return "Market value cannot be negative"
    if (proposal.sales_channel_id && !ids.salesChannels.has(proposal.sales_channel_id)) return "Sales channel is not accessible"
    return null
  }
  if (!proposal.sales_channel_id || !ids.salesChannels.has(proposal.sales_channel_id)) return "An accessible sales channel is required"
  if (!clean(proposal.crop_name)) return "Crop name is required"
  if (!proposal.delivery_start || !proposal.delivery_end || !isIsoDate(proposal.delivery_start) || !isIsoDate(proposal.delivery_end)) return "Valid delivery dates are required"
  if (proposal.delivery_end < proposal.delivery_start) return "Delivery end must be on or after delivery start"
  if (proposal.quantity == null || proposal.quantity <= 0) return "Commitment quantity must be positive"
  if (!clean(proposal.unit)) return "Commitment unit is required"
  if (proposal.price_per_unit != null && proposal.price_per_unit < 0) return "Price per unit cannot be negative"
  if (proposal.crop_succession_id && !ids.successions.has(proposal.crop_succession_id)) return "Succession is not accessible"
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

  const [plansResult, cyclesResult, successionsResult, plotsResult, bedsResult, allocationsResult, tasksResult, lifecycleResult, cropsResult, channelsResult, careResult, healthResult, harvestResult, commitmentsResult] = await Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status,objective").limit(50),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,cycle_type,planned_start_date,target_harvest_date,status").limit(150),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_plants,planned_area_sqm,status").neq("status", "cancelled").limit(300),
    supabase.from("orchard_plots").select("id,name,location_id,status,size_sqm").limit(100),
    supabase.from("orchard_beds").select("id,plot_id,name,code,status,area_sqm,length_m,width_m").eq("status", "active").limit(250),
    supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,planned_plants").limit(500),
    supabase.from("tasks").select("id,title,priority,status,due_date,location_id,estimated_minutes").eq("operational_area", "huerto_vinedo").limit(150),
    supabase.from("orchard_succession_lifecycle").select("crop_succession_id,effective_status,planned_sow_date,planned_transplant_date,planned_first_harvest_date").limit(300),
    supabase.from("orchard_crops").select("id,plot_id,crop_name,variety,status,crop_succession_id,expected_harvest_date,yield_unit").limit(300),
    supabase.from("orchard_sales_channels").select("id,name,status,default_price_per_unit,default_unit,currency").eq("status", "active").limit(100),
    supabase.from("orchard_care_logs").select("id,crop_id,activity_date,activity_type,hours_spent").order("activity_date", { ascending: false }).limit(120),
    supabase.from("orchard_pest_logs").select("id,crop_id,observation_date,pest_type,disease_name,severity_level,affected_percentage").order("observation_date", { ascending: false }).limit(120),
    supabase.from("orchard_harvest_records").select("id,crop_id,crop_succession_id,harvest_date,quantity_harvested,harvest_unit,sales_channel_id").order("harvest_date", { ascending: false }).limit(120),
    supabase.from("orchard_sales_commitments").select("id,sales_channel_id,crop_succession_id,crop_name,variety,delivery_start,delivery_end,quantity,unit,status").order("delivery_start").limit(120),
  ])
  const readError = plansResult.error ?? cyclesResult.error ?? successionsResult.error ?? plotsResult.error ?? bedsResult.error ?? allocationsResult.error ?? tasksResult.error ?? lifecycleResult.error ?? cropsResult.error ?? channelsResult.error ?? careResult.error ?? healthResult.error ?? harvestResult.error ?? commitmentsResult.error
  if (readError) return NextResponse.json({ error: "Could not read authorized Orchard context" }, { status: 500 })

  const snapshot = { game_plans: plansResult.data ?? [], crop_cycles: cyclesResult.data ?? [], successions: successionsResult.data ?? [], plots: plotsResult.data ?? [], beds: bedsResult.data ?? [], allocations: allocationsResult.data ?? [], tasks: tasksResult.data ?? [], lifecycle: lifecycleResult.data ?? [], crops: cropsResult.data ?? [], sales_channels: channelsResult.data ?? [], care_logs: careResult.data ?? [], health_logs: healthResult.data ?? [], harvests: harvestResult.data ?? [], sales_commitments: commitmentsResult.data ?? [] }
  const sourceCounts = Object.fromEntries(Object.entries(snapshot).map(([key, rows]) => [key, rows.length]))
  const ids = {
    plans: new Set((plansResult.data ?? []).map((item) => item.id)), locations: new Set((plotsResult.data ?? []).map((item) => item.location_id).filter((id): id is string => typeof id === "string")),
    cycles: new Set((cyclesResult.data ?? []).map((item) => item.id)), successions: new Set((successionsResult.data ?? []).map((item) => item.id)), beds: new Set((bedsResult.data ?? []).map((item) => item.id)),
    crops: new Set((cropsResult.data ?? []).map((item) => item.id)), salesChannels: new Set((channelsResult.data ?? []).map((item) => item.id)),
  }

  const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] }
  const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] }
  const schema = {
    type: "object", additionalProperties: false,
    required: ["action_type","summary","rationale","title","description","priority","due_date","estimated_minutes","location_id","name","season","start_date","end_date","objective","notes","game_plan_id","crop_name","variety","cycle_type","planned_start_date","target_harvest_date","planned_area_sqm","target_quantity","target_unit","crop_cycle_id","crop_succession_id","bed_id","planned_sow_date","planned_transplant_date","planned_first_harvest_date","planned_last_harvest_date","planned_end_date","days_to_maturity","planned_plants","allocated_area_sqm","crop_id","activity_date","activity_type","hours_spent","weather_conditions","temperature_c","humidity_percent","observations","observation_date","pest_type","disease_name","severity_level","affected_percentage","harvest_date","quantity_harvested","harvest_unit","quality_rating","storage_method","storage_location","shelf_life_days","market_value_per_unit","sales_channel_id","delivery_start","delivery_end","quantity","unit","price_per_unit","currency","customer_reference"],
    properties: {
      action_type: { type: "string", enum: ["create_task","create_game_plan","create_crop_cycle","create_succession","allocate_bed","log_care","record_health_observation","record_harvest","create_sales_commitment","none"] }, summary: { type: "string" }, rationale: nullableString,
      title: nullableString, description: nullableString, priority: nullableString, due_date: nullableString, estimated_minutes: nullableNumber, location_id: nullableString, name: nullableString, season: nullableString, start_date: nullableString, end_date: nullableString, objective: nullableString, notes: nullableString,
      game_plan_id: nullableString, crop_name: nullableString, variety: nullableString, cycle_type: nullableString, planned_start_date: nullableString, target_harvest_date: nullableString, planned_area_sqm: nullableNumber, target_quantity: nullableNumber, target_unit: nullableString, crop_cycle_id: nullableString, crop_succession_id: nullableString, bed_id: nullableString, planned_sow_date: nullableString, planned_transplant_date: nullableString, planned_first_harvest_date: nullableString, planned_last_harvest_date: nullableString, planned_end_date: nullableString, days_to_maturity: nullableNumber, planned_plants: nullableNumber, allocated_area_sqm: nullableNumber,
      crop_id: nullableString, activity_date: nullableString, activity_type: nullableString, hours_spent: nullableNumber, weather_conditions: nullableString, temperature_c: nullableNumber, humidity_percent: nullableNumber, observations: nullableString, observation_date: nullableString, pest_type: nullableString, disease_name: nullableString, severity_level: nullableString, affected_percentage: nullableNumber,
      harvest_date: nullableString, quantity_harvested: nullableNumber, harvest_unit: nullableString, quality_rating: nullableNumber, storage_method: nullableString, storage_location: nullableString, shelf_life_days: nullableNumber, market_value_per_unit: nullableNumber, sales_channel_id: nullableString,
      delivery_start: nullableString, delivery_end: nullableString, quantity: nullableNumber, unit: nullableString, price_per_unit: nullableNumber, currency: nullableString, customer_reference: nullableString,
    },
  }

  const instructions = `You propose ONE safe Orchard action for human approval inside Blackswan Facility Core.
Use only ORCHARD_CONTEXT for factual claims and exact IDs. CONVERSATION_HISTORY is only for resolving references and intent. Never claim execution.

Configured proposal skills:\n${orchardSkillsPrompt("proposal")}

Allowed actions: create_task, create_game_plan, create_crop_cycle, create_succession, allocate_bed, log_care, record_health_observation, record_harvest, create_sales_commitment, or none.
Choose none for edit/delete/destructive actions, treatment/pesticide/chemical/dosage instructions, treatment writes, or when exact current IDs/dates/quantities are missing.
Health is observation-only: never populate treatment fields because this action does not support them.
Care must record a user-described completed or planned operational activity; do not invent weather, temperature, humidity, hours, or observations.
Harvest requires an exact crop_id, date, positive quantity, and unit. Do not infer quantities. A sales channel is optional and must be exact when used.
Commercial commitments require an exact active sales_channel_id, explicit delivery dates, quantity and unit. Use crop_succession_id only when the user clearly refers to one current succession.
For create_crop_cycle, game_plan_id must match game_plans. For create_succession, crop_cycle_id must match crop_cycles. For allocate_bed, bed_id must be active and crop_succession_id must match successions. For create_task, location_id must be null or match plots.
Dates use YYYY-MM-DD. Populate irrelevant fields as null.`
  const conversation = history.length ? history.map((turn, index) => `TURN ${index + 1}\nUSER: ${turn.question}\nASSISTANT: ${turn.answer}`).join("\n\n") : "No prior turns."

  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, instructions, input: `CONVERSATION_HISTORY:\n${conversation}\n\nUSER_INTENT:\n${intent}\n\nORCHARD_CONTEXT:\n${JSON.stringify(snapshot)}`, reasoning: { effort: "medium" }, text: { format: { type: "json_schema", name: "orchard_action_proposal", schema, strict: true } }, max_output_tokens: 2200 }) })
    const raw = await response.json().catch(() => ({}))
    if (!response.ok) return NextResponse.json({ error: "Orchard AI could not create a proposal" }, { status: 502 })
    const proposal = JSON.parse(extractOutputText(raw)) as ProposalShape
    const validationError = validateProposal(proposal, ids)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })
    if (proposal.action_type === "none") return NextResponse.json({ proposal: null, explanation: proposal.summary || proposal.rationale || "No safe action proposed.", model: MODEL, sourceCounts })

    let payload: Record<string, unknown>
    if (proposal.action_type === "create_task") payload = { title: clean(proposal.title), description: clean(proposal.description), priority: proposal.priority || "media", due_date: proposal.due_date, estimated_minutes: proposal.estimated_minutes, location_id: proposal.location_id }
    else if (proposal.action_type === "create_game_plan") payload = { name: clean(proposal.name), season: clean(proposal.season), start_date: proposal.start_date, end_date: proposal.end_date, objective: clean(proposal.objective), notes: clean(proposal.notes) }
    else if (proposal.action_type === "create_crop_cycle") payload = { game_plan_id: proposal.game_plan_id, crop_name: clean(proposal.crop_name), variety: clean(proposal.variety), cycle_type: proposal.cycle_type || "direct_sow", planned_start_date: proposal.planned_start_date, target_harvest_date: proposal.target_harvest_date, planned_area_sqm: proposal.planned_area_sqm, target_quantity: proposal.target_quantity, target_unit: clean(proposal.target_unit), notes: clean(proposal.notes) }
    else if (proposal.action_type === "create_succession") payload = { crop_cycle_id: proposal.crop_cycle_id, planned_sow_date: proposal.planned_sow_date, planned_transplant_date: proposal.planned_transplant_date, planned_first_harvest_date: proposal.planned_first_harvest_date, planned_last_harvest_date: proposal.planned_last_harvest_date, days_to_maturity: proposal.days_to_maturity, planned_plants: proposal.planned_plants, planned_area_sqm: proposal.planned_area_sqm, notes: clean(proposal.notes) }
    else if (proposal.action_type === "allocate_bed") payload = { bed_id: proposal.bed_id, crop_succession_id: proposal.crop_succession_id, planned_start_date: proposal.planned_start_date, planned_end_date: proposal.planned_end_date, allocated_area_sqm: proposal.allocated_area_sqm, planned_plants: proposal.planned_plants, notes: clean(proposal.notes) }
    else if (proposal.action_type === "log_care") payload = { crop_id: proposal.crop_id, activity_date: proposal.activity_date, activity_type: clean(proposal.activity_type), hours_spent: proposal.hours_spent, description: clean(proposal.description), weather_conditions: clean(proposal.weather_conditions), temperature_c: proposal.temperature_c, humidity_percent: proposal.humidity_percent, observations: clean(proposal.observations) }
    else if (proposal.action_type === "record_health_observation") payload = { crop_id: proposal.crop_id, observation_date: proposal.observation_date, pest_type: clean(proposal.pest_type), disease_name: clean(proposal.disease_name), severity_level: proposal.severity_level, affected_percentage: proposal.affected_percentage, notes: clean(proposal.notes) }
    else if (proposal.action_type === "record_harvest") payload = { crop_id: proposal.crop_id, crop_succession_id: proposal.crop_succession_id, harvest_date: proposal.harvest_date, quantity_harvested: proposal.quantity_harvested, harvest_unit: clean(proposal.harvest_unit), quality_rating: proposal.quality_rating, storage_method: clean(proposal.storage_method), storage_location: clean(proposal.storage_location), shelf_life_days: proposal.shelf_life_days, market_value_per_unit: proposal.market_value_per_unit, sales_channel_id: proposal.sales_channel_id, notes: clean(proposal.notes) }
    else payload = { sales_channel_id: proposal.sales_channel_id, crop_succession_id: proposal.crop_succession_id, crop_name: clean(proposal.crop_name), variety: clean(proposal.variety), delivery_start: proposal.delivery_start, delivery_end: proposal.delivery_end, quantity: proposal.quantity, unit: clean(proposal.unit), price_per_unit: proposal.price_per_unit, currency: clean(proposal.currency) || "CLP", customer_reference: clean(proposal.customer_reference), notes: clean(proposal.notes) }

    const inserted = await supabase.from("orchard_ai_action_proposals").insert({ intent, action_type: proposal.action_type, summary: proposal.summary.trim(), rationale: clean(proposal.rationale), payload, model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts }).select("id,action_type,summary,rationale,payload,status,created_at").single()
    if (inserted.error) return NextResponse.json({ error: "Could not persist action proposal" }, { status: 500 })
    return NextResponse.json({ proposal: inserted.data, model: MODEL, sourceCounts })
  } catch {
    return NextResponse.json({ error: "Orchard AI could not create a valid proposal" }, { status: 502 })
  }
}

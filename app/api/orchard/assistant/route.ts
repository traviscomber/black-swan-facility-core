import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOpenAIApiKey, ORCHARD_AI_MODEL, orchardSkillsPrompt } from "@/lib/orchard-ai/config"

const MODEL = ORCHARD_AI_MODEL
const PROMPT_VERSION = "orchard-assistant-v2"
const MAX_QUESTION_LENGTH = 2000

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const response = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  if (typeof response.output_text === "string") return response.output_text
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("\n")
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null) as { question?: unknown } | null
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, MAX_QUESTION_LENGTH) : ""
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 })

  const apiKey = getOpenAIApiKey()
  if (!apiKey) return NextResponse.json({ error: "Orchard AI is not configured: OPENAI_API_KEY is missing" }, { status: 503 })

  const sources = await Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status,objective").limit(50),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,cycle_type,planned_start_date,target_harvest_date,status,planned_area_sqm,target_quantity,target_unit").limit(150),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_plants,planned_area_sqm,status").limit(250),
    supabase.from("orchard_plots").select("id,name,plot_type,size_sqm,status,soil_type,irrigation_type").limit(100),
    supabase.from("orchard_beds").select("id,plot_id,name,area_sqm,status,orientation").limit(250),
    supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,planned_plants").limit(300),
    supabase.from("orchard_seed_lots").select("id,crop_name,variety,lot_code,quantity_seeds,germination_rate_pct,expiry_date,storage_location").limit(150),
    supabase.from("orchard_nursery_batches").select("id,crop_succession_id,sow_date,seeds_sown,emerged_count,ready_count,transplanted_count,expected_ready_date,status,location").limit(200),
    supabase.from("orchard_crops").select("id,plot_id,crop_succession_id,crop_name,variety,planting_date,expected_harvest_date,status,estimated_yield,actual_yield,yield_unit").limit(250),
    supabase.from("orchard_care_logs").select("crop_id,activity_date,activity_type,hours_spent,weather_conditions,observations").order("activity_date", { ascending: false }).limit(250),
    supabase.from("orchard_pest_logs").select("crop_id,observation_date,pest_type,disease_name,severity_level,affected_percentage,treatment_applied,treatment_effectiveness,notes").order("observation_date", { ascending: false }).limit(250),
    supabase.from("orchard_harvest_records").select("crop_id,crop_succession_id,bed_allocation_id,harvest_lot_code,harvest_date,quantity_harvested,harvest_unit,quality_rating,storage_method,storage_location,total_market_value,notes").order("harvest_date", { ascending: false }).limit(250),
    supabase.from("orchard_notes").select("crop_id,crop_succession_id,plot_id,bed_id,note_type,title,body,observed_at").order("observed_at", { ascending: false }).limit(150),
    supabase.from("tasks").select("id,title,priority,status,due_date,location_name,task_category,estimated_minutes,source_type,source_id,source_label").eq("operational_area", "huerto_vinedo").limit(250),
  ])

  const sourceNames = ["game_plans","crop_cycles","successions","plots","beds","bed_allocations","seed_lots","nursery_batches","crops","care_logs","health_logs","harvests","notes","tasks"]
  const snapshot: Record<string, unknown[]> = {}
  const sourceCounts: Record<string, number> = {}
  for (let index = 0; index < sources.length; index += 1) {
    const result = sources[index]
    if (result.error) return NextResponse.json({ error: `Could not read ${sourceNames[index]}` }, { status: 500 })
    const rows = result.data ?? []
    snapshot[sourceNames[index]] = rows
    sourceCounts[sourceNames[index]] = rows.length
  }

  const instructions = `You are the Orchard operations assistant inside Blackswan Facility Core.
Use ONLY the authorized ORCHARD_SNAPSHOT supplied in the user input. Never invent rows, weather, agronomy facts, prices, yields, tasks, dates, or actions that are not present.

Configured read skill:\n${orchardSkillsPrompt("read")}

You may calculate deterministic totals, compare dates, identify missing links, summarize risks, and explain operational context.
When evidence is insufficient, say exactly what is missing.
Do not claim that an action was executed. Action proposals are handled by the separate approval workflow.
Do not recommend pesticides, chemicals, dosages, or other safety-sensitive treatment instructions; instead surface the recorded health context and recommend review by the responsible operator/agronomist.
Use concise operational English unless the user's question is Spanish, then answer in Spanish.
For factual claims, append one or more dataset labels in square brackets, such as [harvests], [crops], [tasks].
Distinguish recorded facts from inferences. Label inferred conclusions as "Inference" or "Inferencia".`

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: `QUESTION:\n${question}\n\nORCHARD_SNAPSHOT:\n${JSON.stringify(snapshot)}`,
        reasoning: { effort: "medium" },
        max_output_tokens: 1800,
      }),
    })
    const payload = await openaiResponse.json().catch(() => ({}))
    if (!openaiResponse.ok) {
      const errorMessage = typeof (payload as { error?: { message?: unknown } }).error?.message === "string" ? (payload as { error: { message: string } }).error.message : `OpenAI request failed (${openaiResponse.status})`
      await supabase.from("orchard_ai_queries").insert({ question, model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts, status: "failed", error_message: errorMessage })
      return NextResponse.json({ error: "Orchard AI could not answer right now" }, { status: 502 })
    }

    const answer = extractOutputText(payload)
    if (!answer) return NextResponse.json({ error: "Orchard AI returned an empty answer" }, { status: 502 })
    await supabase.from("orchard_ai_queries").insert({ question, answer, model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts, status: "completed" })
    return NextResponse.json({ answer, model: MODEL, sourceCounts })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    await supabase.from("orchard_ai_queries").insert({ question, model: MODEL, prompt_version: PROMPT_VERSION, source_counts: sourceCounts, status: "failed", error_message: errorMessage })
    return NextResponse.json({ error: "Orchard AI could not answer right now" }, { status: 502 })
  }
}

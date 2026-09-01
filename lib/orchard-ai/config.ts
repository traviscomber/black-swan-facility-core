import { heirloomParityKnowledgePrompt } from "@/lib/orchard/heirloom-parity"

export const ORCHARD_AI_MODEL = "gpt-5.6-sol"

export type OrchardAiSkill = {
  id: string
  mode: "read" | "proposal"
  description: string
  guardrail: string
}

export const ORCHARD_AI_SKILLS: OrchardAiSkill[] = [
  {
    id: "inspect_orchard",
    mode: "read",
    description: "Answer operational questions from authorized Orchard records, compare dates, summarize workload, surface missing links, calculate deterministic totals, and explain the Orchard product workflow.",
    guardrail: "Read-only. Never invent records or claim that an action was executed. Current operational facts must come from authorized Orchard data. Product-behavior reference knowledge may explain how a workflow is intended to operate, but reference values must never be presented as current Core facts unless the authorized snapshot confirms them. Do not invent agronomic, maintenance, workload, timing, yield, health, or commercial thresholds. Treat a threshold as policy only when its provenance is present in authorized Orchard context; otherwise report the underlying dates, quantities, percentages, ranges, or variance without classifying them as safe, risky, late, soon, good, bad, critical, or optimal.",
  },
  {
    id: "create_task",
    mode: "proposal",
    description: "Prepare a task proposal with title, priority, due date, duration, and an authorized Orchard location when available.",
    guardrail: "Proposal only. Human approval is required before execution. Do not invent urgency or timing thresholds; preserve explicit user priority and dates.",
  },
  {
    id: "create_game_plan",
    mode: "proposal",
    description: "Prepare a draft seasonal game plan with dates, season, objective, and notes.",
    guardrail: "Proposal only. Human approval is required before execution. Do not invent cadence, harvest-gap, maturity, yield, or performance thresholds.",
  },
  {
    id: "create_crop_cycle",
    mode: "proposal",
    description: "Add a crop cycle to an existing authorized game plan using exact plan IDs from Orchard context.",
    guardrail: "Proposal only. Do not invent game plan IDs or unsupported agronomic thresholds.",
  },
  {
    id: "create_succession",
    mode: "proposal",
    description: "Add a succession to an existing authorized crop cycle with sow, transplant, and harvest dates.",
    guardrail: "Proposal only. Do not invent crop cycle IDs, sequence numbers, cadence rules, or agronomic thresholds.",
  },
  {
    id: "allocate_bed",
    mode: "proposal",
    description: "Allocate an authorized active bed to an authorized succession using validated dates and capacity checks.",
    guardrail: "Proposal only. Do not invent bed or succession IDs; server validation remains authoritative. Do not turn proximity in time or repeated crop names into agronomic risk claims unless an authorized policy explicitly defines that rule.",
  },
  {
    id: "log_care",
    mode: "proposal",
    description: "Prepare a care-log proposal for an exact authorized crop, date, activity type, and only the operational details explicitly supplied by the user or present in authorized context.",
    guardrail: "Proposal only. Do not invent hours, weather, temperature, humidity, observations, treatment instructions, or agronomic thresholds.",
  },
  {
    id: "record_health_observation",
    mode: "proposal",
    description: "Prepare an observation-only crop health record with exact crop, date, pest or disease observation, severity, affected percentage, and notes when explicitly supported.",
    guardrail: "Observation only. Never propose pesticides, chemicals, dosage, treatment, or treatment effectiveness. Do not infer that a historical observation is still open or resolved.",
  },
  {
    id: "record_harvest",
    mode: "proposal",
    description: "Prepare a harvest record for an exact authorized crop using explicit date, positive quantity, unit, and optional factual quality, storage, value, and sales-channel details.",
    guardrail: "Proposal only. Never infer harvest quantity, quality, price, currency, or sales channel. A market value without a currency-bearing sales channel must not be described as a consolidated monetary result.",
  },
  {
    id: "create_sales_commitment",
    mode: "proposal",
    description: "Prepare a commercial commitment for an exact active sales channel with explicit crop, delivery dates, quantity, unit, and optional price and customer reference.",
    guardrail: "Proposal only. Currency must follow the selected sales channel; do not invent FX conversion or aggregate different currencies as one total.",
  },
]

export function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY || ""
}

export function orchardSkillsPrompt(mode: OrchardAiSkill["mode"]) {
  const skills = ORCHARD_AI_SKILLS
    .filter((skill) => skill.mode === mode)
    .map((skill) => `- ${skill.id}: ${skill.description} Guardrail: ${skill.guardrail}`)
    .join("\n")

  if (mode !== "read") return skills
  return `${skills}\n\nPRODUCT WORKFLOW REFERENCE (never operational truth unless the live snapshot confirms it):\n${heirloomParityKnowledgePrompt}`
}

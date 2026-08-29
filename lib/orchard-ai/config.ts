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
    description: "Answer operational questions from authorized Orchard records, compare dates, summarize workload, surface missing links, and calculate deterministic totals.",
    guardrail: "Read-only. Never invent records or claim that an action was executed.",
  },
  {
    id: "create_task",
    mode: "proposal",
    description: "Prepare a task proposal with title, priority, due date, duration, and an authorized Orchard location when available.",
    guardrail: "Proposal only. Human approval is required before execution.",
  },
  {
    id: "create_game_plan",
    mode: "proposal",
    description: "Prepare a draft seasonal game plan with dates, season, objective, and notes.",
    guardrail: "Proposal only. Human approval is required before execution.",
  },
  {
    id: "create_crop_cycle",
    mode: "proposal",
    description: "Add a crop cycle to an existing authorized game plan using exact plan IDs from Orchard context.",
    guardrail: "Proposal only. Do not invent game plan IDs.",
  },
  {
    id: "create_succession",
    mode: "proposal",
    description: "Add a succession to an existing authorized crop cycle with sow, transplant, and harvest dates.",
    guardrail: "Proposal only. Do not invent crop cycle IDs or sequence numbers.",
  },
  {
    id: "allocate_bed",
    mode: "proposal",
    description: "Allocate an authorized active bed to an authorized succession using validated dates and capacity checks.",
    guardrail: "Proposal only. Do not invent bed or succession IDs; server validation remains authoritative.",
  },
]

export function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY || ""
}

export function orchardSkillsPrompt(mode: OrchardAiSkill["mode"]) {
  return ORCHARD_AI_SKILLS
    .filter((skill) => skill.mode === mode)
    .map((skill) => `- ${skill.id}: ${skill.description} Guardrail: ${skill.guardrail}`)
    .join("\n")
}

export const ALL_GAME_PLANS = "all" as const

export type GamePlanScopeId = string

export type OrchardGamePlanRef = {
  id: string
  name: string
  season?: string | null
  start_date?: string
  end_date?: string
  status?: string
}

type CycleRef = {
  id: string
  game_plan_id: string
}

type SuccessionRef = {
  id: string
  crop_cycle_id: string
}

export function resolveRequestedGamePlanId(
  plans: OrchardGamePlanRef[],
  search: string,
): GamePlanScopeId {
  const requested = new URLSearchParams(search).get("game_plan")
  if (!requested) return ALL_GAME_PLANS
  return plans.some((plan) => plan.id === requested) ? requested : ALL_GAME_PLANS
}

export function resolveSelectedGamePlan<TPlan extends OrchardGamePlanRef>(
  plans: TPlan[],
  selectedPlanId: GamePlanScopeId,
): TPlan | null {
  if (selectedPlanId === ALL_GAME_PLANS) return null
  return plans.find((plan) => plan.id === selectedPlanId) ?? null
}

export function scopeGamePlanGraph<
  TCycle extends CycleRef,
  TSuccession extends SuccessionRef,
>(
  cycles: TCycle[],
  successions: TSuccession[],
  selectedPlanId: GamePlanScopeId,
) {
  const scopedCycles =
    selectedPlanId === ALL_GAME_PLANS
      ? cycles
      : cycles.filter((cycle) => cycle.game_plan_id === selectedPlanId)
  const cycleIds = new Set(scopedCycles.map((cycle) => cycle.id))
  const scopedSuccessions =
    selectedPlanId === ALL_GAME_PLANS
      ? successions
      : successions.filter((succession) => cycleIds.has(succession.crop_cycle_id))
  const successionIds = new Set(scopedSuccessions.map((succession) => succession.id))

  return { scopedCycles, cycleIds, scopedSuccessions, successionIds }
}

export function scopeBySuccessionId<T>(
  rows: T[],
  successionIds: Set<string>,
  selectedPlanId: GamePlanScopeId,
  getSuccessionId: (row: T) => string | null | undefined,
) {
  if (selectedPlanId === ALL_GAME_PLANS) return rows
  return rows.filter((row) => {
    const successionId = getSuccessionId(row)
    return Boolean(successionId && successionIds.has(successionId))
  })
}

export function syncGamePlanQuery(selectedPlanId: GamePlanScopeId) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (selectedPlanId === ALL_GAME_PLANS) url.searchParams.delete("game_plan")
  else url.searchParams.set("game_plan", selectedPlanId)
  window.history.replaceState({}, "", url.toString())
}

export function withGamePlanQuery(path: string, selectedPlanId: GamePlanScopeId) {
  if (selectedPlanId === ALL_GAME_PLANS) return path
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}game_plan=${encodeURIComponent(selectedPlanId)}`
}

export function gamePlanScopeLabel(
  plan: OrchardGamePlanRef | null,
  fallback: string,
) {
  if (!plan) return fallback
  return `${plan.name}${plan.season ? ` · ${plan.season}` : ""}`
}

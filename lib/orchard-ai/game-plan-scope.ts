type Row = Record<string, unknown>

export type OrchardAiGamePlanScope = {
  gamePlanId: string
  gamePlan: Row
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : []
}

function id(value: unknown) {
  return typeof value === "string" && value ? value : null
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function resolveOrchardAiGamePlanScope(
  snapshot: Record<string, unknown[]>,
  requestedGamePlanId: string | null,
): OrchardAiGamePlanScope | null {
  if (!requestedGamePlanId) return null
  const gamePlan = rows(snapshot.game_plans).find((row) => id(row.id) === requestedGamePlanId)
  return gamePlan ? { gamePlanId: requestedGamePlanId, gamePlan } : null
}

export function scopeOrchardAiSnapshot(
  snapshot: Record<string, unknown[]>,
  scope: OrchardAiGamePlanScope | null,
) {
  if (!scope) return snapshot

  const scoped: Record<string, unknown[]> = { ...snapshot }
  const gamePlans = rows(snapshot.game_plans).filter((row) => id(row.id) === scope.gamePlanId)
  const cropCycles = rows(snapshot.crop_cycles).filter((row) => id(row.game_plan_id) === scope.gamePlanId)
  const cycleIds = new Set(cropCycles.map((row) => id(row.id)).filter((value): value is string => Boolean(value)))
  const successions = rows(snapshot.successions).filter((row) => {
    const cycleId = id(row.crop_cycle_id)
    return Boolean(cycleId && cycleIds.has(cycleId))
  })
  const successionIds = new Set(successions.map((row) => id(row.id)).filter((value): value is string => Boolean(value)))
  const crops = rows(snapshot.crops).filter((row) => {
    const successionId = id(row.crop_succession_id)
    return Boolean(successionId && successionIds.has(successionId))
  })
  const cropIds = new Set(crops.map((row) => id(row.id)).filter((value): value is string => Boolean(value)))

  scoped.game_plans = gamePlans
  scoped.crop_cycles = cropCycles
  scoped.successions = successions
  if (snapshot.lifecycle) scoped.lifecycle = rows(snapshot.lifecycle).filter((row) => {
    const successionId = id(row.crop_succession_id)
    const cycleId = id(row.crop_cycle_id)
    return Boolean((successionId && successionIds.has(successionId)) || (cycleId && cycleIds.has(cycleId)))
  })
  if (snapshot.crops) scoped.crops = crops

  for (const key of ["bed_allocations", "allocations", "nursery_batches", "revenue_targets", "sales_commitments"] as const) {
    if (!snapshot[key]) continue
    scoped[key] = rows(snapshot[key]).filter((row) => {
      const successionId = id(row.crop_succession_id)
      return Boolean(successionId && successionIds.has(successionId))
    })
  }

  for (const key of ["care_logs", "health_logs"] as const) {
    if (!snapshot[key]) continue
    scoped[key] = rows(snapshot[key]).filter((row) => {
      const cropId = id(row.crop_id)
      return Boolean(cropId && cropIds.has(cropId))
    })
  }

  if (snapshot.harvests) scoped.harvests = rows(snapshot.harvests).filter((row) => {
    const successionId = id(row.crop_succession_id)
    const cropId = id(row.crop_id)
    return Boolean((successionId && successionIds.has(successionId)) || (cropId && cropIds.has(cropId)))
  })

  if (snapshot.notes) scoped.notes = rows(snapshot.notes).filter((row) => {
    const successionId = id(row.crop_succession_id)
    const cropId = id(row.crop_id)
    return Boolean((successionId && successionIds.has(successionId)) || (cropId && cropIds.has(cropId)))
  })

  if (snapshot.tasks) {
    const allowedSourceIds = new Set<string>([scope.gamePlanId, ...cycleIds, ...successionIds, ...cropIds])
    scoped.tasks = rows(snapshot.tasks).filter((row) => {
      const sourceId = id(row.source_id)
      return Boolean(sourceId && allowedSourceIds.has(sourceId))
    })
  }

  if (snapshot.seed_lots) {
    const cycleKeys = new Set(cropCycles.map((row) => `${text(row.crop_name)}::${text(row.variety)}`))
    const cropNames = new Set(cropCycles.map((row) => text(row.crop_name)).filter(Boolean))
    scoped.seed_lots = rows(snapshot.seed_lots).filter((row) => {
      const cropName = text(row.crop_name)
      const key = `${cropName}::${text(row.variety)}`
      return cycleKeys.has(key) || cropNames.has(cropName)
    })
  }

  const allocationRows = rows(scoped.bed_allocations ?? scoped.allocations)
  if (allocationRows.length && snapshot.beds) {
    const bedIds = new Set(allocationRows.map((row) => id(row.bed_id)).filter((value): value is string => Boolean(value)))
    const beds = rows(snapshot.beds).filter((row) => {
      const bedId = id(row.id)
      return Boolean(bedId && bedIds.has(bedId))
    })
    scoped.beds = beds
    if (snapshot.plots) {
      const plotIds = new Set(beds.map((row) => id(row.plot_id)).filter((value): value is string => Boolean(value)))
      scoped.plots = rows(snapshot.plots).filter((row) => {
        const plotId = id(row.id)
        return Boolean(plotId && plotIds.has(plotId))
      })
    }
  } else {
    if (snapshot.beds) scoped.beds = []
    if (snapshot.plots) scoped.plots = []
  }

  return scoped
}

export function orchardAiScopeLabel(scope: OrchardAiGamePlanScope | null) {
  if (!scope) return "All authorized Orchard records"
  const name = typeof scope.gamePlan.name === "string" ? scope.gamePlan.name : scope.gamePlanId
  const season = typeof scope.gamePlan.season === "string" && scope.gamePlan.season ? ` · ${scope.gamePlan.season}` : ""
  return `${name}${season}`
}

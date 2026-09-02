export type SeedDemandUnit = "seed_count" | "g" | "kg" | "tuber_count"
export type SeedDemandStatus = "ready" | "incomplete" | "source_conflict"

export type SeedDemand = {
  value: number | null
  unit: SeedDemandUnit
  status: SeedDemandStatus
  reason: string | null
}

export type TransplantSeedDemandInput = {
  plannedPlants: number | null
  seedsPerPlant: number | null
  germinationRatePct: number | null
}

export type DirectSeedDemandInput = {
  plannedBedM: number | null
  demandValue: number | null
  demandUnit: SeedDemandUnit | null
  referenceBedM: number | null
  conflictStatus?: "none" | "source_conflict" | "needs_review" | null
}

const positive = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value > 0

export function estimateTransplantSeedDemand(input: TransplantSeedDemandInput): SeedDemand {
  if (!positive(input.plannedPlants)) {
    return { value: null, unit: "seed_count", status: "incomplete", reason: "missing_planned_plants" }
  }
  if (!positive(input.seedsPerPlant)) {
    return { value: null, unit: "seed_count", status: "incomplete", reason: "missing_seeds_per_plant" }
  }
  if (!positive(input.germinationRatePct) || input.germinationRatePct! > 100) {
    return { value: null, unit: "seed_count", status: "incomplete", reason: "missing_or_invalid_germination" }
  }

  return {
    value: Math.ceil((input.plannedPlants! * input.seedsPerPlant!) / (input.germinationRatePct! / 100)),
    unit: "seed_count",
    status: "ready",
    reason: null,
  }
}

export function estimateDirectSeedDemand(input: DirectSeedDemandInput): SeedDemand {
  if (input.conflictStatus === "source_conflict" || input.conflictStatus === "needs_review") {
    return {
      value: null,
      unit: input.demandUnit ?? "seed_count",
      status: "source_conflict",
      reason: "direct_seeding_profile_conflict",
    }
  }
  if (!positive(input.plannedBedM)) {
    return { value: null, unit: input.demandUnit ?? "seed_count", status: "incomplete", reason: "missing_planned_bed_m" }
  }
  if (!positive(input.demandValue) || !input.demandUnit) {
    return { value: null, unit: input.demandUnit ?? "seed_count", status: "incomplete", reason: "missing_direct_seed_rate" }
  }
  if (!positive(input.referenceBedM)) {
    return { value: null, unit: input.demandUnit, status: "incomplete", reason: "missing_reference_bed_m" }
  }

  return {
    value: (input.demandValue! / input.referenceBedM!) * input.plannedBedM!,
    unit: input.demandUnit,
    status: "ready",
    reason: null,
  }
}

export function groupReadyDemandByUnit(rows: SeedDemand[]): Partial<Record<SeedDemandUnit, number>> {
  const grouped: Partial<Record<SeedDemandUnit, number>> = {}
  for (const row of rows) {
    if (row.status !== "ready" || row.value == null) continue
    grouped[row.unit] = (grouped[row.unit] ?? 0) + row.value
  }
  return grouped
}

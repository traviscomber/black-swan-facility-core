export type ProcurementUnit = "seed_count" | "g" | "tuber_count"
export type ProcurementBasis = "explicit_germination" | "workbook_global_fallback" | "direct_sow_density" | "manual_spacing"

export type ProcurementDemand = {
  value: number | null
  unit: ProcurementUnit
  basis: ProcurementBasis | null
  reason: string | null
}

const positive = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value > 0

export function estimateTransplantProcurement(input: {
  plannedPlants: number | null
  seedsPerPlant: number | null
  germinationRatePct: number | null
  fallbackGerminationRatePct: number | null
}): ProcurementDemand {
  if (!positive(input.plannedPlants)) return { value: null, unit: "seed_count", basis: null, reason: "missing_planned_plants" }
  if (!positive(input.seedsPerPlant)) return { value: null, unit: "seed_count", basis: null, reason: "missing_seeds_per_plant" }

  const explicit = positive(input.germinationRatePct) && input.germinationRatePct! <= 100 ? input.germinationRatePct! : null
  const fallback = positive(input.fallbackGerminationRatePct) && input.fallbackGerminationRatePct! <= 100 ? input.fallbackGerminationRatePct! : null
  const germination = explicit ?? fallback
  if (!germination) return { value: null, unit: "seed_count", basis: null, reason: "missing_procurement_germination_factor" }

  return {
    value: Math.ceil((input.plannedPlants! * input.seedsPerPlant!) / (germination / 100)),
    unit: "seed_count",
    basis: explicit ? "explicit_germination" : "workbook_global_fallback",
    reason: null,
  }
}

export function estimateDirectProcurement(input: {
  plannedBedM: number | null
  densityG: number | null
  referenceBedM?: number | null
}): ProcurementDemand {
  const referenceBedM = input.referenceBedM ?? 30
  if (!positive(input.plannedBedM)) return { value: null, unit: "g", basis: null, reason: "missing_planned_bed_m" }
  if (!positive(input.densityG)) return { value: null, unit: "g", basis: null, reason: "missing_direct_seed_density" }
  if (!positive(referenceBedM)) return { value: null, unit: "g", basis: null, reason: "missing_reference_bed_m" }
  return { value: (input.densityG! / referenceBedM!) * input.plannedBedM!, unit: "g", basis: "direct_sow_density", reason: null }
}

export function estimateTuberProcurement(input: { plannedBedM: number | null; spacingCm: number | null }): ProcurementDemand {
  if (!positive(input.plannedBedM)) return { value: null, unit: "tuber_count", basis: null, reason: "missing_planned_bed_m" }
  if (!positive(input.spacingCm)) return { value: null, unit: "tuber_count", basis: null, reason: "missing_tuber_spacing" }
  return { value: Math.ceil(input.plannedBedM! / (input.spacingCm! / 100)), unit: "tuber_count", basis: "manual_spacing", reason: null }
}

export function parseApproxGrams(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.replace(",", ".").match(/([0-9]+(?:\.[0-9]+)?)\s*g\b/i)
  return match ? Number(match[1]) : null
}

export function parseCentimeters(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.replace(",", ".").match(/([0-9]+(?:\.[0-9]+)?)\s*cm\b/i)
  return match ? Number(match[1]) : null
}

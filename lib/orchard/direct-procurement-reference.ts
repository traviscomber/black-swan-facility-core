import { parseApproxGrams } from "./seed-procurement.ts"

export type DirectProcurementReferenceRow = {
  crop: string
  cultivar: string
  density_30m: string
}

export type DirectProcurementReference = {
  sourceCrop: string
  densityG: number
  evidence: "all_cultivars" | "single_reference" | "density_invariant"
}

const SOURCE_CROP_BY_CANONICAL: Record<string, string> = {
  Arugula: "Rucula",
  "Bush Beans": "Beans (bush)",
  Carrots: "Carrots",
  Peas: "Sweet peas",
  Mizuna: "Mizuna",
  Radishes: "Radishes",
  Tatsoi: "Asian greens (baby)",
  "Storage Beetroot": "Beets",
}

/**
 * Resolves only a source-backed 30 m gram density.
 *
 * We prefer an explicit `All` cultivar row. Otherwise a source is usable only
 * when it has one row or every matching row has the same gram density. This
 * keeps cultivar ambiguity from silently becoming a purchasing assumption.
 */
export function resolveDirectProcurementReference(
  canonicalCrop: string,
  rows: DirectProcurementReferenceRow[],
): DirectProcurementReference | null {
  const sourceCrop = SOURCE_CROP_BY_CANONICAL[canonicalCrop]
  if (!sourceCrop) return null

  const matching = rows.filter((row) => row.crop === sourceCrop)
  if (matching.length === 0) return null

  const allCultivars = matching.find((row) => row.cultivar.trim().toLowerCase() === "all")
  if (allCultivars) {
    const densityG = parseApproxGrams(allCultivars.density_30m)
    return densityG ? { sourceCrop, densityG, evidence: "all_cultivars" } : null
  }

  const parsed = matching.map((row) => parseApproxGrams(row.density_30m))
  if (parsed.some((value) => value == null)) return null
  const densities = parsed as number[]
  const unique = Array.from(new Set(densities))
  if (unique.length !== 1) return null

  return {
    sourceCrop,
    densityG: unique[0],
    evidence: matching.length === 1 ? "single_reference" : "density_invariant",
  }
}

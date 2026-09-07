import { parseApproxGrams, parseCentimeters, type DirectProcurementRate } from "./seed-procurement.ts"

export type DirectProcurementReferenceRow = {
  crop: string
  cultivar: string
  density_30m: string
  rows_per_bed?: number
  spacing_cm?: string
}

export type DirectProcurementReference = {
  sourceCrop: string
  densityG: DirectProcurementRate
  evidence: "all_cultivars" | "single_reference" | "density_invariant" | "season_plan_match" | "external_reference"
  sourceLabel?: string
  sourceUrl?: string
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

const EXTERNAL_DIRECT_REFERENCE: Record<string, DirectProcurementReference> = {
  Corn: {
    sourceCrop: "Sweet corn",
    densityG: { unit: "seed_count", seedsPerFootPerRow: 1.5, rowsPerBed: 2, sourceKey: "umn_sweet_corn_2_rows_8in_300_per_100ft_bed" },
    evidence: "external_reference",
    sourceLabel: "University of Minnesota Extension · Crop and field planning tools for vegetable farmers",
    sourceUrl: "https://extension.umn.edu/vegetable-growing-guides-farmers/crop-and-field-planning-tools-vegetable-farmers",
  },
  Shallots: {
    sourceCrop: "Shallots",
    densityG: { unit: "seed_count", seedsPerFootPerRow: 20, rowsPerBed: 3, sourceKey: "johnnys_shallot_direct_seed_20_per_ft" },
    evidence: "external_reference",
    sourceLabel: "Johnny's Selected Seeds · Shallots key growing information",
    sourceUrl: "https://www.johnnyseeds.com/growers-library/vegetables/shallots/shallots-key-growing-information.html",
  },
  "White Radish (Daikon)": {
    sourceCrop: "Storage radish / Daikon",
    densityG: { unit: "seed_count", seedsPerFootPerRow: 10, rowsPerBed: 3, sourceKey: "umn_storage_radish_3_rows_10_per_ft" },
    evidence: "external_reference",
    sourceLabel: "University of Minnesota Extension · Crop and field planning tools for vegetable farmers",
    sourceUrl: "https://extension.umn.edu/vegetable-growing-guides-farmers/crop-and-field-planning-tools-vegetable-farmers",
  },
}

function currentSeasonSourceMatch(canonicalCrop: string, rows: DirectProcurementReferenceRow[]): DirectProcurementReference | null {
  if (canonicalCrop !== "Arugula") return null
  const match = rows.find((row) =>
    row.crop === "Rucula" &&
    row.cultivar.trim().toLowerCase() === "astro" &&
    row.rows_per_bed === 12 &&
    parseCentimeters(row.spacing_cm) === 4,
  )
  const densityG = match ? parseApproxGrams(match.density_30m) : null
  if (!densityG) return null
  return {
    sourceCrop: "Rucula",
    densityG,
    evidence: "season_plan_match",
    sourceLabel: "Dietrich 2026/27 Ds Chart · Rucula / Astro · 12 rows · 4 cm",
  }
}

/**
 * Resolves a source-backed direct-sowing procurement rate.
 *
 * Workbook gram densities remain preferred. A season-specific Arugula row is
 * allowed only because the current 2026/27 Crop Chart uses the same 4 cm
 * spacing as the 12-row Astro source profile. Corn, shallots and daikon have
 * no Dietrich gram row, so they use explicit published direct-seeding rates
 * stored here with source provenance instead of inventing a local density.
 */
export function resolveDirectProcurementReference(
  canonicalCrop: string,
  rows: DirectProcurementReferenceRow[],
): DirectProcurementReference | null {
  const sourceCrop = SOURCE_CROP_BY_CANONICAL[canonicalCrop]
  if (!sourceCrop) return EXTERNAL_DIRECT_REFERENCE[canonicalCrop] ?? null

  const matching = rows.filter((row) => row.crop === sourceCrop)
  if (matching.length === 0) return EXTERNAL_DIRECT_REFERENCE[canonicalCrop] ?? null

  const seasonalMatch = currentSeasonSourceMatch(canonicalCrop, matching)
  if (seasonalMatch) return seasonalMatch

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

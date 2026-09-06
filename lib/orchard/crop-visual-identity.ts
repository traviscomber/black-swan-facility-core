export type CropVisualFamily = "LEAFY" | "BRASSICA" | "ROOT" | "CUCURBIT" | "FRUITING" | "UNCLASSIFIED"

export const CROP_FAMILY_COLORS: Record<CropVisualFamily, string> = {
  LEAFY: "#5B8E55",
  BRASSICA: "#7C8C54",
  ROOT: "#D08B2E",
  CUCURBIT: "#4D9AAA",
  FRUITING: "#CD6274",
  UNCLASSIFIED: "#8E74C9",
}

export function normalizeCropIdentity(value: string) {
  return value.replace(/\([^)]*\)/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "")
}

export function cropFamilyColor(family: string | null | undefined) {
  const key = String(family ?? "").toUpperCase() as CropVisualFamily
  return CROP_FAMILY_COLORS[key] ?? CROP_FAMILY_COLORS.UNCLASSIFIED
}

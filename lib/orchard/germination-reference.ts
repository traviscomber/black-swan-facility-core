export const ORCHARD_GERMINATION_PLANNING_REFERENCE = {
  workbook: "Copy of Crop Plan 26-27 Black Swan Test.xlsx",
  workbookSha256: "e29b581d0c2190b8ea43d8116ce19cfac85f8b9be6f1abdb2b676e984d186683",
  sheet: "Seeds",
  headerCell: "J3",
  header: "Porcentaje de germinacion de acuerdo a acatalogo",
  valueRange: "J4:J30",
  planningFallbackPct: 90,
  semantics: "Workbook-global seed-purchase planning factor. It is not observed germination and is not proven crop- or cultivar-specific catalog evidence.",
  operationalStatus: "procurement_planning_fallback",
} as const

export const ORCHARD_GERMINATION_LAYERS = {
  procurementFallback: "workbook_global_planning",
  expectedCropOrCultivar: "unresolved",
  seedLotCatalog: "orchard_seed_lots.germination_rate_pct",
  observedBatch: "emerged_count / seeds_sown * 100",
  potatoes: "not_applicable_conventional_seed_germination",
} as const

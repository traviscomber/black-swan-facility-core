export type HeirloomReferencePlanting = {
  crop: string
  generation: number
  bedMeters: number
  start: string
  end: string
  cultivar: string
}

export type HeirloomOnboardingStep = {
  order: number
  id: string
  label: string
  description: string
  coreHref: string
  completionSignal: string
}

export const HEIRLOOM_FIELD_STUDY_DATE = "2026-09-01"

export const HEIRLOOM_REFERENCE_SETUP = {
  farmName: "BS",
  country: "Chile",
  currency: "CLP",
  address: "Black Swan Farm, Fundo Corcovado, Valdivia, Región de Los Ríos, Chile",
  latitude: -39.699435,
  longitude: -73.205363,
  seasonLabel: "Aug 2026 - Jul 2027",
  measurementSystem: "metric",
  temperatureUnit: "celsius",
  plantingAmountUnit: "bed_meter",
  standardBedWidthCm: 76,
  standardBedLengthM: 30,
  standardPathWidthCm: 46,
  lastHardFrost: "2026-08-29",
  lastLightFrost: "2026-09-24",
  fieldAreaName: "Farm Area 1",
  fieldBlockName: "Orchard BlackSwan Campo",
  fieldBlockBeds: 18,
  fieldBlockBedLengthM: 30,
} as const

export const HEIRLOOM_ONBOARDING_STEPS: HeirloomOnboardingStep[] = [
  { order: 1, id: "farm-map", label: "Map Your Farm", description: "Create the farm area and physical growing structures.", coreHref: "/orchard/crop-map", completionSignal: "canonical physical plot/field block and active beds exist" },
  { order: 2, id: "favorite-crop", label: "Choose a favorite crop", description: "Choose crops/cultivars for the season.", coreHref: "/orchard/crops", completionSignal: "selected Game Plan contains at least one crop cycle" },
  { order: 3, id: "game-plan", label: "Create Your Game Plan", description: "Plan crop successions on the seasonal calendar.", coreHref: "/orchard/game-plan/season", completionSignal: "selected Game Plan contains planned successions" },
  { order: 4, id: "crop-map", label: "Organize Your Crop Map", description: "Allocate plantings to physical beds or protected structures.", coreHref: "/orchard/crop-map/auto-place", completionSignal: "selected Game Plan contains at least one bed allocation" },
  { order: 5, id: "financial-forecast", label: "Project Your Financial Forecasts", description: "Set planned yields, prices and revenue targets.", coreHref: "/orchard/game-plan/forecast", completionSignal: "selected Game Plan contains at least one revenue target" },
  { order: 6, id: "data-charts", label: "Review Your Data Charts", description: "Review the agricultural data views that feed operations.", coreHref: "/orchard/charts", completionSignal: "at least one saved Orchard chart definition exists" },
  { order: 7, id: "seed-inventory", label: "Check Your Seed Inventory", description: "Review seed inventory and procurement readiness.", coreHref: "/orchard/nursery", completionSignal: "at least one seed lot exists" },
  { order: 8, id: "workload", label: "Manage Your Workload", description: "Review generated and ad-hoc work in list/week/workload views.", coreHref: "/orchard/work", completionSignal: "at least one Orchard operational task exists" },
]

export const HEIRLOOM_REFERENCE_PLANTINGS: HeirloomReferencePlanting[] = [
  { crop: "Arugula", generation: 1, bedMeters: 9, start: "2026-11-24", end: "2027-01-04", cultivar: "Generic" },
  { crop: "Arugula", generation: 2, bedMeters: 9, start: "2026-12-08", end: "2027-01-18", cultivar: "Generic" },
  { crop: "Arugula", generation: 3, bedMeters: 9, start: "2026-12-22", end: "2027-02-01", cultivar: "Generic" },
  { crop: "Arugula", generation: 4, bedMeters: 9, start: "2027-01-05", end: "2027-02-15", cultivar: "Generic" },
  { crop: "Broccoli", generation: 1, bedMeters: 15, start: "2026-10-01", end: "2026-12-09", cultivar: "Generic" },
  { crop: "Broccoli", generation: 2, bedMeters: 15, start: "2026-10-15", end: "2026-12-23", cultivar: "Generic" },
  { crop: "Broccoli", generation: 3, bedMeters: 15, start: "2026-10-29", end: "2027-01-06", cultivar: "Generic" },
  { crop: "Bush beans", generation: 1, bedMeters: 30, start: "2026-11-04", end: "2027-01-14", cultivar: "Generic" },
  { crop: "Carrots (fresh)", generation: 1, bedMeters: 30, start: "2026-09-20", end: "2026-12-04", cultivar: "Generic" },
  { crop: "Carrots (fresh)", generation: 2, bedMeters: 30, start: "2026-11-01", end: "2027-01-15", cultivar: "Generic" },
  { crop: "Cauliflower / Romanesco", generation: 1, bedMeters: 15, start: "2026-10-01", end: "2026-12-29", cultivar: "Generic" },
  { crop: "Cauliflower / Romanesco", generation: 2, bedMeters: 15, start: "2026-10-15", end: "2027-01-12", cultivar: "Generic" },
  { crop: "Cauliflower / Romanesco", generation: 3, bedMeters: 15, start: "2026-10-29", end: "2027-01-26", cultivar: "Generic" },
  { crop: "Celery (cut-and-come-again)", generation: 1, bedMeters: 15, start: "2026-10-10", end: "2027-04-27", cultivar: "Generic" },
  { crop: "Cucumber", generation: 1, bedMeters: 15, start: "2026-11-06", end: "2027-01-17", cultivar: "Generic" },
  { crop: "Cucumber", generation: 2, bedMeters: 15, start: "2026-11-13", end: "2027-01-24", cultivar: "Generic" },
  { crop: "Dill", generation: 1, bedMeters: 9, start: "2026-11-20", end: "2027-01-03", cultivar: "Generic" },
  { crop: "Dill", generation: 2, bedMeters: 9, start: "2026-12-11", end: "2027-01-24", cultivar: "Generic" },
  { crop: "Eggplant", generation: 1, bedMeters: 15, start: "2026-10-16", end: "2027-05-29", cultivar: "Generic" },
  { crop: "Hot peppers", generation: 1, bedMeters: 15, start: "2026-10-10", end: "2027-01-23", cultivar: "Generic" },
  { crop: "Kale", generation: 1, bedMeters: 15, start: "2026-10-15", end: "2027-03-19", cultivar: "Generic" },
  { crop: "Lettuce", generation: 1, bedMeters: 15, start: "2026-11-05", end: "2026-12-29", cultivar: "Generic" },
  { crop: "Lettuce", generation: 2, bedMeters: 15, start: "2026-11-26", end: "2027-01-19", cultivar: "Generic" },
  { crop: "Lettuce", generation: 3, bedMeters: 15, start: "2026-12-17", end: "2027-02-09", cultivar: "Generic" },
  { crop: "Lettuce", generation: 4, bedMeters: 15, start: "2027-01-07", end: "2027-03-02", cultivar: "Generic" },
  { crop: "Onion (fresh)", generation: 1, bedMeters: 30, start: "2026-09-20", end: "2026-12-08", cultivar: "Generic" },
  { crop: "Onion (fresh)", generation: 2, bedMeters: 30, start: "2026-10-11", end: "2026-12-29", cultivar: "Generic" },
  { crop: "Parsley", generation: 1, bedMeters: 15, start: "2026-11-15", end: "2027-02-26", cultivar: "Generic" },
  { crop: "Peas", generation: 1, bedMeters: 30, start: "2026-10-26", end: "2027-01-22", cultivar: "Generic" },
  { crop: "Potato (new)", generation: 1, bedMeters: 120, start: "2026-09-10", end: "2026-12-22", cultivar: "Generic" },
  { crop: "Potato (new)", generation: 2, bedMeters: 120, start: "2026-09-24", end: "2027-01-05", cultivar: "Generic" },
  { crop: "Swiss Chard", generation: 1, bedMeters: 15, start: "2026-10-28", end: "2027-02-24", cultivar: "Generic" },
]

export const HEIRLOOM_REFERENCE_TOTAL_BED_METERS = HEIRLOOM_REFERENCE_PLANTINGS.reduce((sum, row) => sum + row.bedMeters, 0)
export const HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS = HEIRLOOM_REFERENCE_SETUP.fieldBlockBeds * HEIRLOOM_REFERENCE_SETUP.fieldBlockBedLengthM
export const HEIRLOOM_REFERENCE_PEAK_BED_METERS = 678
export const HEIRLOOM_REFERENCE_PEAK_DATE = "2026-11-26"

export const heirloomParityKnowledgePrompt = `
HEIRLOOM PARITY FIELD STUDY (${HEIRLOOM_FIELD_STUDY_DATE})
This is product-behavior reference knowledge collected by walking the authenticated Heirloom onboarding for Black Swan. It is NOT a substitute for current Black Swan Core operational rows. Never state these reference values as current Core facts unless ORCHARD_SNAPSHOT independently confirms them.

Reference workflow: 8 onboarding steps in this order: ${HEIRLOOM_ONBOARDING_STEPS.map((step) => `${step.order}. ${step.label}`).join("; ")}.
Reference farm settings: metric + Celsius; planting quantity unit = bed meter; standard bed = 76 cm x 30 m; path = 46 cm; season Aug 2026-Jul 2027; Chile/CLP; last hard frost Aug 29 2026; last light frost Sep 24 2026.
Reference physical structure: Farm Area 1 contains Field Block "Orchard BlackSwan Campo" with 18 beds of 30 m.
Reference Crop Map behavior: plantings are grouped by crop, each generation exposes start/end dates and required bed meters, and the user drags one planting at a time onto a bed. Partial bed occupation is valid and must preserve cumulative bed-meter capacity per bed across overlapping dates. No explicit within-bed offset was observed, so do not invent one. The observed reference queue had 32 plantings. One Arugula generation of 9 bed m was successfully placed on bed 17, moving onboarding from 6/8 to 7/8.
Reference workload behavior: Tasks has List, Week Board and Workload Graph. Ad-hoc tasks have task name, estimated minutes, assignee, date, notes and recurrence. The reference AI assistant answers questions about using the app but explicitly says general farming questions are out of scope.
Capacity finding from the 32 reference plantings: total requested bed-meter work = ${HEIRLOOM_REFERENCE_TOTAL_BED_METERS} bed m; physical instantaneous capacity = ${HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS} bed m; peak concurrent demand = ${HEIRLOOM_REFERENCE_PEAK_BED_METERS} bed m on ${HEIRLOOM_REFERENCE_PEAK_DATE}, a ${HEIRLOOM_REFERENCE_PEAK_BED_METERS - HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS} bed m shortfall. Treat this as a parity-study warning, not as a current Core allocation result.
`.trim()

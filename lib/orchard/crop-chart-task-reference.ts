export type OrchardCropChartTaskAction = {
  activity: string
  offsetDays: number | null
  sourceColumn: string
  kind: "implantation" | "follow_up" | "conditional"
}

export type OrchardCropChartTaskProfile = {
  canonicalCrop: string
  sourceRow: number
  propagation: "DS" | "TR"
  actions: readonly OrchardCropChartTaskAction[]
}

export const ORCHARD_CROP_CHART_TASK_SOURCE = {
  workbook: "Copy of Crop Plan 26-27 Black Swan Test.xlsx",
  workbookSha256: "e29b581d0c2190b8ea43d8116ce19cfac85f8b9be6f1abdb2b676e984d186683",
  sheet: "Crop Chart",
  semantics: "Task offsets are source-observed day offsets relative to implantation. The DS/TR row at day 0 is the implantation anchor. Undated actions remain conditional and are never assigned a fabricated date.",
  operationalStatus: "planning_reference_only",
} as const

export const ORCHARD_CROP_CHART_TASK_PROFILES = [
  { canonicalCrop: "Swiss Chard", sourceRow: 7, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM7", kind: "implantation" },
    { activity: "Boron", offsetDays: 20, sourceColumn: "AO7", kind: "follow_up" },
    { activity: "Boron", offsetDays: 50, sourceColumn: "AQ7", kind: "follow_up" },
  ]},
  { canonicalCrop: "Chili Pepper", sourceRow: 9, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM9", kind: "implantation" },
  ]},
  { canonicalCrop: "Celery", sourceRow: 12, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM12", kind: "implantation" },
    { activity: "Hoe", offsetDays: 14, sourceColumn: "AO12", kind: "follow_up" },
    { activity: "Hoe + top-up fertilization", offsetDays: 28, sourceColumn: "AQ12", kind: "follow_up" },
    { activity: "Hoe", offsetDays: 42, sourceColumn: "AS12", kind: "follow_up" },
    { activity: "Hoe + top-up fertilization", offsetDays: 56, sourceColumn: "AU12", kind: "follow_up" },
    { activity: "Hoe", offsetDays: 70, sourceColumn: "AW12", kind: "follow_up" },
    { activity: "Hoe + top-up fertilization", offsetDays: 94, sourceColumn: "AY12", kind: "follow_up" },
  ]},
  { canonicalCrop: "Peas", sourceRow: 14, propagation: "DS", actions: [
    { activity: "DS + Seed tray", offsetDays: 0, sourceColumn: "AM14", kind: "implantation" },
    { activity: "Hoe + TR", offsetDays: 14, sourceColumn: "AO14", kind: "follow_up" },
    { activity: "Hoe + supp. fertilization + Straw mulch + Trelissing", offsetDays: 25, sourceColumn: "AQ14", kind: "follow_up" },
    { activity: "Trelissing", offsetDays: 32, sourceColumn: "AS14", kind: "follow_up" },
    { activity: "Trelissing", offsetDays: 39, sourceColumn: "AU14", kind: "follow_up" },
    { activity: "Trelissing", offsetDays: 46, sourceColumn: "AW14", kind: "follow_up" },
    { activity: "Trelissing", offsetDays: 53, sourceColumn: "AY14", kind: "follow_up" },
  ]},
  { canonicalCrop: "Eggplants (field)", sourceRow: 15, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM15", kind: "implantation" },
  ]},
  { canonicalCrop: "Broccoli", sourceRow: 20, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM20", kind: "implantation" },
    { activity: "Boron", offsetDays: 14, sourceColumn: "AO20", kind: "follow_up" },
    { activity: "Straw mulch", offsetDays: 21, sourceColumn: "AQ20", kind: "follow_up" },
  ]},
  { canonicalCrop: "Onion", sourceRow: 23, propagation: "TR", actions: [
    { activity: "Germinar malezas", offsetDays: -12, sourceColumn: "AM23", kind: "follow_up" },
    { activity: "TR", offsetDays: 0, sourceColumn: "AO23", kind: "implantation" },
    { activity: "Pyro", offsetDays: 0, sourceColumn: "AQ23", kind: "follow_up" },
    { activity: "Biodisc", offsetDays: 10, sourceColumn: "AS23", kind: "follow_up" },
    { activity: "Manual weeding", offsetDays: 55, sourceColumn: "AU23", kind: "follow_up" },
  ]},
  { canonicalCrop: "Cauliflower", sourceRow: 28, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM28", kind: "implantation" },
    { activity: "Hoe, Boron, Straw mulch", offsetDays: 20, sourceColumn: "AO28", kind: "follow_up" },
    { activity: "Boron", offsetDays: 50, sourceColumn: "AQ28", kind: "follow_up" },
  ]},
  { canonicalCrop: "Dill", sourceRow: 31, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM31", kind: "implantation" },
    { activity: "Flextine", offsetDays: 10, sourceColumn: "AO31", kind: "follow_up" },
    { activity: "Hoe", offsetDays: 17, sourceColumn: "AQ31", kind: "follow_up" },
  ]},
  { canonicalCrop: "Kale", sourceRow: 39, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM39", kind: "implantation" },
    { activity: "Boron", offsetDays: 20, sourceColumn: "AO39", kind: "follow_up" },
    { activity: "Boron", offsetDays: 50, sourceColumn: "AQ39", kind: "follow_up" },
  ]},
  { canonicalCrop: "Lettuce", sourceRow: 41, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM41", kind: "implantation" },
    { activity: "Hoe", offsetDays: 12, sourceColumn: "AO41", kind: "follow_up" },
  ]},
  { canonicalCrop: "Storage Potatoes", sourceRow: 48, propagation: "DS", actions: [
    { activity: "DS", offsetDays: 0, sourceColumn: "AM48", kind: "implantation" },
    { activity: "Supp. Fertilization + Hilling", offsetDays: 21, sourceColumn: "AO48", kind: "follow_up" },
    { activity: "Supp. Fertilization + Hilling", offsetDays: 42, sourceColumn: "AQ48", kind: "follow_up" },
    { activity: "Haulm topping", offsetDays: null, sourceColumn: "AS48", kind: "conditional" },
  ]},
  { canonicalCrop: "New Potatoes", sourceRow: 49, propagation: "DS", actions: [
    { activity: "DS", offsetDays: 0, sourceColumn: "AM49", kind: "implantation" },
    { activity: "Supp. Fertilization + Hilling", offsetDays: 21, sourceColumn: "AO49", kind: "follow_up" },
    { activity: "Supp. Fertilization + Hilling", offsetDays: 42, sourceColumn: "AQ49", kind: "follow_up" },
  ]},
  { canonicalCrop: "Alaska Cucumber (greenhouse)", sourceRow: 50, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM50", kind: "implantation" },
  ]},
  { canonicalCrop: "Lebanese Cucumber (greenhouse)", sourceRow: 51, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM51", kind: "implantation" },
  ]},
  { canonicalCrop: "Parsley", sourceRow: 52, propagation: "TR", actions: [
    { activity: "TR", offsetDays: 0, sourceColumn: "AM52", kind: "implantation" },
  ]},
  { canonicalCrop: "Bush Beans", sourceRow: 56, propagation: "DS", actions: [
    { activity: "DS", offsetDays: 0, sourceColumn: "AM56", kind: "implantation" },
    { activity: "Hoe", offsetDays: 14, sourceColumn: "AO56", kind: "follow_up" },
  ]},
  { canonicalCrop: "Arugula", sourceRow: 62, propagation: "DS", actions: [
    { activity: "DS", offsetDays: 0, sourceColumn: "AM62", kind: "implantation" },
    { activity: "Flextine", offsetDays: 10, sourceColumn: "AO62", kind: "follow_up" },
    { activity: "Flextine", offsetDays: 17, sourceColumn: "AQ62", kind: "follow_up" },
  ]},
  { canonicalCrop: "Carrots", sourceRow: 70, propagation: "DS", actions: [
    { activity: "Germinar malezas", offsetDays: -7, sourceColumn: "AM70", kind: "follow_up" },
    { activity: "DS", offsetDays: 0, sourceColumn: "AO70", kind: "implantation" },
    { activity: "Flame weeder", offsetDays: 4, sourceColumn: "AQ70", kind: "follow_up" },
    { activity: "Flextine", offsetDays: 14, sourceColumn: "AS70", kind: "follow_up" },
    { activity: "Biodisc", offsetDays: 21, sourceColumn: "AU70", kind: "follow_up" },
    { activity: "Manual weeding", offsetDays: 42, sourceColumn: "AW70", kind: "follow_up" },
    { activity: "Manual weeding", offsetDays: 63, sourceColumn: "AY70", kind: "follow_up" },
    { activity: "Mow + tarp", offsetDays: 75, sourceColumn: "BA70", kind: "follow_up" },
  ]},
] as const satisfies readonly OrchardCropChartTaskProfile[]

export function cropChartTaskReferenceFor(cropName: string) {
  return ORCHARD_CROP_CHART_TASK_PROFILES.find((profile) => profile.canonicalCrop === cropName) ?? null
}

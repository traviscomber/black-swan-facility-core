export type OrchardCropTaskReferenceAction = {
  activity: string
  offsetDays: number
  sourceColumn: string
  kind: "setup" | "offset"
}

export type OrchardCropTaskReferenceProfile = {
  canonicalCrop: string
  sourceCrop: string
  sourceRow: number
  actions: readonly OrchardCropTaskReferenceAction[]
}

export const ORCHARD_CROP_TASK_REFERENCE_SOURCE = {
  workbook: "Copy of Crop Plan 26-27 Black Swan Test(1).xlsx",
  workbookSha256: "e29b581d0c2190b8ea43d8116ce19cfac85f8b9be6f1abdb2b676e984d186683",
  sheet: "Crop Associated Task",
  sheetTitle: "Crop Associated Task (# of day after implantation)",
  semantics: "Offsets are source-observed day offsets relative to implantation. Setup text is anchored at day 0. Negative offsets are preserved.",
  operationalStatus: "planning_reference_only",
} as const

export const ORCHARD_CROP_TASK_REFERENCE_PROFILES = [
  {
    canonicalCrop: "Arugula",
    sourceCrop: "Arugula",
    sourceRow: 3,
    actions: [
      { activity: "Insect net / Row cover", offsetDays: 0, sourceColumn: "At seeding/ transplanting", kind: "setup" },
      { activity: "Flextine weeder-1", offsetDays: 10, sourceColumn: "Flextine weeder-1", kind: "offset" },
      { activity: "Flextine weeder-2", offsetDays: 17, sourceColumn: "Flextine weeder-2", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Bush Beans",
    sourceCrop: "Bush beans",
    sourceRow: 8,
    actions: [
      { activity: "Hoe", offsetDays: 14, sourceColumn: "Hoe", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Broccoli",
    sourceCrop: "Cabbages -\nBroccoli",
    sourceRow: 9,
    actions: [
      { activity: "Insect net / Row cover", offsetDays: 0, sourceColumn: "At seeding/ transplanting", kind: "setup" },
      { activity: "Boron/ seaweed 1", offsetDays: 14, sourceColumn: "Boron/ seaweed 1", kind: "offset" },
      { activity: "Straw mulch/ topdress", offsetDays: 21, sourceColumn: "Straw mulch/ topdress", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Carrots",
    sourceCrop: "Carrots",
    sourceRow: 10,
    actions: [
      { activity: "Stale seed bed", offsetDays: -7, sourceColumn: "Stale seed bed", kind: "offset" },
      { activity: "Flame weeder", offsetDays: 5, sourceColumn: "Flame weeder", kind: "offset" },
      { activity: "Flextine weeder-1", offsetDays: 10, sourceColumn: "Flextine weeder-1", kind: "offset" },
      { activity: "Biodisc", offsetDays: 21, sourceColumn: "Biodisc", kind: "offset" },
      { activity: "Handweed", offsetDays: 35, sourceColumn: "Handweed", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Cauliflower",
    sourceCrop: "Cauliflowers",
    sourceRow: 11,
    actions: [
      { activity: "Hoe", offsetDays: 20, sourceColumn: "Hoe", kind: "offset" },
      { activity: "Boron/ seaweed 1", offsetDays: 20, sourceColumn: "Boron/ seaweed 1", kind: "offset" },
      { activity: "Boron/ seaweed 2", offsetDays: 50, sourceColumn: "Boron/ seaweed 2", kind: "offset" },
      { activity: "Straw mulch/ topdress", offsetDays: 20, sourceColumn: "Straw mulch/ topdress", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Celery",
    sourceCrop: "Celery (cut-and-come-again)",
    sourceRow: 12,
    actions: [],
  },
  {
    canonicalCrop: "Dill",
    sourceCrop: "Dill",
    sourceRow: 16,
    actions: [
      { activity: "Flextine weeder-1", offsetDays: 10, sourceColumn: "Flextine weeder-1", kind: "offset" },
      { activity: "Hoe", offsetDays: 17, sourceColumn: "Hoe", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Kale",
    sourceCrop: "Kale",
    sourceRow: 22,
    actions: [
      { activity: "Landscape fabric + Insect net / Row cover", offsetDays: 0, sourceColumn: "At seeding/ transplanting", kind: "setup" },
      { activity: "Boron/ seaweed 1", offsetDays: 20, sourceColumn: "Boron/ seaweed 1", kind: "offset" },
      { activity: "Boron/ seaweed 2", offsetDays: 50, sourceColumn: "Boron/ seaweed 2", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Lettuce",
    sourceCrop: "Lettuce",
    sourceRow: 25,
    actions: [
      { activity: "Hoe", offsetDays: 12, sourceColumn: "Hoe", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Onion",
    sourceCrop: "Onions",
    sourceRow: 29,
    actions: [
      { activity: "Could be planted on landscape fabric", offsetDays: 0, sourceColumn: "At seeding/ transplanting", kind: "setup" },
      { activity: "Stale seed bed", offsetDays: -12, sourceColumn: "Stale seed bed", kind: "offset" },
      { activity: "Flame weeder", offsetDays: 0, sourceColumn: "Flame weeder", kind: "offset" },
      { activity: "Biodisc", offsetDays: 10, sourceColumn: "Biodisc", kind: "offset" },
      { activity: "Handweed", offsetDays: 55, sourceColumn: "Handweed", kind: "offset" },
    ],
  },
  {
    canonicalCrop: "Swiss Chard",
    sourceCrop: "Swiss chard",
    sourceRow: 39,
    actions: [
      { activity: "Landscape fabric + Insect net / Row cover", offsetDays: 0, sourceColumn: "At seeding/ transplanting", kind: "setup" },
      { activity: "Boron/ seaweed 1", offsetDays: 20, sourceColumn: "Boron/ seaweed 1", kind: "offset" },
      { activity: "Boron/ seaweed 2", offsetDays: 50, sourceColumn: "Boron/ seaweed 2", kind: "offset" },
    ],
  },
] as const satisfies readonly OrchardCropTaskReferenceProfile[]

export function cropTaskReferenceFor(cropName: string) {
  return ORCHARD_CROP_TASK_REFERENCE_PROFILES.find((profile) => profile.canonicalCrop === cropName) ?? null
}

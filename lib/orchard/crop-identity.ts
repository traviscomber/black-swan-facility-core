export type OrchardCropFamily =
  | "Amaranthaceae"
  | "Amaryllidaceae"
  | "Apiaceae"
  | "Asteraceae"
  | "Brassicaceae"
  | "Cucurbitaceae"
  | "Fabaceae"
  | "Lamiaceae"
  | "Rosaceae"
  | "Solanaceae"
  | string

export type CropPhase = "sow" | "nursery" | "field" | "harvest" | "identity"

const FAMILY_TONES: Record<string, readonly string[]> = {
  Brassicaceae: ["#3F6B4F", "#496F45", "#557A50", "#607F57"],
  Solanaceae: ["#A94F3D", "#B65A43", "#C26749", "#985048"],
  Apiaceae: ["#C08834", "#CD963D", "#B7792F", "#D3A34B"],
  Cucurbitaceae: ["#7E8B35", "#8E9A3B", "#71833C", "#9AA545"],
  Fabaceae: ["#3F7654", "#4B835E", "#568F68", "#39704C"],
  Amaryllidaceae: ["#6F6685", "#7C7190", "#625C79", "#88799A"],
  Amaranthaceae: ["#814D62", "#8E586D", "#754558", "#9A6376"],
  Asteraceae: ["#70855D", "#7C9167", "#647A54", "#879B71"],
  Lamiaceae: ["#3F7D78", "#4A8983", "#36716D", "#55948E"],
  Rosaceae: ["#A65F6A", "#B26B75", "#985563", "#BD7780"],
  Poaceae: ["#9B8747", "#AA9552", "#8E7A3D", "#B19F60"],
}

const CULTIVATED_FAMILY: Record<string, string> = {
  "alaska cucumber (greenhouse)": "Cucurbitaceae",
  arugula: "Brassicaceae",
  basil: "Lamiaceae",
  "bell pepper (field)": "Solanaceae",
  "bell pepper (greenhouse)": "Solanaceae",
  broccoli: "Brassicaceae",
  "bush beans": "Fabaceae",
  cabbage: "Brassicaceae",
  carrots: "Apiaceae",
  cauliflower: "Brassicaceae",
  celery: "Apiaceae",
  "cherry tomato (greenhouse)": "Solanaceae",
  "chili pepper": "Solanaceae",
  "chinese cabbage": "Brassicaceae",
  "cilantro / coriander": "Apiaceae",
  dill: "Apiaceae",
  "eggplants (field)": "Solanaceae",
  garlic: "Amaryllidaceae",
  "green onion / scallion": "Amaryllidaceae",
  kale: "Brassicaceae",
  "lebanese cucumber (greenhouse)": "Cucurbitaceae",
  lettuce: "Asteraceae",
  mizuna: "Brassicaceae",
  "new potatoes": "Solanaceae",
  onion: "Amaryllidaceae",
  parsley: "Apiaceae",
  peas: "Fabaceae",
  "pole beans": "Fabaceae",
  radishes: "Brassicaceae",
  "spinach (direct sowing)": "Amaranthaceae",
  "spinach (transplant)": "Amaranthaceae",
  "storage cabbage": "Brassicaceae",
  "storage potatoes": "Solanaceae",
  "storage squash": "Cucurbitaceae",
  strawberries: "Rosaceae",
  "swiss chard": "Amaranthaceae",
  tatsoi: "Brassicaceae",
  "tomato (field)": "Solanaceae",
  "tomatoes (greenhouse)": "Solanaceae",
  zucchini: "Cucurbitaceae",
}

const DEFAULT_TONES = ["#5E6B62", "#68766D", "#536159", "#748078"] as const

const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? ""

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function cropFamilyFor(cropName: string, family?: string | null) {
  const explicit = family?.trim()
  if (explicit) return explicit
  return CULTIVATED_FAMILY[normalize(cropName)] ?? null
}

export function cropColor(cropName: string, family?: string | null) {
  const resolvedFamily = cropFamilyFor(cropName, family)
  const tones = (resolvedFamily && FAMILY_TONES[resolvedFamily]) || DEFAULT_TONES
  return tones[hash(normalize(cropName)) % tones.length]
}

function alpha(hex: string, opacity: number) {
  const normalized = hex.replace("#", "")
  const value = normalized.length === 3 ? normalized.split("").map(char => `${char}${char}`).join("") : normalized
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

export function cropPhaseStyle(cropName: string, family: string | null | undefined, phase: CropPhase) {
  const color = cropColor(cropName, family)
  const opacity = phase === "sow" ? 0.24 : phase === "nursery" ? 0.36 : phase === "field" ? 0.62 : phase === "harvest" ? 0.9 : 1
  return {
    color,
    backgroundColor: phase === "identity" ? color : alpha(color, opacity),
    borderColor: alpha(color, Math.min(1, opacity + 0.18)),
  }
}

export function cropChipStyle(cropName: string, family?: string | null) {
  const color = cropColor(cropName, family)
  return { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.4), color }
}

export function cropFamilyColor(family: string | null | undefined) {
  const tones = family ? FAMILY_TONES[family] : null
  return tones?.[0] ?? DEFAULT_TONES[0]
}

function cssString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
}

export const legacyCropIdentityCss = Object.keys(CULTIVATED_FAMILY)
  .map(cropName => {
    const color = cropColor(cropName, CULTIVATED_FAMILY[cropName])
    const selectorName = cssString(cropName)
    return `body:has([data-orchard-navigation]) main :is(article,div.overflow-hidden.border):has(img[alt="${selectorName}" i]) { border-color:${alpha(color,0.55)} !important; box-shadow:inset 4px 0 0 ${color}; }`
  })
  .join("\n")

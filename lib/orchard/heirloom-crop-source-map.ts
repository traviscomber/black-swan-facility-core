export type HeirloomSourceStatus = "exact" | "collapsed" | "mismatch"

export type HeirloomCropSource = {
  coreCrop: string
  heirloomCrop: string
  heirloomCultivar: "Generic"
  status: HeirloomSourceStatus
  observedPlantings: number | null
  sourceUrl: string
  catalogUrl: string
  note?: string
}

export const HEIRLOOM_FARM_ID = "109612"
export const HEIRLOOM_SEASON_ID = "2026"
export const HEIRLOOM_SEASON_LABEL = "Aug 2026 - Jul 2027"
export const HEIRLOOM_CROP_CATALOG_URL = `https://app.heirloom.ag/es/${HEIRLOOM_FARM_ID}/${HEIRLOOM_SEASON_ID}/crops`
export const HEIRLOOM_GAME_PLAN_URL = `https://app.heirloom.ag/es/${HEIRLOOM_FARM_ID}/${HEIRLOOM_SEASON_ID}/game-plan`
export const HEIRLOOM_DASHBOARD_URL = `https://app.heirloom.ag/es/${HEIRLOOM_FARM_ID}/${HEIRLOOM_SEASON_ID}/dashboard`

// Authenticated UI observation on 2026-09-01.
// The current Heirloom Game Plan uses cultivar `Generic` for all 32 observed plantings.
// This map records source identity only. It must not be treated as evidence of a
// Black Swan cultivar when the 2026/27 workbook and Core cultivar fields are blank.
export const HEIRLOOM_ACTIVE_CROP_SOURCES: HeirloomCropSource[] = [
  { coreCrop: "Alaska Cucumber (greenhouse)", heirloomCrop: "Cucumber", heirloomCultivar: "Generic", status: "collapsed", observedPlantings: 2, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL, note: "Heirloom groups both current greenhouse cucumber lines under Cucumber; the current Game Plan does not distinguish Alaska from Lebanese cultivar/type." },
  { coreCrop: "Arugula", heirloomCrop: "Arugula", heirloomCultivar: "Generic", status: "exact", observedPlantings: 4, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Broccoli", heirloomCrop: "Broccoli", heirloomCultivar: "Generic", status: "exact", observedPlantings: 3, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Bush Beans", heirloomCrop: "Bush beans", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Carrots", heirloomCrop: "Carrots (fresh)", heirloomCultivar: "Generic", status: "exact", observedPlantings: 2, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Cauliflower", heirloomCrop: "Cauliflower / Romanesco", heirloomCultivar: "Generic", status: "exact", observedPlantings: 3, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Celery", heirloomCrop: "Celery (cut-and-come-again)", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Chili Pepper", heirloomCrop: "Hot peppers", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Dill", heirloomCrop: "Dill", heirloomCultivar: "Generic", status: "exact", observedPlantings: 2, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Eggplants (field)", heirloomCrop: "Eggplant", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Kale", heirloomCrop: "Kale", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Lebanese Cucumber (greenhouse)", heirloomCrop: "Cucumber", heirloomCultivar: "Generic", status: "collapsed", observedPlantings: 2, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL, note: "Heirloom groups both current greenhouse cucumber lines under Cucumber; the current Game Plan does not distinguish Alaska from Lebanese cultivar/type." },
  { coreCrop: "Lettuce", heirloomCrop: "Lettuce", heirloomCultivar: "Generic", status: "exact", observedPlantings: 4, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "New Potatoes", heirloomCrop: "Potato (new)", heirloomCultivar: "Generic", status: "exact", observedPlantings: 2, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL, note: "Heirloom currently reports two Potato (new) plantings while Core distinguishes one New Potatoes and one Storage Potatoes planting." },
  { coreCrop: "Onion", heirloomCrop: "Onion (fresh)", heirloomCultivar: "Generic", status: "exact", observedPlantings: 2, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Parsley", heirloomCrop: "Parsley", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Peas", heirloomCrop: "Peas", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
  { coreCrop: "Storage Potatoes", heirloomCrop: "Potato (storage)", heirloomCultivar: "Generic", status: "mismatch", observedPlantings: 0, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL, note: "Potato (storage) exists in the authenticated Heirloom crop catalog but has no active planting; the current Heirloom Game Plan instead shows two Potato (new) plantings. Do not inherit Potato (new) agronomy silently." },
  { coreCrop: "Swiss Chard", heirloomCrop: "Swiss Chard", heirloomCultivar: "Generic", status: "exact", observedPlantings: 1, sourceUrl: HEIRLOOM_GAME_PLAN_URL, catalogUrl: HEIRLOOM_CROP_CATALOG_URL },
]

export const heirloomSourceForCoreCrop = (cropName: string) => HEIRLOOM_ACTIVE_CROP_SOURCES.find((item) => item.coreCrop === cropName) ?? null

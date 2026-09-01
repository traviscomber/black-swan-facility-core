export type HeirloomYieldBenchmark = {
  coreCropName: string
  heirloomCropName: string
  heirloomCultivar: "Generic"
  match: "exact" | "collapsed" | "mismatch"
  plannedBedM: number
  theoreticalYield: number
  yieldUnit: "kg" | "unit" | "bunch"
  yieldPer10m: number
  note?: string
}

export const HEIRLOOM_SEASON_BENCHMARK_SOURCE = {
  farmId: 109612,
  season: "2026",
  capturedAt: "2026-09-01",
  dashboardUrl: "https://app.heirloom.ag/es/109612/2026/dashboard",
  gamePlanUrl: "https://app.heirloom.ag/es/109612/2026/game-plan",
  cropsUrl: "https://app.heirloom.ag/es/109612/2026/crops",
  cultivar: "Generic" as const,
  note:
    "Authenticated Heirloom season snapshot. Dashboard values are theoretical season outputs, used only as an external benchmark and never as Fundo Corcovado operational truth.",
}

export const HEIRLOOM_YIELD_BENCHMARKS: HeirloomYieldBenchmark[] = [
  { coreCropName:"Arugula", heirloomCropName:"Arugula", heirloomCultivar:"Generic", match:"exact", plannedBedM:36, theoreticalYield:24, yieldUnit:"kg", yieldPer10m:6.666666667 },
  { coreCropName:"Broccoli", heirloomCropName:"Broccoli", heirloomCultivar:"Generic", match:"exact", plannedBedM:45, theoreticalYield:193, yieldUnit:"unit", yieldPer10m:42.88888889 },
  { coreCropName:"Bush Beans", heirloomCropName:"Bush beans", heirloomCultivar:"Generic", match:"exact", plannedBedM:30, theoreticalYield:58, yieldUnit:"kg", yieldPer10m:19.33333333 },
  { coreCropName:"Carrots", heirloomCropName:"Carrots (fresh)", heirloomCultivar:"Generic", match:"exact", plannedBedM:60, theoreticalYield:355, yieldUnit:"bunch", yieldPer10m:59.16666667 },
  { coreCropName:"Cauliflower", heirloomCropName:"Cauliflower / Romanesco", heirloomCultivar:"Generic", match:"exact", plannedBedM:45, theoreticalYield:192, yieldUnit:"unit", yieldPer10m:42.66666667 },
  { coreCropName:"Celery", heirloomCropName:"Celery (cut-and-come-again)", heirloomCultivar:"Generic", match:"exact", plannedBedM:15, theoreticalYield:246, yieldUnit:"bunch", yieldPer10m:164 },
  { coreCropName:"Chili Pepper", heirloomCropName:"Hot peppers", heirloomCultivar:"Generic", match:"exact", plannedBedM:15, theoreticalYield:67, yieldUnit:"kg", yieldPer10m:44.66666667 },
  { coreCropName:"Dill", heirloomCropName:"Dill", heirloomCultivar:"Generic", match:"exact", plannedBedM:18, theoreticalYield:355, yieldUnit:"bunch", yieldPer10m:197.2222222 },
  { coreCropName:"Eggplants (field)", heirloomCropName:"Eggplant", heirloomCultivar:"Generic", match:"exact", plannedBedM:15, theoreticalYield:225, yieldUnit:"kg", yieldPer10m:150 },
  { coreCropName:"Kale", heirloomCropName:"Kale", heirloomCultivar:"Generic", match:"exact", plannedBedM:15, theoreticalYield:296, yieldUnit:"bunch", yieldPer10m:197.3333333 },
  { coreCropName:"Lettuce", heirloomCropName:"Lettuce", heirloomCultivar:"Generic", match:"exact", plannedBedM:60, theoreticalYield:591, yieldUnit:"unit", yieldPer10m:98.5 },
  { coreCropName:"Onion", heirloomCropName:"Onion (fresh)", heirloomCultivar:"Generic", match:"exact", plannedBedM:60, theoreticalYield:492, yieldUnit:"bunch", yieldPer10m:82 },
  { coreCropName:"Parsley", heirloomCropName:"Parsley", heirloomCultivar:"Generic", match:"exact", plannedBedM:15, theoreticalYield:222, yieldUnit:"bunch", yieldPer10m:148 },
  { coreCropName:"Peas", heirloomCropName:"Peas", heirloomCultivar:"Generic", match:"exact", plannedBedM:30, theoreticalYield:27, yieldUnit:"kg", yieldPer10m:9 },
  { coreCropName:"Swiss Chard", heirloomCropName:"Swiss Chard", heirloomCultivar:"Generic", match:"exact", plannedBedM:15, theoreticalYield:255, yieldUnit:"bunch", yieldPer10m:170 },
  { coreCropName:"Alaska Cucumber (greenhouse)", heirloomCropName:"Cucumber", heirloomCultivar:"Generic", match:"collapsed", plannedBedM:30, theoreticalYield:393, yieldUnit:"unit", yieldPer10m:131, note:"Heirloom combines both Black Swan cucumber profiles into one Cucumber · Generic benchmark." },
  { coreCropName:"Lebanese Cucumber (greenhouse)", heirloomCropName:"Cucumber", heirloomCultivar:"Generic", match:"collapsed", plannedBedM:30, theoreticalYield:393, yieldUnit:"unit", yieldPer10m:131, note:"Heirloom combines both Black Swan cucumber profiles into one Cucumber · Generic benchmark." },
  { coreCropName:"New Potatoes", heirloomCropName:"Potato (new)", heirloomCultivar:"Generic", match:"collapsed", plannedBedM:240, theoreticalYield:1080, yieldUnit:"kg", yieldPer10m:45, note:"Heirloom season places both potato plantings under Potato (new)." },
  { coreCropName:"Storage Potatoes", heirloomCropName:"Potato (new)", heirloomCultivar:"Generic", match:"mismatch", plannedBedM:240, theoreticalYield:1080, yieldUnit:"kg", yieldPer10m:45, note:"Heirloom catalog contains Potato (storage), but the authenticated 2026 Game Plan currently places both potato plantings under Potato (new); treat this only as a mismatch benchmark." },
]

export function heirloomYieldBenchmarkFor(coreCropName:string){
  return HEIRLOOM_YIELD_BENCHMARKS.find(row=>row.coreCropName===coreCropName) ?? null
}

export type DemandScenario = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  resident_people: number
  staff_people: number
  manual_people: number
  include_bookings: boolean
  self_sufficiency_target_pct: number
  waste_pct: number
  notes?: string | null
}

export type DemandCropTarget = {
  id?: string
  scenario_id: string
  crop_name: string
  consumption_kg_per_person_week: number
  target_share_pct: number
  notes?: string | null
}

export type DemandReservation = { check_in: string; check_out: string; num_guests: number | null; status: string | null }
export type DemandCropCycle = { crop_name: string; target_harvest_date: string | null; target_quantity: number | null; target_unit: string | null; status: string | null }
export type DemandCrop = { id: string; crop_name: string; expected_harvest_date: string | null; estimated_yield: number | null; actual_yield?: number | null; yield_unit: string | null; status: string | null }
export type DemandHarvest = { crop_id: string; harvest_date: string; quantity_harvested: number; harvest_unit: string }

export type DemandRow = {
  crop: string
  demand: number
  planned: number
  forecast: number
  harvested: number
  supply: number
  gap: number
  coverage: number
}

export type DemandScenarioMetrics = {
  days: number
  weeks: number
  bookingAvg: number
  people: number
  totalDemand: number
  planned: number
  self: number
  rows: DemandRow[]
}

export type OrchardDemandIntelligence = {
  foodDemand: Array<{
    scenarioId: string
    scenarioName: string
    startDate: string
    endDate: string
    status: string
    totalDemandKg: number
    crops: Array<{ crop: string; demandKg: number }>
  }>
  occupancyForecast: Array<{
    scenarioId: string
    scenarioName: string
    startDate: string
    endDate: string
    residents: number
    staff: number
    manualOrEvents: number
    bookingAveragePeople: number
    averagePeopleToFeed: number
  }>
  selfSufficiency: Array<{
    scenarioId: string
    scenarioName: string
    targetPct: number
    forecastPct: number
    plannedSupplyKg: number
    demandKg: number
  }>
  importGaps: Array<{
    scenarioId: string
    scenarioName: string
    startDate: string
    endDate: string
    crop: string
    demandKg: number
    plannedKg: number
    forecastKg: number
    harvestedKg: number
    importGapKg: number
    coveragePct: number
  }>
}

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.ceil((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000))
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart
}

function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const start = Math.max(new Date(`${aStart}T12:00:00`).getTime(), new Date(`${bStart}T12:00:00`).getTime())
  const end = Math.min(new Date(`${aEnd}T12:00:00`).getTime(), new Date(`${bEnd}T12:00:00`).getTime())
  return Math.max(0, Math.ceil((end - start) / 86400000))
}

function kg(value: number) {
  return Number.isFinite(value) ? value : 0
}

function isKg(unit: string | null | undefined) {
  return !unit || unit.toLowerCase().startsWith("kg")
}

export function calculateDemandScenarioMetrics(
  scenario: DemandScenario | null,
  targets: DemandCropTarget[],
  reservations: DemandReservation[],
  cycles: DemandCropCycle[],
  crops: DemandCrop[],
  harvests: DemandHarvest[],
): DemandScenarioMetrics {
  if (!scenario) return { days: 0, weeks: 0, bookingAvg: 0, people: 0, totalDemand: 0, planned: 0, self: 0, rows: [] }

  const days = daysBetween(scenario.start_date, scenario.end_date)
  const weeks = days / 7
  const bookingGuestDays = scenario.include_bookings
    ? reservations.reduce((sum, reservation) => {
      if (!reservation.check_in || !reservation.check_out || !overlaps(reservation.check_in, reservation.check_out, scenario.start_date, scenario.end_date)) return sum
      const status = (reservation.status ?? "").toLowerCase()
      if (["cancelled", "canceled", "no_show"].includes(status)) return sum
      return sum + overlapDays(reservation.check_in, reservation.check_out, scenario.start_date, scenario.end_date) * Math.max(0, reservation.num_guests ?? 0)
    }, 0)
    : 0
  const bookingAvg = bookingGuestDays / days
  const people = scenario.resident_people + scenario.staff_people + scenario.manual_people + bookingAvg
  const scenarioTargets = targets.filter((target) => target.scenario_id === scenario.id)
  const cropById = new Map(crops.map((crop) => [crop.id, crop.crop_name]))

  const rows = scenarioTargets.map<DemandRow>((target) => {
    const cropName = target.crop_name.toLowerCase()
    const demand = people * weeks * target.consumption_kg_per_person_week * (target.target_share_pct / 100) * (1 + scenario.waste_pct / 100)
    const planned = cycles
      .filter((cycle) => cycle.crop_name.toLowerCase() === cropName && cycle.target_harvest_date && cycle.target_harvest_date >= scenario.start_date && cycle.target_harvest_date <= scenario.end_date && isKg(cycle.target_unit) && cycle.status !== "cancelled")
      .reduce((sum, cycle) => sum + kg(Number(cycle.target_quantity ?? 0)), 0)
    const forecast = crops
      .filter((crop) => crop.crop_name.toLowerCase() === cropName && crop.expected_harvest_date && crop.expected_harvest_date >= scenario.start_date && crop.expected_harvest_date <= scenario.end_date && isKg(crop.yield_unit) && crop.status !== "cancelled")
      .reduce((sum, crop) => sum + kg(Number(crop.estimated_yield ?? 0)), 0)
    const harvested = harvests
      .filter((harvest) => (cropById.get(harvest.crop_id) ?? "").toLowerCase() === cropName && harvest.harvest_date >= scenario.start_date && harvest.harvest_date <= scenario.end_date && isKg(harvest.harvest_unit))
      .reduce((sum, harvest) => sum + kg(Number(harvest.quantity_harvested ?? 0)), 0)
    const supply = Math.max(planned, forecast, harvested)
    const gap = Math.max(0, demand - supply)
    const coverage = demand > 0 ? Math.min(100, (supply / demand) * 100) : 100
    return { crop: target.crop_name, demand, planned, forecast, harvested, supply, gap, coverage }
  }).sort((a, b) => b.gap - a.gap)

  const totalDemand = rows.reduce((sum, row) => sum + row.demand, 0)
  const planned = rows.reduce((sum, row) => sum + row.supply, 0)
  const self = totalDemand > 0 ? Math.min(100, (planned / totalDemand) * 100) : 0
  return { days, weeks, bookingAvg, people, totalDemand, planned, self, rows }
}

export function buildOrchardDemandIntelligence(
  scenarios: DemandScenario[],
  targets: DemandCropTarget[],
  reservations: DemandReservation[],
  cycles: DemandCropCycle[],
  crops: DemandCrop[],
  harvests: DemandHarvest[],
): OrchardDemandIntelligence {
  const foodDemand: OrchardDemandIntelligence["foodDemand"] = []
  const occupancyForecast: OrchardDemandIntelligence["occupancyForecast"] = []
  const selfSufficiency: OrchardDemandIntelligence["selfSufficiency"] = []
  const importGaps: OrchardDemandIntelligence["importGaps"] = []

  for (const scenario of scenarios.filter((item) => item.status !== "archived")) {
    const metrics = calculateDemandScenarioMetrics(scenario, targets, reservations, cycles, crops, harvests)
    foodDemand.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startDate: scenario.start_date,
      endDate: scenario.end_date,
      status: scenario.status,
      totalDemandKg: metrics.totalDemand,
      crops: metrics.rows.map((row) => ({ crop: row.crop, demandKg: row.demand })),
    })
    occupancyForecast.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startDate: scenario.start_date,
      endDate: scenario.end_date,
      residents: scenario.resident_people,
      staff: scenario.staff_people,
      manualOrEvents: scenario.manual_people,
      bookingAveragePeople: metrics.bookingAvg,
      averagePeopleToFeed: metrics.people,
    })
    selfSufficiency.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      targetPct: scenario.self_sufficiency_target_pct,
      forecastPct: metrics.self,
      plannedSupplyKg: metrics.planned,
      demandKg: metrics.totalDemand,
    })
    for (const row of metrics.rows.filter((item) => item.gap > 0)) {
      importGaps.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        startDate: scenario.start_date,
        endDate: scenario.end_date,
        crop: row.crop,
        demandKg: row.demand,
        plannedKg: row.planned,
        forecastKg: row.forecast,
        harvestedKg: row.harvested,
        importGapKg: row.gap,
        coveragePct: row.coverage,
      })
    }
  }

  importGaps.sort((a, b) => b.importGapKg - a.importGapKg)
  return { foodDemand, occupancyForecast, selfSufficiency, importGaps }
}

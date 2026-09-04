import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Orchard carries the audited Heirloom visual grammar without copying unsupported metrics", async () => {
  const audit = await readFile("docs/orchard-heirloom-visual-audit-2026-09-02.md", "utf8")
  const graphics = await readFile("components/orchard/orchard-season-graphics.tsx", "utf8")

  assert.match(audit, /one primary operational surface/i)
  assert.match(audit, /Week Board/)
  assert.match(audit, /Workload Graph/)
  assert.match(audit, /0 Orchard operational tasks/)
  assert.match(graphics, /SeasonPulseChart/)
  assert.match(graphics, /PlannedWorkloadChart/)
  assert.match(graphics, /CapacityCurveChart/)
})

test("compact Orchard charts preserve readable y-axis labels", async () => {
  const graphics = await readFile("components/orchard/orchard-season-graphics.tsx", "utf8")

  assert.doesNotMatch(graphics, /left:\s*-\d+/)
  assert.match(graphics, /tickMargin=\{6\}/)
  assert.match(graphics, /width=\{36\}/)
})

test("Game Plan overview visualizes real reconciled season milestones", async () => {
  const source = await readFile("app/orchard/game-plan/overview/page.tsx", "utf8")

  assert.match(source, /SeasonPulseChart/)
  assert.match(source, /planned_sow_date/)
  assert.match(source, /planned_transplant_date/)
  assert.match(source, /planned_first_harvest_date/)
  assert.match(source, /fieldSuccessions/)
  assert.match(source, /Pulso de temporada/)
  assert.match(source, /\/orchard\/nursery\/overview/)
  assert.match(source, /\/orchard\/crop-map\/overview/)
  assert.match(source, /col-span-2 md:col-span-1/)
})

test("Today and Field count only physical field milestones", async () => {
  const today = await readFile("app/orchard/page.tsx", "utf8")
  const field = await readFile("app/orchard/field/page.tsx", "utf8")

  for (const source of [today, field]) {
    assert.match(source, /cycle_type/)
    assert.match(source, /if\(c\.cycle_type===\"direct_sow\"\)events\.push\(\{date:s\.planned_sow_date,kind:\"sow\"/)
    assert.match(source, /if\(c\.cycle_type===\"transplant\"&&s\.planned_transplant_date\)events\.push\(\{date:s\.planned_transplant_date,kind:\"transplant\"/)
    assert.match(source, /nextBeyond/)
    assert.match(source, /planned_first_harvest_date/)
  }
  assert.match(today, /Próximo hito físico de campo/)
  assert.match(field, /Próximo hito físico después de este horizonte/)
})

test("planned workload graph counts source actions and explicitly refuses fake hours", async () => {
  const source = await readFile("app/orchard/game-plan/tasks/page.tsx", "utf8")

  assert.match(source, /PlannedWorkloadChart/)
  assert.match(source, /implantation/)
  assert.match(source, /followUp/)
  assert.match(source, /No es una estimación de horas/)
  assert.match(source, /estimated_minutes/)
  assert.match(source, /weekStart/)
  assert.match(source, /compactDate/)
  assert.match(source, /SummaryCell/)
})

test("capacity view plots simultaneous physical occupancy against canonical capacity", async () => {
  const source = await readFile("app/orchard/game-plan/capacity/page.tsx", "utf8")

  assert.match(source, /CapacityCurveChart/)
  assert.match(source, /allocated_length_m/)
  assert.match(source, /a\.planned_start_date<=date&&date<a\.planned_end_date/)
  assert.match(source, /capacity:capacityM/)
  assert.match(source, /Curva de capacidad de temporada/)
})

test("capacity cockpit explains today, the next field occupancy and the peak", async () => {
  const source = await readFile("app/orchard/game-plan/capacity/page.tsx", "utf8")

  assert.match(source, /currentMeters/)
  assert.match(source, /nextStartDate/)
  assert.match(source, /Próxima ocupación de campo/)
  assert.match(source, /todayKey<a\.planned_end_date/)
  assert.match(source, /peakContext/)
})

test("nursery overview separates reconciled projection from observed evidence", async () => {
  const source = await readFile("app/orchard/nursery/overview/page.tsx", "utf8")
  const projection = await readFile("data/orchard/dietrich-nursery-container-plan-2026-27.json", "utf8")

  assert.match(source, /orchard_seed_lots/)
  assert.match(source, /orchard_nursery_batches/)
  assert.match(source, /germination_rate_pct/)
  assert.match(source, /nursery_usable_surface_m2/)
  assert.match(source, /Uso semanal del espacio de almácigo/)
  assert.match(source, /Buscar contenedores/)
  assert.match(projection, /reconciled_projection_not_observed/)
  assert.match(projection, /"current_in_use": 0/)
})

test("harvest desk is a weekly availability matrix without fabricated yield", async () => {
  const source = await readFile("app/orchard/harvest/desk/page.tsx", "utf8")

  assert.match(source, /Weekly harvest availability/)
  assert.match(source, /activeInWeek/)
  assert.match(source, /crop_succession_id/)
  assert.match(source, /Actual quantities come only from orchard_harvest_records|Las cantidades reales vienen sólo de orchard_harvest_records/)
  assert.match(source, /incompatible units are never summed|nunca se suman unidades incompatibles/)
  assert.match(source, /weeks:"semanas"/)
  assert.match(source, /\{weeks\.length\} \{text\.weeks\}/)
  assert.doesNotMatch(source, /projected_kg|estimated_yield|fake yield/i)
})

test("Crop Map is a Heirloom-style temporal bed board grounded in canonical allocations", async () => {
  const source = await readFile("app/orchard/crop-map/overview/page.tsx", "utf8")

  assert.match(source, /Current 0\[1-5\]/)
  assert.match(source, /Expansion 0\[1-3\]/)
  assert.match(source, /orchard_bed_allocations/)
  assert.match(source, /orchard_place_succession_bed_meters/)
  assert.match(source, /planned_bed_m/)
  assert.match(source, /onDragStart/)
  assert.match(source, /onDrop/)
  assert.match(source, /assignedIds\.has/)
  assert.match(source, /type="range"/)
  assert.match(source, /isoWeek/)
  assert.match(source, /Season start|Inicio de temporada/)
  assert.match(source, /Season end|Fin de temporada/)
  assert.match(source, /assignOpen/)
  assert.match(source, /PanelRightClose/)
  assert.match(source, /PanelRightOpen/)
  assert.match(source, /beds\.length\*18/)
  assert.match(source, /minmax\(16px,1fr\)/)
})

test("Farm Map uses the current aerial reference and keeps physical editing separate from crop allocation", async () => {
  const farmMap = await readFile("app/orchard/farm-map/page.tsx", "utf8")
  const sidebar = await readFile("components/orchard/orchard-sidebar.tsx", "utf8")
  const migration = await readFile("supabase/migrations/20260903135000_orchard_farm_map_workspace.sql", "utf8")

  assert.match(farmMap, /\/orchard\/farm-map-2026\.webp/)
  assert.match(farmMap, /orchard_farm_map_objects/)
  assert.match(farmMap, /orchard_create_growing_location/)
  assert.match(farmMap, /field_block/)
  assert.match(farmMap, /greenhouse/)
  assert.match(farmMap, /tunnel/)
  assert.match(farmMap, /farm_area/)
  assert.match(farmMap, /water/)
  assert.match(farmMap, /electricity/)
  assert.match(farmMap, /internet/)
  assert.match(farmMap, /Number of beds/)
  assert.match(farmMap, /Bed length/)
  assert.match(farmMap, /Bed width/)
  assert.match(farmMap, /Path width/)
  assert.doesNotMatch(farmMap, /square meters|square metres|m²/i)
  assert.match(farmMap, /onPointerDown/)
  assert.match(farmMap, /x_pct/)
  assert.match(farmMap, /y_pct/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /can_access_orchard_location/)
  assert.match(sidebar, /\/orchard\/farm-map/)
})

test("core Orchard crop surfaces share one canonical family color identity", async () => {
  const identity = await readFile("lib/orchard/crop-identity.ts", "utf8")
  const surfaces = await Promise.all([
    readFile("app/orchard/crops/catalog/page.tsx", "utf8"),
    readFile("app/orchard/game-plan/season/page.tsx", "utf8"),
    readFile("app/orchard/crop-map/overview/page.tsx", "utf8"),
    readFile("app/orchard/nursery/overview/page.tsx", "utf8"),
    readFile("app/orchard/harvest/desk/page.tsx", "utf8"),
  ])

  assert.match(identity, /Brassicaceae/)
  assert.match(identity, /Solanaceae/)
  assert.match(identity, /cropPhaseStyle/)
  assert.match(identity, /cropColor/)
  for (const source of surfaces) {
    assert.match(source, /crop-identity/)
    assert.match(source, /cropColor/)
  }
})

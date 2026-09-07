import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

// Visual/interaction contracts for Orchard surfaces that intentionally follow the
// useful operating patterns observed in Heirloom while remaining grounded in
// Black Swan canonical data.

test("nursery overview separates reconciled projection from observed evidence", async () => {
  const source = await readFile("app/orchard/nursery/overview/page.tsx", "utf8")
  const projection = await readFile("data/orchard/dietrich-nursery-container-plan-2026-27.json", "utf8")

  assert.match(source, /orchard_seed_lots/)
  assert.match(source, /orchard_nursery_batches/)
  assert.match(source, /germination_rate_pct/)
  assert.match(source, /nursery_usable_surface_m2/)
  assert.match(source, /Uso semanal proyectado del espacio de almácigo|Uso semanal del espacio de almácigo/)
  assert.match(source, /Buscar contenedores/)
  assert.match(source, /pastHidden/)
  assert.match(source, /farmToday/)
  assert.match(source, /planned_transplant_date\?\?row\.s\.planned_sow_date/)
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

test("Crop Map quick assign distinguishes ready work from blocked evidence", async () => {
  const source = await readFile("app/orchard/crop-map/overview/quick-assign.tsx", "utf8")

  assert.match(source, /const planSuccessions = successions\.filter/)
  assert.match(source, /const isReady = \(item: Succession\)/)
  assert.match(source, /Number\(item\.planned_bed_m\) > 0/)
  assert.match(source, /item\.planned_transplant_date \?\? item\.planned_sow_date/)
  assert.match(source, /item\.planned_last_harvest_date \?\? item\.planned_first_harvest_date/)
  assert.match(source, /const blocked = planSuccessions\.filter/)
  assert.match(source, /\.neq\("status", "cancelled"\)/)
  assert.match(source, /\{pending\.length\} \{text\.ready\}/)
  assert.match(source, /\{blocked\.length\} \{text\.blocked\}/)
  assert.match(source, /Nothing is placed automatically/)
  assert.match(source, /orchard_place_succession_bed_meters/)
})

test("Farm Map opens the satellite experience by default and keeps canonical field planning visible", async () => {
  const route = await readFile("app/orchard/farm-map/page.tsx", "utf8")
  const satellite = await readFile("components/orchard/farm-map-satellite-bed-experience.tsx", "utf8")
  const layout = await readFile("app/orchard/farm-map/layout.tsx", "utf8")
  const sidebar = await readFile("components/orchard/orchard-sidebar.tsx", "utf8")
  const migration = await readFile("supabase/migrations/20260903135000_orchard_farm_map_workspace.sql", "utf8")

  assert.match(route, /FarmMapSatelliteExperience/)
  assert.doesNotMatch(layout, /FarmMapModeNav/)
  assert.match(satellite, /World_Imagery/)
  assert.match(satellite, /orchard_farm_map_objects/)
  assert.match(satellite, /orchard_bed_allocations/)
  assert.match(satellite, /orchard_crop_successions/)
  assert.match(satellite, /planned crops are not observed planting|cultivos planificados no son plantación observada/i)
  assert.match(satellite, /satellite_lat/)
  assert.match(satellite, /satellite_lng/)
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

test("Notes keeps the Heirloom two-pane workflow while separating canonical history evidence from operator notes", async () => {
  const source = await readFile("app/orchard/notes/page.tsx", "utf8")

  assert.match(source, /type NoteView="operator"\|"history"/)
  assert.match(source, /isHistoryNote/)
  assert.match(source, /note\.note_type===\"lesson\"/)
  assert.match(source, /startsWith\(\"BS history \"\)/)
  assert.match(source, /useState<NoteView>\(\"operator\"\)/)
  assert.match(source, /operatorNotes=notes\.filter/)
  assert.match(source, /historyNotes=notes\.filter/)
  assert.match(source, /lg:grid-cols-\[360px_minmax\(0,1fr\)\]/)
  assert.match(source, /Search notes…/)
})

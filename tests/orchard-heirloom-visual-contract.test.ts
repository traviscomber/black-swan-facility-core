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

test("Game Plan overview visualizes real reconciled season milestones", async () => {
  const source = await readFile("app/orchard/game-plan/overview/page.tsx", "utf8")

  assert.match(source, /SeasonPulseChart/)
  assert.match(source, /planned_sow_date/)
  assert.match(source, /planned_transplant_date/)
  assert.match(source, /planned_first_harvest_date/)
  assert.match(source, /fieldSuccessions/)
  assert.match(source, /Pulso de temporada/)
})

test("planned workload graph counts source actions and explicitly refuses fake hours", async () => {
  const source = await readFile("app/orchard/game-plan/tasks/page.tsx", "utf8")

  assert.match(source, /PlannedWorkloadChart/)
  assert.match(source, /implantation/)
  assert.match(source, /followUp/)
  assert.match(source, /No es una estimación de horas/)
  assert.match(source, /estimated_minutes/)
})

test("capacity view plots simultaneous physical occupancy against canonical capacity", async () => {
  const source = await readFile("app/orchard/game-plan/capacity/page.tsx", "utf8")

  assert.match(source, /CapacityCurveChart/)
  assert.match(source, /allocated_length_m/)
  assert.match(source, /a\.planned_start_date<=date&&date<a\.planned_end_date/)
  assert.match(source, /capacity:capacityM/)
  assert.match(source, /Curva de capacidad de temporada/)
})

test("nursery overview separates reconciled projection from observed evidence", async () => {
  const source = await readFile("app/orchard/nursery/overview/page.tsx", "utf8")
  const projection = await readFile("data/orchard/dietrich-nursery-container-plan-2026-27.json", "utf8")

  assert.match(source, /orchard_seed_lots/)
  assert.match(source, /orchard_nursery_batches/)
  assert.match(source, /germination_rate_pct/)
  assert.match(source, /Demanda proyectada de contenedores/)
  assert.match(projection, /reconciled_projection_not_observed/)
  assert.match(projection, /"current_in_use": 0/)
})

test("harvest desk is a weekly availability matrix without fabricated yield", async () => {
  const source = await readFile("app/orchard/harvest/desk/page.tsx", "utf8")

  assert.match(source, /Weekly harvest availability/)
  assert.match(source, /activeInWeek/)
  assert.match(source, /crop_succession_id/)
  assert.match(source, /No representa una cantidad proyectada/)
  assert.doesNotMatch(source, /projected_kg|estimated_yield|fake yield/i)
})

test("crop map overview keeps all-plan physical occupancy visible", async () => {
  const source = await readFile("app/orchard/crop-map/overview/page.tsx", "utf8")

  assert.match(source, /Field occupancy canvas/)
  assert.match(source, /Current 0\[1-5\]/)
  assert.match(source, /Expansion 0\[1-3\]/)
  assert.match(source, /activeAllocations=allocations\.filter/)
  assert.match(source, /planActiveAllocations/)
  assert.match(source, /not surveyed geometry|no geometría topográfica/)
})

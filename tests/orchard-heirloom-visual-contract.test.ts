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

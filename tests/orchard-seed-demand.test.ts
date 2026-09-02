import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { estimateDirectSeedDemand, estimateTransplantSeedDemand, groupReadyDemandByUnit } from "../lib/orchard/seed-demand.ts"
import "./orchard-seed-procurement.test.ts"

test("transplant demand never treats unknown germination as 100 percent", () => {
  assert.deepEqual(estimateTransplantSeedDemand({ plannedPlants: 150, seedsPerPlant: 1, germinationRatePct: null }), {
    value: null,
    unit: "seed_count",
    status: "incomplete",
    reason: "missing_or_invalid_germination",
  })
})

test("transplant demand uses explicit germination only", () => {
  assert.deepEqual(estimateTransplantSeedDemand({ plannedPlants: 150, seedsPerPlant: 1, germinationRatePct: 90 }), {
    value: 167,
    unit: "seed_count",
    status: "ready",
    reason: null,
  })
})

test("direct sow scales native-unit workbook rates by planned bed length", () => {
  assert.deepEqual(estimateDirectSeedDemand({ plannedBedM: 60, demandValue: 115, demandUnit: "g", referenceBedM: 30, conflictStatus: "none" }), {
    value: 230,
    unit: "g",
    status: "ready",
    reason: null,
  })
})

test("direct sow blocks unresolved source conflicts", () => {
  assert.deepEqual(estimateDirectSeedDemand({ plannedBedM: 30, demandValue: 20, demandUnit: "g", referenceBedM: 30, conflictStatus: "source_conflict" }), {
    value: null,
    unit: "g",
    status: "source_conflict",
    reason: "direct_seeding_profile_conflict",
  })
})

test("direct sow does not fabricate demand when bed length is absent", () => {
  assert.deepEqual(estimateDirectSeedDemand({ plannedBedM: null, demandValue: 14, demandUnit: "g", referenceBedM: 30, conflictStatus: "none" }), {
    value: null,
    unit: "g",
    status: "incomplete",
    reason: "missing_planned_bed_m",
  })
})

test("ready demands are grouped by unit and never summed across units", () => {
  assert.deepEqual(groupReadyDemandByUnit([
    { value: 200, unit: "seed_count", status: "ready", reason: null },
    { value: 115, unit: "g", status: "ready", reason: null },
    { value: 14, unit: "g", status: "ready", reason: null },
    { value: 40, unit: "tuber_count", status: "ready", reason: null },
    { value: null, unit: "g", status: "incomplete", reason: "missing_planned_bed_m" },
  ]), {
    seed_count: 200,
    g: 129,
    tuber_count: 40,
  })
})

test("Advanced nursery UI is scoped to allocated transplants and uses evidence-safe demand", () => {
  const source = readFileSync(new URL("../app/orchard/nursery/advanced/page.tsx", import.meta.url), "utf8")
  assert.match(source, /estimateTransplantSeedDemand/)
  assert.match(source, /orchard_bed_allocations/)
  assert.match(source, /cycle_type === "transplant"/)
  assert.match(source, /item\.planned_transplant_date != null/)
  assert.doesNotMatch(source, /const estimatedSeeds/)
  assert.doesNotMatch(source, /germination_rate_pct[^\n]*:\s*100/)
})

test("Advanced nursery never auto-fills seeds when transplant demand is incomplete", () => {
  const source = readFileSync(new URL("../app/orchard/nursery/advanced/page.tsx", import.meta.url), "utf8")
  assert.match(source, /estimate\.status === "ready"/)
  assert.match(source, /seeds_sown: outstanding && outstanding > 0 \? outstanding\.toString\(\) : ""/)
  assert.match(source, /text\.incompleteHelp/)
})

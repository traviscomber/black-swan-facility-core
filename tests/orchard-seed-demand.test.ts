import assert from "node:assert/strict"
import test from "node:test"
import { estimateDirectSeedDemand, estimateTransplantSeedDemand, groupReadyDemandByUnit } from "../lib/orchard/seed-demand.ts"

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

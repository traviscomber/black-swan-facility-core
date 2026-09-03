import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { estimateDirectProcurement, estimateTransplantProcurement, estimateTuberProcurement, parseApproxGrams, parseCentimeters } from "../lib/orchard/seed-procurement.ts"

test("procurement uses explicit germination when available", () => {
  assert.deepEqual(estimateTransplantProcurement({ plannedPlants: 67, seedsPerPlant: 1, germinationRatePct: 73, fallbackGerminationRatePct: 90 }), {
    value: 92,
    unit: "seed_count",
    basis: "explicit_germination",
    reason: null,
  })
})

test("procurement may use the workbook fallback without relabeling it as observed germination", () => {
  assert.deepEqual(estimateTransplantProcurement({ plannedPlants: 150, seedsPerPlant: 1, germinationRatePct: null, fallbackGerminationRatePct: 90 }), {
    value: 167,
    unit: "seed_count",
    basis: "workbook_global_fallback",
    reason: null,
  })
})

test("direct sow procurement scales the native 30m gram rate", () => {
  assert.deepEqual(estimateDirectProcurement({ plannedBedM: 60, densityG: 14, referenceBedM: 30 }), {
    value: 28,
    unit: "g",
    basis: "direct_sow_density",
    reason: null,
  })
})

test("potato procurement is counted as tubers, not grams or seed count", () => {
  assert.deepEqual(estimateTuberProcurement({ plannedBedM: 120, spacingCm: 15 }), {
    value: 800,
    unit: "tuber_count",
    basis: "manual_spacing",
    reason: null,
  })
})

test("workbook density and spacing strings parse deterministically", () => {
  assert.equal(parseApproxGrams("±115g"), 115)
  assert.equal(parseApproxGrams("±0,5 oz"), null)
  assert.equal(parseCentimeters("15 cm"), 15)
  assert.equal(parseCentimeters("N/A"), null)
})

test("technical propagation keeps gross plan demand before inventory consolidation", () => {
  const source = readFileSync(new URL("../app/orchard/game-plan/propagation/page.tsx", import.meta.url), "utf8")
  assert.match(source, /data-testid="orchard-plan-procurement"/)
  assert.match(source, /estimateTransplantProcurement/)
  assert.match(source, /estimateDirectProcurement/)
  assert.match(source, /estimateTuberProcurement/)
  assert.match(source, /planningFallbackPct/)
  assert.match(source, /orchard_bed_allocations/)
  assert.doesNotMatch(source, /quantity_seeds/)
  assert.doesNotMatch(source, /procurementTotals[^\n]*-/)
})

test("technical propagation remains a plan-first cockpit with progressive evidence", () => {
  const source = readFileSync(new URL("../app/orchard/game-plan/propagation/page.tsx", import.meta.url), "utf8")
  assert.match(source, /cropColor/)
  assert.match(source, /cropChipStyle/)
  assert.match(source, /upcoming/)
  assert.match(source, /data-orchard-propagation-section/)
  assert.match(source, /stockPending/)
  assert.match(source, /firstSowByCrop/)
})

test("Orchard seeds navigation opens the canonical procurement board while technical evidence stays linked", () => {
  const sidebar = readFileSync(new URL("../components/orchard/orchard-sidebar.tsx", import.meta.url), "utf8")
  const board = readFileSync(new URL("../app/orchard/seed-orders/page.tsx", import.meta.url), "utf8")
  assert.match(sidebar, /href:"\/orchard\/seed-orders"[^\n]*Seeds & transplants/)
  assert.match(sidebar, /href:"\/orchard\/nursery\/overview"[^\n]*Nursery/)
  assert.match(board, /procurement_requests/)
  assert.match(board, /source_type", "orchard_seed_plan"/)
  assert.match(board, /source_ref/)
  assert.match(board, /get_procurement_location_directory/)
  assert.match(board, /Farm Area 1/)
  assert.match(board, /status: "submitted"/)
  assert.match(board, /\/orchard\/game-plan\/propagation/)
  assert.doesNotMatch(board, /procurement_purchase_orders"\)\.insert/)
})

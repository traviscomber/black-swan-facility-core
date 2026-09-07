import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import directSowReference from "../data/orchard/dietrich-direct-sow-2026-27.json" with { type: "json" }
import { resolveDirectProcurementReference, type DirectProcurementReferenceRow } from "../lib/orchard/direct-procurement-reference.ts"
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

test("direct procurement resolver accepts explicit or density-invariant source evidence only", () => {
  const rows = directSowReference as DirectProcurementReferenceRow[]
  assert.equal(resolveDirectProcurementReference("Radishes", rows)?.densityG, 90)
  assert.equal(resolveDirectProcurementReference("Mizuna", rows)?.densityG, 85)
  assert.equal(resolveDirectProcurementReference("Tatsoi", rows)?.densityG, 115)
  assert.equal(resolveDirectProcurementReference("Storage Beetroot", rows)?.densityG, 35)
  assert.equal(resolveDirectProcurementReference("Corn", rows), null)
  assert.equal(resolveDirectProcurementReference("Shallots", rows), null)
  assert.equal(resolveDirectProcurementReference("White Radish (Daikon)", rows), null)
})

test("direct procurement resolver blocks ambiguous cultivar densities", () => {
  const rows: DirectProcurementReferenceRow[] = [
    { crop: "Rucula", cultivar: "Astro", density_30m: "10g" },
    { crop: "Rucula", cultivar: "Rocket", density_30m: "20g" },
  ]
  assert.equal(resolveDirectProcurementReference("Arugula", rows), null)
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

test("Orchard seeds navigation opens a request-ready board without bypassing Procurement", () => {
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
  assert.match(board, /required_date: line\.firstNurserySowing \?\? line\.firstPlanting/)
  assert.match(board, /Create all ready|Crear todas las solicitudes listas/)
  assert.match(board, /missing_direct_seed_density/)
  assert.match(board, /resolveDirectProcurementReference/)
  assert.match(board, /\^\\s\*\[=\+\\-@\]/)
  assert.match(board, /\/orchard\/game-plan\/propagation/)
  assert.doesNotMatch(board, /procurement_purchase_orders"\)\.insert/)
})

test("seed procurement scan keeps the bulk action visible on desktop", () => {
  const board = readFileSync(new URL("../app/orchard/seed-orders/page.tsx", import.meta.url), "utf8")
  const scanCss = readFileSync(new URL("../app/orchard/seed-orders/seed-orders-scan.css", import.meta.url), "utf8")
  assert.match(board, /createRequests\(missingReady, BULK_KEY\)/)
  assert.doesNotMatch(scanCss, /main > header\s*\{[^}]*display:\s*none\s*!important/s)
  assert.match(scanCss, /main > header > div:first-child\s*\{[^}]*display:\s*none\s*!important/s)
})

test("planned-plants reconciliation is source guarded and never claims execution", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260907021056_orchard_reconcile_planned_plants_10m.sql", import.meta.url), "utf8")
  assert.match(migration, /v_legacy_matches <> 22/)
  assert.match(migration, /v_missing <> 18/)
  assert.match(migration, /v_target_total <> 2551/)
  assert.match(migration, /ceil\(\s*cs\.planned_bed_m/)
  assert.match(migration, /legacy_30m_to_canonical_10m/)
  assert.match(migration, /v_seed_requests <> 0/)
  assert.doesNotMatch(migration, /planned_sow_date\s*=/)
  assert.doesNotMatch(migration, /status\s*=/)
})

test("seed supplier candidates remain pending and inactive", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260907021106_orchard_seed_supplier_candidates.sql", import.meta.url), "utf8")
  assert.match(migration, /Cooprinsem Valdivia/)
  assert.match(migration, /Anasac Agropecuario/)
  assert.match(migration, /is_active = false/)
  assert.match(migration, /approval_status = 'pending'/)
  assert.match(migration, /must remain pending and inactive/)
  assert.doesNotMatch(migration, /approval_status = 'approved'/)
})
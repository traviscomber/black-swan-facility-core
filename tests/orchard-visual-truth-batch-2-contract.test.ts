import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const soil = readFileSync(new URL("../app/orchard/soil/page.tsx", import.meta.url), "utf8")
const decisions = readFileSync(new URL("../app/orchard/decisions/page.tsx", import.meta.url), "utf8")
const library = readFileSync(new URL("../app/orchard/library/page.tsx", import.meta.url), "utf8")
const charts = readFileSync(new URL("../app/orchard/charts/page.tsx", import.meta.url), "utf8")
const reports = readFileSync(new URL("../app/orchard/reports/page.tsx", import.meta.url), "utf8")
const pests = readFileSync(new URL("../app/orchard/pests/page.tsx", import.meta.url), "utf8")
const harvest = readFileSync(new URL("../app/orchard/harvest/page.tsx", import.meta.url), "utf8")

test("Soil and Decisions render recorded evidence without stock photography", () => {
  for (const source of [soil, decisions]) {
    assert.doesNotMatch(source, /unsplash\.com|images\.unsplash\.com|<img\b|<Image\b/)
  }
  assert.match(soil, /orchard_soil_amendments/)
  assert.match(soil, /quantity_kg/)
  assert.match(soil, /npk_ratio/)
  assert.match(decisions, /orchard_succession_lifecycle/)
  assert.match(decisions, /orchard_seed_lots/)
  assert.match(decisions, /orchard_pest_logs/)
})

test("Library removes stock decoration while preserving verified canonical crop photos", () => {
  assert.doesNotMatch(library, /unsplash\.com|images\.unsplash\.com|AGRONOMIC_LIBRARY_PHOTO/)
  assert.match(library, /orchard_crop_photo_registry/)
  assert.match(library, /verification_status/)
  assert.match(library, /\.eq\("verification_status","verified"\)/)
  assert.match(library, /photo\?<img src=\{photo\}/)
  assert.match(library, /photoPending/)
})

test("Charts and Reports keep canonical operational outputs without stock decoration", () => {
  for (const source of [charts, reports]) {
    assert.doesNotMatch(source, /unsplash\.com|images\.unsplash\.com/)
  }
  assert.match(charts, /orchard_chart_definitions/)
  assert.match(charts, /orchard_harvest_records/)
  assert.match(charts, /ResponsiveContainer/)
  assert.match(reports, /orchard_game_plans/)
  assert.match(reports, /orchard_harvest_records/)
  assert.match(reports, /orchard_sales_commitments/)
})

test("Pests preserves recorded field evidence and CRUD while removing stock crop imagery", () => {
  assert.doesNotMatch(pests, /unsplash\.com|images\.unsplash\.com|CROP_PHOTOS|HEALTH_HERO|GENERIC_CROP_PHOTO/)
  assert.match(pests, /orchard_pest_logs/)
  assert.match(pests, /OrchardEvidence/)
  assert.match(pests, /orchard_field_evidence/)
  assert.match(pests, /\.insert\(/)
  assert.match(pests, /\.update\(/)
  assert.match(pests, /\.delete\(/)
})

test("Harvest preserves canonical traceability and unit-safe performance without stock imagery", () => {
  assert.doesNotMatch(harvest, /unsplash\.com|images\.unsplash\.com|CROP_PHOTOS|HERO_PHOTO|FALLBACK_PHOTO|cropPhotoUrl|<img\b|<Image\b/)
  assert.match(harvest, /orchard_harvest_records/)
  assert.match(harvest, /harvest_lot_code/)
  assert.match(harvest, /outputByUnit/)
  assert.match(harvest, /scopeGamePlanGraph/)
  assert.match(harvest, /yield_unit/)
  assert.match(harvest, /bedArea/)
  assert.match(harvest, /productivity/)
  assert.match(harvest, /\.insert\(/)
  assert.match(harvest, /\.delete\(/)
})

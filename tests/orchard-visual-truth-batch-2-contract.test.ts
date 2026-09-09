import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const soil = readFileSync(new URL("../app/orchard/soil/page.tsx", import.meta.url), "utf8")
const decisions = readFileSync(new URL("../app/orchard/decisions/page.tsx", import.meta.url), "utf8")
const library = readFileSync(new URL("../app/orchard/library/page.tsx", import.meta.url), "utf8")

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

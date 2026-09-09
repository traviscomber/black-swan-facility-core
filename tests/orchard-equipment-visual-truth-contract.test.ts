import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("../app/orchard/equipment/page.tsx", import.meta.url), "utf8")

test("Equipment uses recorded operational state instead of stock photography", () => {
  assert.doesNotMatch(source, /unsplash\.com|images\.unsplash\.com|<img\b|<Image\b/)
  assert.match(source, /orchard_equipment/)
  assert.match(source, /condition/)
  assert.match(source, /last_maintenance_date/)
  assert.match(source, /next_maintenance_date/)
  assert.match(source, /storage_location/)
  assert.match(source, /Readiness before assignment|Disponibilidad antes de asignar|Bereitschaft vor Zuweisung/)
})

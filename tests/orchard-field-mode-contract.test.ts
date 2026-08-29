import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const field = readFileSync("app/orchard/field/page.tsx", "utf8")
const care = readFileSync("app/orchard/care/page.tsx", "utf8")
const health = readFileSync("app/orchard/pests/page.tsx", "utf8")

test("field mode stays grounded in canonical Orchard sources", () => {
  assert.match(field, /from\("tasks"\)/)
  assert.match(field, /from\("orchard_succession_lifecycle"\)/)
  assert.match(field, /from\("orchard_nursery_batches"\)/)
  assert.match(field, /from\("orchard_pest_logs"\)/)
  assert.doesNotMatch(field, /Math\.random|synthetic score|demo data/i)
})

test("field mode supports explicit task progression", () => {
  assert.match(field, /"en_progreso"/)
  assert.match(field, /"completada"/)
  assert.match(field, /completed_at/)
})

test("mobile care and health entry default to today and use progressive disclosure", () => {
  assert.match(care, /localDateKey\(\)/)
  assert.match(care, /<details/)
  assert.match(care, /min-h-12 w-full sm:w-auto/)
  assert.match(health, /localDateKey\(\)/)
  assert.match(health, /<details/)
  assert.match(health, /min-h-12 w-full sm:w-auto/)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const page = readFileSync(new URL("../app/activities-calendar/page.tsx", import.meta.url), "utf8")
const timeline = readFileSync(new URL("../components/activities/activities-timeline.tsx", import.meta.url), "utf8")

test("activities calendar keeps existing Supabase CRUD paths", () => {
  assert.match(page, /from\('activities'\)\.delete\(\)/)
  assert.match(page, /from\('activities'\)/)
  assert.match(page, /ActivityFormDialog/)
})

test("activities timeline preserves date-specific creation", () => {
  assert.match(timeline, /onCreate\(date\)/)
  assert.match(page, /onCreate=\{\(date\) => handleCreateActivity\(date\)\}/)
  assert.match(page, /setSelectedDate\(date\)/)
})

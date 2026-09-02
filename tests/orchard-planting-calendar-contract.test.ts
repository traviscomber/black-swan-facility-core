import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Orchard planting calendar is succession-led, lifecycle phased and Heirloom-dense", async () => {
  const source = await readFile("app/orchard/game-plan/season/page.tsx", "utf8")

  assert.match(source, /planned_bed_m/)
  assert.match(source, /planned_transplant_date/)
  assert.match(source, /planned_first_harvest_date/)
  assert.match(source, /planned_last_harvest_date/)
  assert.match(source, /function Phase/)
  assert.match(source, /Sow → field/)
  assert.match(source, /Field → first harvest/)
  assert.match(source, /Harvest window/)
  assert.match(source, /isoWeekNumber/)
  assert.match(source, /details\[data-orchard-season-crop\]/)
  assert.match(source, /collapseAll/)
  assert.match(source, /sticky left-0/)
  assert.match(source, /todayVisible/)
  assert.match(source, /Search crops/)

  assert.doesNotMatch(source, /orchard_bed_allocations/)
  assert.doesNotMatch(source, /\bScopeMode\b/)
  assert.doesNotMatch(source, /setScopeMode/)
  assert.doesNotMatch(source, /setPropagationFilter/)
  assert.doesNotMatch(source, /from "@\/components\/ui\/card"/)
})

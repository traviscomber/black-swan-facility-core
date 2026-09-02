import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Orchard planting calendar is succession-led, lifecycle phased and Heirloom-dense", async () => {
  const source = await readFile("app/orchard/game-plan/season/page.tsx", "utf8")

  assert.match(source, /planned_bed_m/)
  assert.match(source, /planned_transplant_date/)
  assert.match(source, /planned_first_harvest_date/)
  assert.match(source, /planned_last_harvest_date/)
  assert.match(source, /orchard_bed_allocations/)
  assert.match(source, /allocatedSuccessionIds/)
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

  assert.doesNotMatch(source, /\bScopeMode\b/)
  assert.doesNotMatch(source, /setScopeMode/)
  assert.doesNotMatch(source, /setPropagationFilter/)
  assert.doesNotMatch(source, /from "@\/components\/ui\/card"/)
})

test("Orchard dark brand layer neutralizes legacy light calendar surfaces", async () => {
  const brand = await readFile("components/orchard/orchard-navigation.tsx", "utf8")
  assert.match(brand, /bg-\[#f6f8f5\]/)
  assert.match(brand, /bg-\[#eff1ee\]/)
  assert.match(brand, /text-\[#657069\]/)
  assert.match(brand, /#eef1ed/)
  assert.match(brand, /background-image:none!important/)
})

test("Seeds and transplants stays a simple plan-first hub", async () => {
  const hub = await readFile("app/orchard/nursery/page.tsx", "utf8")
  const advanced = await readFile("app/orchard/nursery/advanced/page.tsx", "utf8")
  assert.match(hub, /Requerido por el plan/)
  assert.match(hub, /\/orchard\/game-plan\/propagation/)
  assert.match(hub, /\/orchard\/nursery\/advanced/)
  assert.match(hub, /\/orchard\/nursery\/overview/)
  assert.doesNotMatch(hub, /orchard_seed_lots/)
  assert.match(advanced, /orchard_seed_lots/)
  assert.match(advanced, /orchard_nursery_batches/)
})

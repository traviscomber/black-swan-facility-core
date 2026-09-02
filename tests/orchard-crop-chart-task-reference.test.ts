import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { ORCHARD_CROP_CHART_TASK_PROFILES, ORCHARD_CROP_CHART_TASK_SOURCE } from "../lib/orchard/crop-chart-task-reference.ts"

const selectedPlantings: Record<string, number> = {
  "Alaska Cucumber (greenhouse)": 1,
  Arugula: 4,
  Broccoli: 3,
  "Bush Beans": 1,
  Carrots: 2,
  Cauliflower: 3,
  Celery: 1,
  "Chili Pepper": 1,
  Dill: 2,
  "Eggplants (field)": 1,
  Kale: 1,
  "Lebanese Cucumber (greenhouse)": 1,
  Lettuce: 4,
  "New Potatoes": 1,
  Onion: 2,
  Parsley: 1,
  Peas: 1,
  "Storage Potatoes": 1,
  "Swiss Chard": 1,
}

test("Crop Chart task recipe reconciles the selected 32 field plantings", () => {
  assert.equal(Object.values(selectedPlantings).reduce((sum, count) => sum + count, 0), 32)
  assert.equal(ORCHARD_CROP_CHART_TASK_SOURCE.sheet, "Crop Chart")
  assert.equal(ORCHARD_CROP_CHART_TASK_SOURCE.workbookSha256, "e29b581d0c2190b8ea43d8116ce19cfac85f8b9be6f1abdb2b676e984d186683")
  let anchors = 0
  let followUps = 0
  let conditional = 0
  for (const profile of ORCHARD_CROP_CHART_TASK_PROFILES) {
    const count = selectedPlantings[profile.canonicalCrop] ?? 0
    anchors += profile.actions.filter((action) => action.kind === "implantation").length * count
    followUps += profile.actions.filter((action) => action.kind === "follow_up" && action.offsetDays !== null).length * count
    conditional += profile.actions.filter((action) => action.kind === "conditional" && action.offsetDays === null).length * count
  }
  assert.equal(anchors, 32)
  assert.equal(followUps, 71)
  assert.equal(conditional, 1)
})

test("task recipe preserves richer Crop Chart cases without fabricating dates", () => {
  const peas = ORCHARD_CROP_CHART_TASK_PROFILES.find((profile) => profile.canonicalCrop === "Peas")
  assert.ok(peas)
  assert.deepEqual(peas.actions.map((action) => action.offsetDays), [0, 14, 25, 32, 39, 46, 53])
  const carrots = ORCHARD_CROP_CHART_TASK_PROFILES.find((profile) => profile.canonicalCrop === "Carrots")
  assert.ok(carrots)
  assert.deepEqual(carrots.actions.map((action) => action.offsetDays), [-7, 0, 4, 14, 21, 42, 63, 75])
  const celery = ORCHARD_CROP_CHART_TASK_PROFILES.find((profile) => profile.canonicalCrop === "Celery")
  assert.ok(celery)
  assert.deepEqual(celery.actions.map((action) => action.offsetDays), [0, 14, 28, 42, 56, 70, 94])
  const storagePotatoes = ORCHARD_CROP_CHART_TASK_PROFILES.find((profile) => profile.canonicalCrop === "Storage Potatoes")
  assert.ok(storagePotatoes)
  const haulm = storagePotatoes.actions.find((action) => action.activity === "Haulm topping")
  assert.ok(haulm)
  assert.equal(haulm.offsetDays, null)
  assert.equal(haulm.kind, "conditional")
})

test("planning references require accountable confirmation before becoming tasks", async () => {
  const calendar = await readFile("app/orchard/game-plan/tasks/page.tsx", "utf8")
  const confirmation = await readFile("app/orchard/work/from-plan/page.tsx", "utf8")
  assert.match(calendar, /\/orchard\/work\/from-plan/)
  assert.match(calendar, /source_path: item\.sourcePath/)
  assert.doesNotMatch(calendar, /create_operational_task_atomic/)
  assert.match(confirmation, /sourcePath\.startsWith\("Crop Chart!"\)/)
  assert.match(confirmation, /employeeId === "none"/)
  assert.match(confirmation, /orchard_bed_allocations/)
  assert.match(confirmation, /location_id/)
  assert.match(confirmation, /rpc\("create_operational_task_atomic"/)
  assert.match(confirmation, /p_source_type: "orchard_succession"/)
  assert.match(confirmation, /p_source_path: sourcePath/)
  assert.match(confirmation, /eq\("source_path", sourcePath\)/)
  assert.match(confirmation, /p_employee_ids: \[employeeId\]/)
  assert.doesNotMatch(confirmation, /from\("tasks"\)\.insert/)
})

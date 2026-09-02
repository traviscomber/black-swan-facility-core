import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const orchardPages = [
  "app/orchard/page.tsx",
  "app/orchard/field/page.tsx",
  "app/orchard/field/advanced/page.tsx",
  "app/orchard/field/harvest/page.tsx",
  "app/orchard/field/nursery/page.tsx",
  "app/orchard/game-plan/page.tsx",
  "app/orchard/game-plan/overview/page.tsx",
  "app/orchard/game-plan/objectives/page.tsx",
  "app/orchard/game-plan/written-plan/page.tsx",
  "app/orchard/game-plan/season/page.tsx",
  "app/orchard/game-plan/crop-chart/page.tsx",
  "app/orchard/game-plan/propagation/page.tsx",
  "app/orchard/game-plan/tasks/page.tsx",
  "app/orchard/game-plan/capacity/page.tsx",
  "app/orchard/game-plan/forecast/page.tsx",
  "app/orchard/harvest/desk/page.tsx",
  "app/orchard/season-summary/page.tsx",
  "app/orchard/season-summary/advanced/page.tsx",
  "app/orchard/work/page.tsx",
  "app/orchard/harvest/page.tsx",
  "app/orchard/assistant/page.tsx",
  "app/orchard/library/page.tsx",
  "app/orchard/library/fao/page.tsx",
  "app/orchard/crop-map/page.tsx",
  "app/orchard/crop-map/overview/page.tsx",
  "app/orchard/crop-map/auto-place/page.tsx",
  "app/orchard/nursery/page.tsx",
  "app/orchard/nursery/overview/page.tsx",
  "app/orchard/crops/page.tsx",
  "app/orchard/lifecycle/page.tsx",
  "app/orchard/care/page.tsx",
  "app/orchard/pests/page.tsx",
  "app/orchard/soil/page.tsx",
  "app/orchard/equipment/page.tsx",
  "app/orchard/mobile/page.tsx",
  "app/orchard/commercial/page.tsx",
  "app/orchard/performance/page.tsx",
  "app/orchard/decisions/page.tsx",
  "app/orchard/charts/page.tsx",
  "app/orchard/analytics/page.tsx",
] as const

test("every Orchard page mounts the shared navigation and brand layer", async () => {
  for (const page of orchardPages) {
    const source = await readFile(page, "utf8")
    assert.match(source, /OrchardNavigation/, `${page} must mount OrchardNavigation so the canonical brand layer applies`)
  }
})

test("Orchard brand layer encodes the agricultural workspace rules", async () => {
  const source = await readFile("components/orchard/orchard-navigation.tsx", "utf8")

  assert.match(source, /data-orchard-navigation/)
  assert.match(source, /--orchard-nav-height:\s*0px/)
  assert.match(source, /--orchard-green/)
  assert.match(source, /--orchard-green-soft/)
  assert.match(source, /--orchard-canvas/)
  assert.match(source, /--bs-surface-primary:\s*#ffffff/)
  assert.match(source, /--bs-text-primary:\s*var\(--orchard-ink\)/)
  assert.match(source, /--bs-font-heading/)
  assert.match(source, /--bs-font-body/)
  assert.match(source, /background:\s*var\(--orchard-canvas\)/)
  assert.match(source, /background:\s*#fff\s*!important/)
  assert.match(source, /border-radius:\s*var\(--orchard-radius\)\s*!important/)
})

test("Orchard shell uses one accessible contextual sidebar instead of duplicate top navigation", async () => {
  const sidebar = await readFile("components/orchard/orchard-sidebar.tsx", "utf8")
  const shell = await readFile("components/app-layout.tsx", "utf8")
  const brand = await readFile("components/orchard/orchard-navigation.tsx", "utf8")

  assert.match(sidebar, /data-orchard-sidebar/)
  assert.match(sidebar, /aria-current=\{active\?"page":undefined\}/)
  assert.match(shell, /isOrchardPath/)
  assert.match(shell, /OrchardSidebar/)
  assert.doesNotMatch(brand, /<nav data-orchard-navigation/)
})

test("Dietrich Orchard sidebar follows the compact Heirloom operating workflow", async () => {
  const source = await readFile("components/orchard/orchard-sidebar.tsx", "utf8")

  assert.match(source, /const seasonItems/)
  assert.match(source, /en:"Crops"/)
  assert.match(source, /en:"Game plan"/)
  assert.match(source, /en:"Crop map"/)
  assert.match(source, /en:"Seeds & transplants"/)
  assert.match(source, /en:"Nursery"/)
  assert.match(source, /en:"Harvests"/)
  assert.match(source, /en:"Tasks"/)
  assert.match(source, /href:"\/orchard\/game-plan\/season"/)
  assert.match(source, /href:"\/orchard\/crop-map\/overview"/)
  assert.match(source, /href:"\/orchard\/nursery\/overview"/)
  assert.match(source, /href:"\/orchard\/work\/week-board"/)
  assert.match(source, /href:"\/orchard\/harvest\/desk"/)
  assert.match(source, /href:"\/orchard\/crops"/)
  assert.match(source, /orchard_game_plans/)
  assert.match(source, /game_plan/)
})

test("Dietrich Game Plan hub preserves the written plan as a first-class section", async () => {
  const overview = await readFile("app/orchard/game-plan/overview/page.tsx", "utf8")
  const written = await readFile("app/orchard/game-plan/written-plan/page.tsx", "utf8")
  const source = await readFile("data/orchard/dietrich-game-plan-2026-27.json", "utf8")

  assert.match(overview, /\/orchard\/game-plan\/written-plan/)
  assert.match(written, /dietrich-game-plan-2026-27\.json/)
  assert.match(source, /Consolidate Fresh Food Production/)
  assert.match(source, /Written|writtenCrops/)
  assert.match(source, /Garlic/)
  assert.match(source, /Mizuna/)
})

test("Dietrich Season Plan exposes a crop-led planting timeline", async () => {
  const source = await readFile("app/orchard/game-plan/season/page.tsx", "utf8")

  assert.match(source, /monthKeys/)
  assert.match(source, /weekKeys/)
  assert.match(source, /isoWeekNumber/)
  assert.match(source, /timelinePosition/)
  assert.match(source, /Planting Schedule/)
  assert.match(source, /Search crops/)
  assert.match(source, /planned_sow_date/)
  assert.match(source, /planned_last_harvest_date/)
  assert.match(source, /collapseAll/)
  assert.match(source, /data-orchard-season-crop/)
  assert.match(source, /var\(--orchard-green\)/)
})

test("Dietrich workbook reference data remains explicit and versioned", async () => {
  const direct = await readFile("data/orchard/dietrich-direct-sow-2026-27.json", "utf8")
  const nursery = await readFile("data/orchard/dietrich-nursery-2026-27.json", "utf8")
  const tasks = await readFile("data/orchard/dietrich-crop-tasks-2026-27.json", "utf8")

  assert.match(direct, /Six Row Seeder/)
  assert.match(direct, /calibration/)
  assert.match(nursery, /germination_temp/)
  assert.match(nursery, /days_in_nursery/)
  assert.match(tasks, /Flextine weeder/)
  assert.match(tasks, /day_offset/)
})

test("Dietrich daily surface is plan-first and stays on simple routes", async () => {
  const source = await readFile("app/orchard/page.tsx", "utf8")

  assert.match(source, /Orchard · Today/)
  assert.match(source, /planned_sow_date/)
  assert.match(source, /planned_transplant_date/)
  assert.match(source, /planned_first_harvest_date/)
  assert.match(source, /no work is marked complete automatically/)
  assert.match(source, /\/orchard\/harvest\/desk/)
})

test("Dietrich Field is a read-first field surface with advanced tools preserved", async () => {
  const source = await readFile("app/orchard/field/page.tsx", "utf8")
  const advanced = await readFile("app/orchard/field/advanced/page.tsx", "utf8")

  assert.match(source, /planned_sow_date/)
  assert.match(source, /planned_transplant_date/)
  assert.match(source, /planned_first_harvest_date/)
  assert.match(source, /\/orchard\/harvest\/desk/)
  assert.match(source, /\/orchard\/game-plan\/tasks/)
  assert.match(source, /\/orchard\/field\/advanced/)
  assert.doesNotMatch(source, /unsplash\.com/)
  assert.doesNotMatch(source, /transitionTask/)
  assert.match(advanced, /transitionTask/)
})

test("Dietrich History excludes draft planning and preserves advanced season analysis", async () => {
  const source = await readFile("app/orchard/season-summary/page.tsx", "utf8")
  const advanced = await readFile("app/orchard/season-summary/advanced/page.tsx", "utf8")

  assert.match(source, /p\.status===\"completed\"/)
  assert.match(source, /\/orchard\/season-summary\/advanced/)
  assert.match(source, /crop_succession_id/)
  assert.match(source, /does not assign them by date alone/)
  assert.doesNotMatch(source, /scopeGamePlanGraph/)
  assert.match(advanced, /scopeGamePlanGraph/)
})

test("Orchard analytics and charts expose accessible names for their form controls", async () => {
  const analytics = await readFile("app/orchard/analytics/page.tsx", "utf8")
  const charts = await readFile("app/orchard/charts/page.tsx", "utf8")

  assert.match(analytics, /SelectTrigger aria-label=\{text\.context\}/)
  assert.match(charts, /SelectTrigger aria-label="Game Plan"/)
  for (const source of [analytics, charts]) {
    assert.match(source, /labelFieldControl/)
    assert.match(source, /"aria-label":label/)
  }
})

test("Orchard decision cockpit localizes the refresh action", async () => {
  const source = await readFile("app/orchard/decisions/page.tsx", "utf8")

  assert.match(source, /refresh:"Actualizar"/)
  assert.match(source, /\{text\.refresh\}/)
})

test("Orchard soil migration preserves canonical columns and exposes compatibility aliases", async () => {
  const source = await readFile("supabase/migrations/20260829235000_orchard_soil_compat_aliases.sql", "utf8")

  assert.match(source, /application_date date generated always as \(amendment_date\) stored/)
  assert.match(source, /description text generated always as \(notes\) stored/)
  assert.doesNotMatch(source, /drop column/i)
  assert.doesNotMatch(source, /rename column/i)
})

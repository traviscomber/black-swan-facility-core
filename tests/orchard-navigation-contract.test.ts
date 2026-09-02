import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const sidebarSource = readFileSync(new URL("../components/orchard/orchard-sidebar.tsx", import.meta.url), "utf8")
const shellSource = readFileSync(new URL("../components/app-layout.tsx", import.meta.url), "utf8")
const orchardPages = ["page.tsx", "crops/page.tsx", "crops/catalog/page.tsx", "care/page.tsx", "harvest/page.tsx", "pests/page.tsx", "soil/page.tsx", "equipment/page.tsx", "analytics/page.tsx"]

test("Orchard exposes its primary operating workflow from one contextual sidebar", () => {
  for (const route of ["/orchard", "/orchard/crops/catalog", "/orchard/game-plan/season", "/orchard/crop-map/overview", "/orchard/nursery", "/orchard/nursery/overview", "/orchard/harvest/desk", "/orchard/work/week-board"]) {
    assert.match(sidebarSource, new RegExp(`href:["']${route.replaceAll("/", "\\/")}["']`))
  }
  assert.match(sidebarSource, /MI TEMPORADA/)
  assert.match(sidebarSource, /Semillas y trasplantes/)
  assert.match(sidebarSource, /orchard_game_plans/)
  assert.match(sidebarSource, /pathname\.startsWith\("\/orchard\/crops"\)/)
  assert.match(shellSource, /isOrchardPath/)
  assert.match(shellSource, /OrchardSidebar/)
})

test("every Orchard screen uses the shared brand layer while AppLayout owns navigation", () => {
  for (const relativePath of orchardPages) {
    const source = readFileSync(new URL(`../app/orchard/${relativePath}`, import.meta.url), "utf8")
    assert.match(source, /<OrchardNavigation \/>/, `${relativePath} must render OrchardNavigation brand layer`)
  }
})

test("Orchard overview priorities are derived from canonical records", () => {
  const source = readFileSync(new URL("../app/orchard/page.tsx", import.meta.url), "utf8")
  assert.match(source, /supabase\.from\("orchard_plots"\)/)
  assert.match(source, /supabase\.from\("orchard_crops"\)/)
  assert.doesNotMatch(source, /estimated[_ ]?(revenue|yield)|mock|demo/i)
})

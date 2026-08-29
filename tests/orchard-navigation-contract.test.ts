import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const navigationSource = readFileSync(new URL("../lib/os/navigation.ts", import.meta.url), "utf8")
const orchardPages = ["page.tsx", "crops/page.tsx", "care/page.tsx", "harvest/page.tsx", "pests/page.tsx", "soil/page.tsx", "equipment/page.tsx", "analytics/page.tsx"]

test("Orchard exposes every implemented workspace from its canonical navigation", () => {
  for (const route of ["/orchard", "/orchard/crops", "/orchard/care", "/orchard/harvest", "/orchard/pests", "/orchard/soil", "/orchard/equipment", "/orchard/analytics"]) {
    assert.match(navigationSource, new RegExp(`href: ["']${route.replaceAll("/", "\\/")}["']`))
  }
})

test("every Orchard screen uses the shared domain navigation", () => {
  for (const relativePath of orchardPages) {
    const source = readFileSync(new URL(`../app/orchard/${relativePath}`, import.meta.url), "utf8")
    assert.match(source, /<OrchardNavigation \/>/, `${relativePath} must render OrchardNavigation`)
  }
})

test("Orchard overview priorities are derived from canonical records", () => {
  const source = readFileSync(new URL("../app/orchard/page.tsx", import.meta.url), "utf8")
  assert.match(source, /supabase\.from\("orchard_plots"\)/)
  assert.match(source, /supabase\.from\("orchard_crops"\)/)
  assert.doesNotMatch(source, /estimated[_ ]?(revenue|yield)|mock|demo/i)
})

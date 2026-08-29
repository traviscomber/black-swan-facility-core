import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const orchardPages = [
  "app/orchard/page.tsx",
  "app/orchard/field/page.tsx",
  "app/orchard/field/harvest/page.tsx",
  "app/orchard/field/nursery/page.tsx",
  "app/orchard/game-plan/page.tsx",
  "app/orchard/work/page.tsx",
  "app/orchard/harvest/page.tsx",
  "app/orchard/assistant/page.tsx",
  "app/orchard/library/page.tsx",
  "app/orchard/library/fao/page.tsx",
  "app/orchard/crop-map/page.tsx",
  "app/orchard/crop-map/auto-place/page.tsx",
  "app/orchard/nursery/page.tsx",
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

test("Orchard brand layer encodes canonical Black Swan rules", async () => {
  const source = await readFile("components/orchard/orchard-navigation.tsx", "utf8")

  assert.match(source, /data-orchard-navigation/)
  assert.match(source, /--bs-bg-primary/)
  assert.match(source, /--bs-surface-primary/)
  assert.match(source, /--bs-font-heading/)
  assert.match(source, /--bs-font-body/)
  assert.match(source, /border-radius:\s*0\s*!important/)
  assert.match(source, /box-shadow:\s*none\s*!important/)
  assert.match(source, /background-image:\s*none\s*!important/)
  assert.match(source, /backdrop-filter:\s*none\s*!important/)
  assert.match(source, /--bs-cool-sky/)
})

test("Orchard navigation preserves accessible names when mobile labels are visually hidden", async () => {
  const source = await readFile("components/orchard/orchard-navigation.tsx", "utf8")

  assert.match(source, /aria-label=\{item\.label\[locale\]\}/)
  assert.match(source, /aria-label=\{group\.label\[locale\]\}/)
})

test("Orchard analytics and charts expose accessible names for their form controls", async () => {
  for (const page of ["app/orchard/analytics/page.tsx", "app/orchard/charts/page.tsx"]) {
    const source = await readFile(page, "utf8")
    assert.match(source, /aria-label="Game Plan"/)
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

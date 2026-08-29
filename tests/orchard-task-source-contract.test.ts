import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const workPage = readFileSync(new URL("../app/orchard/work/page.tsx", import.meta.url), "utf8")
const migration = readFileSync(new URL("../supabase/migrations/20260829144501_allow_orchard_task_source_types.sql", import.meta.url), "utf8")

const uiSources = [...new Set([...workPage.matchAll(/["`](orchard_[a-z_]+)["`]/g)].map((match) => match[1]))].sort()

test("every Orchard task source emitted by the Work cockpit is accepted by the database contract", () => {
  assert.deepEqual(uiSources, [
    "orchard_general",
    "orchard_succession",
    "orchard_succession_harvest",
    "orchard_succession_sow",
    "orchard_succession_transplant",
  ])

  for (const source of uiSources) {
    assert.match(migration, new RegExp(`'${source}'::text`))
  }
})

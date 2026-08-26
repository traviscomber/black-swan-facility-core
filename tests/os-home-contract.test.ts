import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { rankAreasForPersona } from "../lib/os/personas.ts"

const source = readFileSync(new URL("../components/os-home.tsx", import.meta.url), "utf8")
const personaSource = readFileSync(new URL("../lib/os/personas.ts", import.meta.url), "utf8")
const personaHook = readFileSync(new URL("../lib/hooks/use-os-persona.ts", import.meta.url), "utf8")
const rootPage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")
const migration = readFileSync(new URL("../supabase/migrations/20260826204906_add_os_persona_profiles.sql", import.meta.url), "utf8")

test("OS home keeps server-authorized navigation as the source of truth", () => {
  assert.match(source, /\/v1\/os\/navigation/)
  assert.match(source, /authorization: `Bearer \$\{token\}`/)
  assert.match(source, /hasNavKey\(navigation/)
})

test("Today is actionable instead of a workspace-only catalog", () => {
  assert.match(source, /Requiere atención/)
  assert.match(source, /Operación de hoy/)
  assert.match(source, /Acciones rápidas/)
  assert.match(source, /finance_approval_queue/)
  assert.match(source, /inventory_stock_status/)
  assert.match(source, /America\/Santiago/)
})

test("area selection is additive and keeps canonical item hrefs", () => {
  assert.match(source, /searchParams\.get\('area'\)/)
  assert.match(source, /href=\{item\.href\}/)
})

test("persona is UX-only and never an authorization primitive", () => {
  assert.match(personaSource, /UX-only ordering/)
  assert.match(personaSource, /MUST preserve every entry/)
  assert.match(personaHook, /UX persona is read only to prioritize presentation/)
  assert.match(migration, /Never use for authorization/)
  assert.match(migration, /role\/capability\/scope/)
})

test("persona ordering preserves every already-authorized area", () => {
  const areas = [
    { key: "network" as const },
    { key: "operations" as const },
    { key: "finance" as const },
    { key: "today" as const },
  ]
  const executive = rankAreasForPersona(areas, "executive")
  const fieldAdmin = rankAreasForPersona(areas, "field_admin")

  assert.deepEqual(new Set(executive.map((area) => area.key)), new Set(areas.map((area) => area.key)))
  assert.deepEqual(new Set(fieldAdmin.map((area) => area.key)), new Set(areas.map((area) => area.key)))
  assert.equal(executive[0]?.key, "today")
  assert.equal(executive[1]?.key, "finance")
  assert.equal(fieldAdmin[0]?.key, "today")
  assert.equal(fieldAdmin[1]?.key, "operations")
})

test("the canonical root enters the OS instead of a single module", () => {
  assert.match(rootPage, /redirect\("\/os"\)/)
  assert.doesNotMatch(rootPage, /redirect\("\/bookings"\)/)
})

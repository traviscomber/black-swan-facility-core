import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const page = readFileSync(new URL("../app/activities-calendar/page.tsx", import.meta.url), "utf8")
const timeline = readFileSync(new URL("../components/activities/activities-timeline.tsx", import.meta.url), "utf8")
const checklists = readFileSync(new URL("../components/localized-checklists-page.tsx", import.meta.url), "utf8")
const guestRequests = readFileSync(new URL("../components/guest-requests-inbox.tsx", import.meta.url), "utf8")

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

test("activities calendar uses compact dark hierarchy without changing workflow", () => {
  assert.match(page, /const LOCALE_TAGS = \{ en: 'en-US', es: 'es-CL', de: 'de-DE' \}/)
  assert.match(page, /border-y px-1 py-2/)
  assert.match(page, /<section className="pt-2">/)
  assert.match(page, /className="flex flex-col gap-3 border-b px-1 py-4/)
  assert.doesNotMatch(page, /components\/ui\/card/)
  assert.doesNotMatch(page, /rounded border bg-card/)
})

test("checklist index is localized, route-safe and free of legacy light-card styling", () => {
  assert.match(checklists, /Listas de verificación/)
  assert.match(checklists, /Checklisten/)
  assert.match(checklists, /href=\{`\/\$\{language\}\/checklists\/\$\{checklist\.id\}`\}/)
  assert.match(checklists, /className="group grid gap-3 border-b/)
  assert.doesNotMatch(checklists, /hover:border-blue|text-gray-|components\/ui\/card|components\/ui\/button/)
})

test("guest request inbox is trilingual while preserving canonical mutations", () => {
  assert.match(guestRequests, /useLanguage/)
  for (const label of ["Guest requests", "Solicitudes de huéspedes", "Gästeanfragen"]) assert.match(guestRequests, new RegExp(label))
  assert.match(guestRequests, /const LOCALES = \{ en: "en-US", es: "es-CL", de: "de-DE" \}/)
  assert.match(guestRequests, /from\("hospitality_requests"\)\.update\(\{ assigned_to: employeeId \|\| null, status:/)
  assert.match(guestRequests, /if \(status === "completed"\) updates\.completed_at = new Date\(\)\.toISOString\(\)/)
  assert.match(guestRequests, /grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3/)
  assert.doesNotMatch(guestRequests, /const STATUS_LABELS|const PRIORITY_LABELS|const CATEGORY_LABELS|Intl\.DateTimeFormat\("es-CL"/)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const calendarLayout = readFileSync(new URL("../app/bookings/calendar/layout.tsx", import.meta.url), "utf8")
const preferences = readFileSync(new URL("../components/calendar/use-calendar-view-preferences.ts", import.meta.url), "utf8")
const grid = readFileSync(new URL("../components/calendar/timeline-grid.tsx", import.meta.url), "utf8")
const inspector = readFileSync(new URL("../components/calendar/reservation-quick-inspector.tsx", import.meta.url), "utf8")

test("booking calendar does not force dynamic Vercel rendering", () => {
  assert.doesNotMatch(calendarLayout, /force-dynamic/)
  assert.doesNotMatch(calendarLayout, /revalidate\s*=\s*0/)
})

test("heavy booking overlays are opt-in by default", () => {
  assert.match(preferences, /showSummary:\s*false/)
  assert.match(preferences, /showLayerToolbar:\s*false/)
})

test("calendar first view keeps expensive offscreen groups contained", () => {
  assert.match(grid, /content-visibility:auto/)
  assert.match(grid, /contain-intrinsic-size/)
  assert.match(grid, /ReservationQuickInspector/)
})

test("Santiago stay cockpit loads operational context only after opening a booking", () => {
  assert.match(inspector, /if \(!reservation\) return/)
  assert.match(inspector, /if \(open\) void load\(\)/)
  assert.match(inspector, /from\("reservation_logistics"\)/)
  assert.match(inspector, /from\("booking_handover_items"\)/)
  assert.match(inspector, /from\("reservation_operational_exceptions"\)/)
  assert.doesNotMatch(inspector, /fetch\("\/api\//)
})

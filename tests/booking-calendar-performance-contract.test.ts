import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const calendarPage = readFileSync(new URL("../app/bookings/calendar/page.tsx", import.meta.url), "utf8")
const calendarLayout = readFileSync(new URL("../app/bookings/calendar/layout.tsx", import.meta.url), "utf8")
const timelineRow = readFileSync(new URL("../components/calendar/timeline-row.tsx", import.meta.url), "utf8")
const inspector = readFileSync(new URL("../components/calendar/reservation-quick-inspector.tsx", import.meta.url), "utf8")
const vercelConfig = readFileSync(new URL("../vercel.json", import.meta.url), "utf8")

test("calendar separates stable inventory reads from date-range event reads", () => {
  assert.match(calendarPage, /const loadInventory = useCallback/)
  assert.match(calendarPage, /const loadEvents = useCallback/)
  assert.match(calendarPage, /get_booking_inventory_events/)
  assert.doesNotMatch(calendarPage, /const loadData = useCallback/)
})

test("realtime refreshes are coalesced instead of reloading every table immediately", () => {
  assert.match(calendarPage, /realtimeEventsTimer/)
  assert.match(calendarPage, /realtimeInventoryTimer/)
  assert.match(calendarPage, /setTimeout\(\(\) => void loadEventsRef\.current\(\), 180\)/)
  assert.match(calendarPage, /setTimeout\(\(\) => \{/)
})

test("visible reservation rows do not mount per-reservation N+1 operation readers", () => {
  assert.doesNotMatch(timelineRow, /ReservationOperationIndicators/)
  assert.match(timelineRow, /ReservationQuickInspector/)
})

test("stay cockpit remains lazy and bypasses Vercel serverless reads", () => {
  assert.match(inspector, /if \(open\) void load\(\)/)
  assert.match(inspector, /from\("reservation_logistics"\)/)
  assert.match(inspector, /from\("booking_handover_items"\)/)
  assert.match(inspector, /from\("reservation_operational_exceptions"\)/)
  assert.doesNotMatch(inspector, /fetch\("\/api\//)
})

test("calendar route avoids forced dynamic rendering and development branch avoids automatic Vercel previews", () => {
  assert.doesNotMatch(calendarLayout, /force-dynamic/)
  assert.doesNotMatch(calendarLayout, /revalidate\s*=\s*0/)
  const config = JSON.parse(vercelConfig) as { git?: { deploymentEnabled?: Record<string, boolean> } }
  assert.equal(config.git?.deploymentEnabled?.["feat/booking-calendar-low-cpu-bedbooking"], false)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const calendarPage = readFileSync(new URL("../app/bookings/calendar/page.tsx", import.meta.url), "utf8")
const calendarLayout = readFileSync(new URL("../app/bookings/calendar/layout.tsx", import.meta.url), "utf8")
const bookingLayout = readFileSync(new URL("../app/bookings/layout.tsx", import.meta.url), "utf8")
const subsectionCss = readFileSync(new URL("../app/bookings/booking-subsections-v2.css", import.meta.url), "utf8")
const calendarCleanCss = readFileSync(new URL("../app/bookings/calendar/calendar-clean.css", import.meta.url), "utf8")
const timelineRow = readFileSync(new URL("../components/calendar/timeline-row.tsx", import.meta.url), "utf8")
const inspector = readFileSync(new URL("../components/calendar/reservation-quick-inspector.tsx", import.meta.url), "utf8")
const preferences = readFileSync(new URL("../components/calendar/use-calendar-view-preferences.ts", import.meta.url), "utf8")
const appLayout = readFileSync(new URL("../components/app-layout.tsx", import.meta.url), "utf8")
const contextNav = readFileSync(new URL("../components/workspace-context-nav.tsx", import.meta.url), "utf8")
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

test("Booking uses the canonical Black Swan shell instead of mounting a second permanent sidebar", () => {
  assert.match(bookingLayout, /<AppLayout>\{children\}<\/AppLayout>/)
  assert.doesNotMatch(bookingLayout, /BookingReferenceSidebar/)
  assert.doesNotMatch(bookingLayout, /BookingMobileNav/)
  assert.match(appLayout, /<Sidebar isOpen=\{true\}/)
  assert.match(appLayout, /<WorkspaceContextNav \/>/)
  assert.match(contextNav, /\["Calendar", "\/bookings\/calendar"\]/)
  assert.match(contextNav, /\["Overview", "\/orchard\/dashboard"\]/)
})

test("all booking subsections remain constrained to the shared main workspace", () => {
  assert.match(bookingLayout, /booking-subsections-v2\.css/)
  assert.match(subsectionCss, /min-width:\s*0;/)
  assert.match(subsectionCss, /flex:\s*1 1 auto;/)
  assert.match(subsectionCss, /overflow:\s*hidden;/)
  assert.match(subsectionCss, /data-booking-section="operations"/)
})

test("calendar defaults to progressive disclosure instead of rendering every operational layer", () => {
  assert.match(preferences, /preferences\.v2/)
  assert.match(preferences, /defaultLayers\.includes\("milestones"\) \? \["milestones"\]/)
  assert.match(preferences, /showSummary:\s*false/)
  assert.match(preferences, /showLayerToolbar:\s*false/)
  assert.match(calendarCleanCss, /Quiet calendar mode/)
  assert.match(calendarCleanCss, /button:nth-of-type\(3\)/)
})

test("calendar route avoids forced dynamic rendering and development branches avoid automatic Vercel previews", () => {
  assert.doesNotMatch(calendarLayout, /force-dynamic/)
  assert.doesNotMatch(calendarLayout, /revalidate\s*=\s*0/)
  const config = JSON.parse(vercelConfig) as { git?: { deploymentEnabled?: Record<string, boolean> } }
  assert.equal(config.git?.deploymentEnabled?.["feat/booking-calendar-low-cpu-bedbooking"], false)
  assert.equal(config.git?.deploymentEnabled?.["work/booking-all-subsections-v2"], false)
})

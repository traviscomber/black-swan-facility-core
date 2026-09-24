import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { VERIFIED_BEDBOOKING_REFERENCE_ROWS, getBedBookingDisplayIdentity } from "../lib/bookings/bedbooking-nomenclature.ts"

const calendarPage = readFileSync(new URL("../app/bookings/calendar/page.tsx", import.meta.url), "utf8")
const calendarLayout = readFileSync(new URL("../app/bookings/calendar/layout.tsx", import.meta.url), "utf8")
const timelineRow = readFileSync(new URL("../components/calendar/timeline-row.tsx", import.meta.url), "utf8")
const timelineGrid = readFileSync(new URL("../components/calendar/timeline-grid.tsx", import.meta.url), "utf8")
const activitiesPage = readFileSync(new URL("../app/bookings/activities/page.tsx", import.meta.url), "utf8")
const availabilityPicker = readFileSync(new URL("../components/availability-calendar-picker.tsx", import.meta.url), "utf8")
const inspector = readFileSync(new URL("../components/calendar/reservation-quick-inspector.tsx", import.meta.url), "utf8")
const addReservationDialog = readFileSync(new URL("../components/add-reservation-dialog.tsx", import.meta.url), "utf8")
const operationalLanes = readFileSync(new URL("../components/calendar/reservation-operational-lanes.tsx", import.meta.url), "utf8")
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


test("calendar never fabricates room availability when every bed conflicts", () => {
  assert.match(timelineGrid, /freeBedForRange/)
  assert.match(timelineGrid, /\?\? null/)
  assert.doesNotMatch(timelineGrid, /freeBedForRange[\s\S]{0,500}\?\? roomBeds\[0\]/)
  assert.match(timelineGrid, /toast\.error\(c\.noAvailability\)/)
})

test("booking quick actions use canonical lifecycle RPCs instead of direct status writes", () => {
  assert.match(inspector, /rpc\("check_in_or_queue"/)
  assert.match(inspector, /rpc\("transition_reservation_status"/)
  assert.doesNotMatch(inspector, /from\("reservations"\)\.update/)
  assert.match(activitiesPage, /rpc\("check_in_or_queue"/)
  assert.match(activitiesPage, /rpc\("transition_reservation_status"/)
  assert.doesNotMatch(activitiesPage, /from\("reservations"\)\.update/)
})


test("inventory availability is independent from search and status presentation filters", () => {
  assert.match(calendarPage, /const availabilityEventsByBed = useMemo/)
  assert.match(calendarPage, /events\.forEach\(\(event\) =>/)
  assert.match(calendarPage, /availabilityEventsByBed=\{availabilityEventsByBed\}/)
  assert.match(timelineGrid, /availabilityEventsByBed/)
  assert.match(timelineGrid, /freeBedForRange\(room\.beds, availabilityEventsByBed/)
})


test("new reservation availability includes room blocks and rejects ranges crossing conflicts", () => {
  assert.match(availabilityPicker, /from\("room_blocks"\)/)
  assert.match(availabilityPicker, /item\.isBooked \|\| item\.isBlocked/)
  assert.match(availabilityPicker, /rangeConflict/)
  assert.match(availabilityPicker, /bookingTodayDate/)
})


test("reservation range selection revalidates canonical availability across month boundaries", () => {
  assert.match(availabilityPicker, /\.lt\("check_in", rangeEnd\)/)
  assert.match(availabilityPicker, /\.gt\("check_out", rangeStart\)/)
  assert.match(availabilityPicker, /\.lt\("start_date", rangeEnd\)/)
  assert.match(availabilityPicker, /\.gt\("end_date", rangeStart\)/)
  assert.match(availabilityPicker, /availabilityError/)
})


test("calendar default range matches the authenticated BedBooking working horizon", () => {
  assert.match(calendarPage, /useState\(33\)/)
  assert.match(calendarPage, /value="33"/)
})

test("canonical Black Swan inventory resolves to the 41 verified BedBooking room identities", () => {
  const canonical = [
    ["TO","TO-Arrayan",2],["TO","TO-Copihue",2],["TO","TO-Camelia",2],["TO","TO-Hortensia",2],["TO","TO-Loto",2],["TO","TO-Chilco",2],
    ["CP","CP-Bandurrias",2],["CP","CP-Cisne Negro",2],["CP","CP-Queltehue",2],["CP","CP-Choroy",2],
    ["Clubhouse","Notro",2],["Clubhouse","Avellano",6],["Clubhouse","Ulmo",5],
    ["Garden House","Habitación 1",2],["Garden House","Habitación 2",2],["Garden House","Habitación 3",2],
    ["Bamboo House","Room 1",2],["Bamboo House","Room 2",2],["Bamboo House","Room 3",2],
    ["Hotelito","Hotelito 1",2],["Hotelito","Hotelito 2",2],["Hotelito","Hotelito 3",2],
    ["Ed Office","Oficina",1],["Ed Office","Office Room 2",1],
    ["Prairie House 1","PH1- Prairie House 1",2],["Prairie House 1","PH1- Prairie House 2",2],["Prairie House 1","PH1- Prairie House 3",2],
    ["Prairy House 2","Room1",2],["Prairy House 2","Room2",2],["Prairy House 2","Room3",2],
    ["Prairie House 3","PH3- Prairie House 1",2],["Prairie House 3","PH3- Prairie House 2",2],["Prairie House 3","PH3- Prairie House 3",2],
    ["Chef House","CH- Chef House 1",2],["Chef House","CH- Chef House 2",2],
    ["Puerto Claro","PC- Puerto Claro 1",2],["Puerto Claro","PC- Puerto Claro 2",2],["Puerto Claro","PC- Puerto Claro 3",2],
    ["CH","CH-Canelo",2],["CH","CH-Laurel",2],["Glamping","Glamping Tent",2],
  ] as const

  assert.equal(canonical.length, 41)
  assert.equal(VERIFIED_BEDBOOKING_REFERENCE_ROWS.length, 41)
  const expected = VERIFIED_BEDBOOKING_REFERENCE_ROWS.map((row) => row.displayName)
  const resolved = canonical.map(([propertyName, roomNumber]) => getBedBookingDisplayIdentity({ propertyName, roomNumber }).displayName)
  assert.deepEqual(resolved, expected)
  assert.deepEqual(canonical.map(([, , capacity]) => capacity), VERIFIED_BEDBOOKING_REFERENCE_ROWS.map((row) => row.guestCapacity))
  assert.ok(canonical.every(([propertyName, roomNumber, capacity]) => { const identity = getBedBookingDisplayIdentity({ propertyName, roomNumber }); return identity.source === "bedbooking_verified" && identity.guestCapacity === capacity }))
})


test("calendar does not reload stable room inventory on every date-window event refresh", () => {
  assert.doesNotMatch(calendarPage, /loadInitialData/)
  assert.match(calendarPage, /void loadInventory\(\)\.finally/)
  assert.match(calendarPage, /void loadEvents\(\)/)
})


test("new reservation keeps a compact BedBooking-like primary hierarchy", () => {
  assert.match(addReservationDialog, /max-w-xl overflow-hidden rounded-none p-0/)
  assert.match(addReservationDialog, /stayNights/)
  assert.match(addReservationDialog, /selectedLocationName/)
  assert.match(addReservationDialog, /More details|copy\.moreDetails/)
  assert.match(addReservationDialog, /DialogFooter className="[^"]*border-t/)
})

test("expanded calendar operations stay compact and hide empty optional lanes", () => {
  assert.match(operationalLanes, /lane\.key === "milestones" \|\| lane\.items\.length > 0/)
  assert.match(operationalLanes, /min-h-6/)
  assert.match(operationalLanes, /housekeepingLabel\(item\.task_type, language\)/)
  assert.match(operationalLanes, /Preparar habitación/)
  assert.match(operationalLanes, /Limpieza post check-out/)
  assert.match(operationalLanes, /Liberar habitación/)
})


test("calendar keeps BedBooking-like filters collapsed behind the familiar search action", () => {
  assert.match(calendarPage, /const \[showFilters, setShowFilters\] = useState\(false\)/)
  assert.match(calendarPage, /aria-expanded=\{showFilters\}/)
  assert.match(calendarPage, /\{showFilters && <div className="flex min-h-9/)
})


test("expanded reservation combines operational activities into one compact infinite-calendar lane", () => {
  const lanes = readFileSync(new URL("../components/calendar/reservation-operational-lanes.tsx", import.meta.url), "utf8")
  assert.match(lanes, /data-combined-operations-lane/)
  assert.match(lanes, /const operationItems = visibleLanes/)
  assert.match(lanes, /filter\(\(lane\) => lane\.key !== "milestones"\)/)
  assert.match(lanes, /min-h-\[42px\]/)
  assert.doesNotMatch(lanes, /visibleLanes\.map\(\(\{ key, label, Icon, className, items \}\)/)
})

test("calendar supports an explicit date deep-link for operational QA and handoff", () => {
  const calendarPage = readFileSync(new URL("../app/bookings/calendar/page.tsx", import.meta.url), "utf8")
  assert.match(calendarPage, /searchParams\.get\("date"\)/)
  assert.match(calendarPage, /bookingDateFromKey\(requested\)/)
})

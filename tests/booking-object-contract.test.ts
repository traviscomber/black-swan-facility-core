import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const bookingsPage = readFileSync(new URL("../app/bookings/page.tsx", import.meta.url), "utf8")
const bookingShortcut = readFileSync(new URL("../components/booking-object-shortcut.tsx", import.meta.url), "utf8")
const roomIndex = readFileSync(new URL("../app/bookings/rooms/page.tsx", import.meta.url), "utf8")
const roomObject = readFileSync(new URL("../app/bookings/rooms/[id]/page.tsx", import.meta.url), "utf8")
const roomObjectView = readFileSync(new URL("../components/booking-room-object-view.tsx", import.meta.url), "utf8")
const reservationObject = readFileSync(new URL("../app/bookings/reservations/[id]/page.tsx", import.meta.url), "utf8")
const reservationStayCockpit = readFileSync(new URL("../components/booking-reservation-stay-cockpit.tsx", import.meta.url), "utf8")

test("reservation list exposes the canonical reservation object in one click", () => {
  assert.match(bookingsPage, /href={`\/\$\{language\}\/bookings\/reservations\/\$\{row\.id\}`}/)
  assert.match(bookingShortcut, /BOOKING_COMMAND_SELECTION_EVENT/)
  assert.match(bookingShortcut, /href={`\/bookings\/reservations\/\$\{reservationId\}`}/)
  assert.match(bookingShortcut, /Abrir objeto completo/)
})

test("room catalog opens a canonical room object in one click", () => {
  assert.match(roomIndex, /href={`\/\$\{language\}\/bookings\/rooms\/\$\{room\.id\}`}/)
})

test("room object reads the canonical hospitality and work graph without writes", () => {
  assert.match(roomObject, /from\("room_state_matrix"\)/)
  assert.match(roomObject, /from\("reservations"\)/)
  assert.match(roomObject, /from\("housekeeping_tasks"\)/)
  assert.match(roomObject, /from\("hospitality_requests"\)/)
  assert.match(roomObject, /from\("maintenance_tasks"\)/)
  assert.match(roomObject, /from\("issues"\)/)
  assert.match(roomObject, /related_item_type", "room"/)
  assert.match(roomObject, /related_item_type", "reservation"/)
  assert.match(roomObject, /from\("assets"\)/)
  assert.match(roomObjectView, /vínculo por incidencia o mantenimiento/)
  assert.match(roomObject, /from\("room_operational_history"\)/)
  assert.match(roomObjectView, /\/bookings\/reservations\/\$\{state\.current_reservation_id\}/)
  assert.doesNotMatch(roomObject, /from\("incidents"\)/)
  assert.doesNotMatch(roomObject, /\.or\(/)
  assert.doesNotMatch(roomObject, /\.insert\(/)
  assert.doesNotMatch(roomObject, /\.update\(/)
  assert.doesNotMatch(roomObject, /\.delete\(/)
})

test("reservation object loads the canonical hospitality graph lazily", () => {
  assert.match(reservationObject, /from\("reservations"\)/)
  assert.match(reservationObject, /BookingReservationStayCockpit/)
  assert.doesNotMatch(reservationObject, /from\("guests"\)/)
  assert.doesNotMatch(reservationObject, /from\("payments"\)/)

  assert.match(reservationStayCockpit, /from\("guests"\)/)
  assert.match(reservationStayCockpit, /from\("rooms"\)/)
  assert.match(reservationStayCockpit, /from\("payments"\)/)
  assert.match(reservationStayCockpit, /from\("invoices"\)/)
  assert.match(reservationStayCockpit, /from\("housekeeping_tasks"\)/)
  assert.match(reservationStayCockpit, /from\("maintenance_tasks"\)/)
  assert.match(reservationStayCockpit, /from\("hospitality_requests"\)/)
  assert.match(reservationStayCockpit, /from\("reservation_operational_exceptions"\)/)
  assert.match(reservationStayCockpit, /from\("operational_documents"\)/)
  assert.match(reservationStayCockpit, /from\("booking_events"\)/)
  assert.match(reservationStayCockpit, /href={`\/bookings\/rooms\/\$\{context\.room\.id\}`}/)
  assert.doesNotMatch(reservationObject, /\.insert\(/)
  assert.doesNotMatch(reservationObject, /\.update\(/)
  assert.doesNotMatch(reservationObject, /\.delete\(/)
  assert.doesNotMatch(reservationStayCockpit, /\.insert\(/)
  assert.doesNotMatch(reservationStayCockpit, /\.update\(/)
  assert.doesNotMatch(reservationStayCockpit, /\.delete\(/)
})

test("object pages degrade partial related-data failures without fabricating state", () => {
  assert.match(roomObjectView, /Parte del contexto relacionado no pudo cargarse/)
  assert.match(reservationStayCockpit, /Parte del contexto relacionado no pudo cargarse/)
  assert.match(roomObjectView, /sin señal/)
  assert.match(reservationStayCockpit, /Sin registros vinculados/)
})

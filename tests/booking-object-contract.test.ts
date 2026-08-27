import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const bookingsPage = readFileSync(new URL("../app/bookings/page.tsx", import.meta.url), "utf8")
const bookingShortcut = readFileSync(new URL("../components/booking-object-shortcut.tsx", import.meta.url), "utf8")
const roomIndex = readFileSync(new URL("../app/bookings/rooms/page.tsx", import.meta.url), "utf8")
const roomObject = readFileSync(new URL("../app/bookings/rooms/[id]/page.tsx", import.meta.url), "utf8")
const reservationObject = readFileSync(new URL("../app/bookings/reservations/[id]/page.tsx", import.meta.url), "utf8")

test("calendar selection exposes the canonical reservation object in one click", () => {
  assert.match(bookingsPage, /<BookingObjectShortcut \/>/)
  assert.match(bookingShortcut, /BOOKING_COMMAND_SELECTION_EVENT/)
  assert.match(bookingShortcut, /href={`\/bookings\/reservations\/\$\{reservationId\}`}/)
  assert.match(bookingShortcut, /Abrir objeto completo/)
})

test("room catalog opens a canonical room object", () => {
  assert.match(roomIndex, /href={`\/bookings\/rooms\/\$\{room\.id\}`}/)
  assert.match(roomIndex, /Abrir objeto habitación/)
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
  assert.match(roomObject, /vínculo por incidencia o mantenimiento/)
  assert.match(roomObject, /from\("room_operational_history"\)/)
  assert.match(roomObject, /\/bookings\/reservations\/\$\{state\.current_reservation_id\}/)
  assert.doesNotMatch(roomObject, /from\("incidents"\)/)
  assert.doesNotMatch(roomObject, /\.or\(/)
  assert.doesNotMatch(roomObject, /\.insert\(/)
  assert.doesNotMatch(roomObject, /\.update\(/)
  assert.doesNotMatch(roomObject, /\.delete\(/)
})

test("reservation object is the connected hospitality object graph", () => {
  assert.match(reservationObject, /from\("reservations"\)/)
  assert.match(reservationObject, /from\("guests"\)/)
  assert.match(reservationObject, /from\("rooms"\)/)
  assert.match(reservationObject, /from\("payments"\)/)
  assert.match(reservationObject, /from\("invoices"\)/)
  assert.match(reservationObject, /from\("housekeeping_tasks"\)/)
  assert.match(reservationObject, /from\("maintenance_tasks"\)/)
  assert.match(reservationObject, /from\("hospitality_requests"\)/)
  assert.match(reservationObject, /from\("reservation_operational_exceptions"\)/)
  assert.match(reservationObject, /from\("operational_documents"\)/)
  assert.match(reservationObject, /from\("booking_events"\)/)
  assert.match(reservationObject, /href={`\/bookings\/rooms\/\$\{room\.id\}`}/)
  assert.doesNotMatch(reservationObject, /\.insert\(/)
  assert.doesNotMatch(reservationObject, /\.update\(/)
  assert.doesNotMatch(reservationObject, /\.delete\(/)
})

test("object pages degrade partial related-data failures without fabricating state", () => {
  assert.match(roomObject, /Parte del contexto relacionado no pudo cargarse/)
  assert.match(reservationObject, /Parte del contexto relacionado no pudo cargarse/)
  assert.match(roomObject, /sin señal/)
  assert.match(reservationObject, /sin señal/)
})

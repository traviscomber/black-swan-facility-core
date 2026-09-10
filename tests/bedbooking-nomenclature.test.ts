import assert from "node:assert/strict"
import test from "node:test"
import { getBedBookingDisplayIdentity, VERIFIED_BEDBOOKING_REFERENCE_ROWS } from "../lib/bookings/bedbooking-nomenclature.ts"

test("BedBooking verified room nomenclature stays exact", () => {
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Clubhouse", roomNumber: "Notro" }), { displayName: "CH-Notro", guestCapacity: 2, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Clubhouse", roomNumber: "Avellano" }), { displayName: "CH-Avellano", guestCapacity: 6, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Clubhouse", roomNumber: "Ulmo" }), { displayName: "CH-Ulmo", guestCapacity: 5, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Garden House", roomNumber: "Habitación 1" }), { displayName: "Garden House 1", guestCapacity: 2, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Bamboo House", roomNumber: "Room 1" }), { displayName: "BH-Bamboo House 1", guestCapacity: 2, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Ed Office", roomNumber: "Oficina" }), { displayName: "Office Room", guestCapacity: 1, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Prairy House 2", roomNumber: "Room1" }), { displayName: "PH2- Prairie House 1", guestCapacity: 2, source: "bedbooking_verified" })
})

test("complete BedBooking reference inventory remains captured in exact display order", () => {
  assert.equal(VERIFIED_BEDBOOKING_REFERENCE_ROWS.length, 41)
  assert.deepEqual(VERIFIED_BEDBOOKING_REFERENCE_ROWS.slice(16, 24), [
    { displayName: "BH-Bamboo House 1", guestCapacity: 2 },
    { displayName: "BH-Bamboo House 2", guestCapacity: 2 },
    { displayName: "BH-Bamboo House 3", guestCapacity: 2 },
    { displayName: "Hotelito 1", guestCapacity: 2 },
    { displayName: "Hotelito 2", guestCapacity: 2 },
    { displayName: "Hotelito 3", guestCapacity: 2 },
    { displayName: "Office Room", guestCapacity: 1 },
    { displayName: "Office Room 2", guestCapacity: 1 },
  ])
  assert.equal(VERIFIED_BEDBOOKING_REFERENCE_ROWS[0].displayName, "TO-Arrayan")
  assert.equal(VERIFIED_BEDBOOKING_REFERENCE_ROWS[40].displayName, "Glamping Tent")
})

test("unverified canonical rooms still fall back instead of receiving fabricated source mappings", () => {
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Unknown House", roomNumber: "Room A" }), { displayName: "Room A", guestCapacity: null, source: "canonical_fallback" })
})

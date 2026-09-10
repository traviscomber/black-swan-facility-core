import assert from "node:assert/strict"
import test from "node:test"
import { getBedBookingDisplayIdentity, VERIFIED_BEDBOOKING_REFERENCE_ROWS } from "../lib/bookings/bedbooking-nomenclature.ts"

test("BedBooking verified room nomenclature stays exact", () => {
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Clubhouse", roomNumber: "Notro" }), { displayName: "CH-Notro", guestCapacity: 2, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Clubhouse", roomNumber: "Avellano" }), { displayName: "CH-Avellano", guestCapacity: 6, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Clubhouse", roomNumber: "Ulmo" }), { displayName: "CH-Ulmo", guestCapacity: 5, source: "bedbooking_verified" })
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Garden House", roomNumber: "Habitación 1" }), { displayName: "Garden House 1", guestCapacity: 2, source: "bedbooking_verified" })
})

test("visible BedBooking reference inventory remains captured without guessing unresolved property mappings", () => {
  assert.equal(VERIFIED_BEDBOOKING_REFERENCE_ROWS.length, 33)
  assert.ok(VERIFIED_BEDBOOKING_REFERENCE_ROWS.some((row) => row.displayName === "TO-Arrayan" && row.guestCapacity === 2))
  assert.ok(VERIFIED_BEDBOOKING_REFERENCE_ROWS.some((row) => row.displayName === "CP-Bandurrias" && row.guestCapacity === 2))
  assert.ok(VERIFIED_BEDBOOKING_REFERENCE_ROWS.some((row) => row.displayName === "CH-Avellano" && row.guestCapacity === 6))
  assert.ok(VERIFIED_BEDBOOKING_REFERENCE_ROWS.some((row) => row.displayName === "PH3- Prairie House 3" && row.guestCapacity === 2))
  assert.ok(VERIFIED_BEDBOOKING_REFERENCE_ROWS.some((row) => row.displayName === "PC- Puerto Claro 3" && row.guestCapacity === 2))
  assert.ok(VERIFIED_BEDBOOKING_REFERENCE_ROWS.some((row) => row.displayName === "Glamping Tent" && row.guestCapacity === 2))
})

test("unverified rooms fall back to canonical names instead of fabricated BedBooking prefixes", () => {
  assert.deepEqual(getBedBookingDisplayIdentity({ propertyName: "Prairy House 2", roomNumber: "Room1" }), { displayName: "Room1", guestCapacity: null, source: "canonical_fallback" })
})

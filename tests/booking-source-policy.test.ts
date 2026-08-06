import assert from "node:assert/strict"
import test from "node:test"
import { bookingSourcePolicy } from "../lib/booking-source-policy.ts"

test("permite fuentes internas conocidas", () => {
  assert.equal(bookingSourcePolicy(null), "editable")
  assert.equal(bookingSourcePolicy("canonical_event_xls"), "editable")
  assert.equal(bookingSourcePolicy("direct"), "editable")
})

test("bloquea fuentes externas sincronizadas", () => {
  assert.equal(bookingSourcePolicy("iCal Airbnb"), "external-read-only")
  assert.equal(bookingSourcePolicy("booking.com"), "external-read-only")
  assert.equal(bookingSourcePolicy("channel_manager"), "external-read-only")
})

test("marca fuentes desconocidas para revisión", () => {
  assert.equal(bookingSourcePolicy("partner_import"), "review")
})

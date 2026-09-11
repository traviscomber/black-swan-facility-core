import assert from "node:assert/strict"
import test from "node:test"
import { BOOKING_TIME_ZONE, bookingDateKey } from "../lib/booking/timezone"

test("booking timezone is the canonical Santiago IANA zone", () => {
  assert.equal(BOOKING_TIME_ZONE, "America/Santiago")
})

test("booking date key follows Santiago across UTC midnight", () => {
  assert.equal(bookingDateKey("2026-09-11T02:30:00.000Z"), "2026-09-10")
  assert.equal(bookingDateKey("2026-09-11T04:30:00.000Z"), "2026-09-11")
})

test("booking date key respects Santiago summer offset", () => {
  assert.equal(bookingDateKey("2026-01-15T02:30:00.000Z"), "2026-01-14")
  assert.equal(bookingDateKey("2026-01-15T03:30:00.000Z"), "2026-01-15")
})

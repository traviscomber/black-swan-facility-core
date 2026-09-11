import assert from "node:assert/strict"
import test from "node:test"
import { BOOKING_TIME_ZONE, bookingDateFromKey, bookingDateKey, isBookingToday } from "../lib/booking/timezone"

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

test("booking date-only values stay stable in UI state", () => {
  const date = bookingDateFromKey("2026-09-11")
  assert.equal(date.getFullYear(), 2026)
  assert.equal(date.getMonth(), 8)
  assert.equal(date.getDate(), 11)
})

test("isBookingToday compares against Santiago date", () => {
  const todayKey = bookingDateKey()
  assert.equal(isBookingToday(`${todayKey}T12:00:00`), true)
})

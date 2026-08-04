import assert from "node:assert/strict"
import test from "node:test"
import { hasValidStayDates, isActiveReservationStatus, staysOverlap } from "../lib/booking-rules.ts"

test("requires checkout after checkin", () => {
  assert.equal(hasValidStayDates("2026-08-12", "2026-08-15"), true)
  assert.equal(hasValidStayDates("2026-08-12", "2026-08-12"), false)
  assert.equal(hasValidStayDates("2026-08-12", "2026-08-11"), false)
  assert.equal(hasValidStayDates("invalid", "2026-08-15"), false)
})

test("uses half-open stay intervals for bed conflicts", () => {
  assert.equal(staysOverlap("2026-08-12", "2026-08-15", "2026-08-14", "2026-08-16"), true)
  assert.equal(staysOverlap("2026-08-12", "2026-08-15", "2026-08-15", "2026-08-18"), false)
  assert.equal(staysOverlap("2026-08-12", "2026-08-15", "2026-08-10", "2026-08-12"), false)
})

test("recognizes only operationally active reservation states", () => {
  assert.equal(isActiveReservationStatus("confirmed"), true)
  assert.equal(isActiveReservationStatus("checked-in"), true)
  assert.equal(isActiveReservationStatus("cancelled"), false)
  assert.equal(isActiveReservationStatus("checked_out"), false)
})

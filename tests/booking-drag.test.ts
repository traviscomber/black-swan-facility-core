import assert from "node:assert/strict"
import test from "node:test"
import {
  bookingDragDates,
  bookingDragDayDelta,
  bookingEdgeScrollVelocity,
  bookingStaysOverlap,
} from "../lib/booking-drag.ts"

test("calculates horizontal movement including scroll displacement", () => {
  assert.equal(bookingDragDayDelta(104, 0, 104), 1)
  assert.equal(bookingDragDayDelta(40, 64, 104), 1)
  assert.equal(bookingDragDayDelta(-156, 0, 104), -1)
})

test("moves dates diagonally without changing stay length", () => {
  assert.deepEqual(bookingDragDates("move", "2026-08-10", "2026-08-13", 2), {
    checkIn: "2026-08-12",
    checkOut: "2026-08-15",
  })
})

test("resizes either boundary independently", () => {
  assert.deepEqual(bookingDragDates("resize-start", "2026-08-10", "2026-08-13", 1), {
    checkIn: "2026-08-11",
    checkOut: "2026-08-13",
  })
  assert.deepEqual(bookingDragDates("resize-end", "2026-08-10", "2026-08-13", 2), {
    checkIn: "2026-08-10",
    checkOut: "2026-08-15",
  })
})

test("uses half-open intervals for conflicts", () => {
  assert.equal(bookingStaysOverlap("2026-08-10", "2026-08-13", "2026-08-12", "2026-08-15"), true)
  assert.equal(bookingStaysOverlap("2026-08-10", "2026-08-13", "2026-08-13", "2026-08-15"), false)
})

test("accelerates autoscroll near viewport edges", () => {
  assert.equal(bookingEdgeScrollVelocity(200, 100, 900), 0)
  assert.ok(bookingEdgeScrollVelocity(110, 100, 900) < 0)
  assert.ok(bookingEdgeScrollVelocity(890, 100, 900) > 0)
  assert.equal(bookingEdgeScrollVelocity(50, 100, 900, 72, 20), -20)
  assert.equal(bookingEdgeScrollVelocity(950, 100, 900, 72, 20), 20)
})

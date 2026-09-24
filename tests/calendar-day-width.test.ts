import assert from "node:assert/strict"
import test from "node:test"
import { calendarDayWidth } from "../lib/bookings/calendar-day-width.ts"

test("short calendar ranges fill the viewport without overflowing it", () => {
  for (const days of [7, 14, 19]) {
    const dayWidth = calendarDayWidth(1200, days)
    const used = 168 + days * dayWidth
    assert.ok(dayWidth >= 46)
    assert.ok(used <= 1200)
    assert.ok(1200 - used < days + 16)
  }
})

test("long ranges remain legible and horizontally scrollable", () => {
  assert.equal(calendarDayWidth(1200, 33), 46)
  assert.equal(calendarDayWidth(0, 7), 46)
})

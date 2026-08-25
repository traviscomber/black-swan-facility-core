import assert from "node:assert/strict"
import test from "node:test"
import { DAY_WIDTH, LABEL_WIDTH, ROW_HEIGHT, temporalSpanGeometry } from "../lib/calendar/temporal-foundation.ts"

const dates = [
  new Date("2026-08-24T00:00:00Z"),
  new Date("2026-08-25T00:00:00Z"),
  new Date("2026-08-26T00:00:00Z"),
  new Date("2026-08-27T00:00:00Z"),
]

test("locks booking temporal constants", () => {
  assert.equal(DAY_WIDTH, 96)
  assert.equal(LABEL_WIDTH, 272)
  assert.equal(ROW_HEIGHT, 44)
})

test("uses half-open day spans", () => {
  assert.deepEqual(temporalSpanGeometry("2026-08-24", "2026-08-25", dates), { left: 0, width: 96 })
  assert.deepEqual(temporalSpanGeometry("2026-08-25", "2026-08-27", dates), { left: 96, width: 192 })
})

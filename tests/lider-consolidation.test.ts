import { describe, expect, it } from "vitest"
import { liderConsolidationCadence, nextLiderConsolidationDate } from "../lib/procurement/lider-consolidation"

describe("Lider purchase consolidation cadence", () => {
  it.each([
    ["2026-11-01T12:00:00-03:00", "daily"],
    ["2027-01-15T12:00:00-03:00", "daily"],
    ["2027-02-28T12:00:00-03:00", "daily"],
    ["2027-03-01T12:00:00-03:00", "weekly"],
    ["2026-10-31T12:00:00-03:00", "weekly"],
  ])("%s is %s", (value, expected) => {
    expect(liderConsolidationCadence(new Date(value))).toBe(expected)
  })

  it("advances one day in high season", () => {
    const start = new Date("2026-12-10T12:00:00-03:00")
    expect(nextLiderConsolidationDate(start).getDate()).toBe(11)
  })

  it("advances seven days in low season", () => {
    const start = new Date("2026-09-30T12:00:00-03:00")
    expect(nextLiderConsolidationDate(start).getDate()).toBe(7)
  })
})

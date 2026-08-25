import assert from "node:assert/strict"
import test from "node:test"
import { filterOsAreas, osAreas, rankAreasForAccess, resolveAreaForPath } from "../lib/os/navigation.ts"

const expectedKeys = ["today", "operations", "people", "places-assets", "finance", "network"]

test("defines exactly six stable OS areas", () => {
  assert.deepEqual(osAreas.map((area) => area.key), expectedKeys)
})

test("preserves established routes while resolving areas", () => {
  const cases: Array<[string, string]> = [
    ["/os", "today"], ["/bookings", "operations"], ["/activities-calendar", "operations"], ["/tasks", "operations"],
    ["/employees", "people"], ["/property-management", "places-assets"], ["/inventory", "places-assets"],
    ["/budgets", "finance"], ["/bookings/invoices", "finance"], ["/accounting", "finance"], ["/os/discovery", "network"],
  ]
  for (const [path, area] of cases) assert.equal(resolveAreaForPath(path), area)
  assert.equal(resolveAreaForPath("/en/bookings"), "operations")
  assert.equal(resolveAreaForPath("/de/budgets/approvals"), "finance")
})

test("filters by existing admin, action, and department gates", () => {
  const visible = filterOsAreas(osAreas, { is_admin: false }, (action) => action !== "payments.record", (department) => department !== "finance")
  const hrefs = visible.flatMap((area) => area.items.map((item) => item.href))
  assert.equal(hrefs.includes("/bookings/invoices"), false)
  assert.equal(hrefs.includes("/budgets"), false)
  assert.equal(hrefs.includes("/bookings"), true)
})

test("ranks one taxonomy from access shape without rewriting hrefs", () => {
  const before = osAreas.flatMap((area) => area.items.map((item) => item.href)).sort()
  const ranked = rankAreasForAccess(osAreas, { is_admin: false, role: "operator", departments: ["maintenance", "operations"], allowed_actions: ["maintenance.operate"] })
  const after = ranked.flatMap((area) => area.items.map((item) => item.href)).sort()
  assert.deepEqual(after, before)
  assert.equal(ranked[0]?.key, "today")
})

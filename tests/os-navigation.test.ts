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

test("keeps all six area hubs while server-authorized children stay out of static navigation", () => {
  const visible = filterOsAreas(osAreas, { is_admin: false }, () => true, () => true)
  assert.deepEqual(visible.map((area) => area.key), expectedKeys)
  const hrefs = visible.flatMap((area) => area.items.map((item) => item.href))
  assert.equal(hrefs.includes("/os/discovery"), false)
  assert.equal(hrefs.includes("/os/events"), false)
  assert.equal(hrefs.includes("/os/people"), false)
  assert.equal(resolveAreaForPath("/os/discovery"), "network")
})

test("ranks one taxonomy from access shape without rewriting hrefs", () => {
  const before = osAreas.flatMap((area) => area.items.map((item) => item.href)).sort()
  const ranked = rankAreasForAccess(osAreas, { is_admin: false, role: "operator", departments: ["maintenance", "operations"], allowed_actions: ["maintenance.operate"] })
  const after = ranked.flatMap((area) => area.items.map((item) => item.href)).sort()
  assert.deepEqual(after, before)
  assert.equal(ranked[0]?.key, "today")
})

test("three representative perspectives share the same production taxonomy", () => {
  const fixtures = {
    santiago: { is_admin: true, role: "owner", departments: ["finance", "administration", "operations"], allowed_actions: ["payments.record", "booking.modify"] },
    raimundo: { is_admin: false, role: "operations", departments: ["maintenance", "inventory", "operations"], allowed_actions: ["maintenance.operate", "inventory.process"] },
    tomas: { is_admin: false, role: "hospitality", departments: ["booking", "hospitality"], allowed_actions: ["booking.modify", "hospitality.operate"] },
  }

  for (const access of Object.values(fixtures)) {
    const ranked = rankAreasForAccess(osAreas, access)
    assert.deepEqual([...ranked].map((area) => area.key).sort(), [...expectedKeys].sort())
    assert.equal(ranked[0]?.key, "today")
  }
})

test("ranking never grants admin or rewrites direct URLs", () => {
  const access = { is_admin: false, role: "hospitality", departments: ["booking", "hospitality"], allowed_actions: ["booking.modify", "hospitality.operate"] }
  const filtered = filterOsAreas(osAreas, access, (action) => access.allowed_actions.includes(action), (department) => access.departments.includes(department))
  const hrefs = filtered.flatMap((area) => area.items.map((item) => item.href))
  assert.equal(hrefs.includes("/bookings"), true)
  assert.equal(hrefs.includes("/budgets"), false)
  assert.equal(resolveAreaForPath("/bookings/calendar"), "operations")
})

import assert from "node:assert/strict"
import test from "node:test"
import { filterOsAreas, osAreas, rankAreasForAccess, resolveAreaForPath } from "../lib/os/navigation.ts"
import { normalizeCapabilitySnapshot } from "../lib/access/capabilities.ts"
import { loadAuthorizedNavigationWith } from "../lib/os/authorized-navigation-client.ts"

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

test("view capability controls visibility independently from write actions", () => {
  const snapshot = normalizeCapabilitySnapshot({ domains: { booking: ["view"], operations: ["view"] } })
  const visible = filterOsAreas(osAreas, snapshot, { is_admin: false })
  const hrefs = visible.flatMap((area) => area.items.map((item) => item.href))
  assert.equal(hrefs.includes("/bookings"), true)
  assert.equal(hrefs.includes("/activities-calendar"), true)
  assert.equal(hrefs.includes("/budgets"), false)
})

test("map is hidden without map view even when other places capabilities exist", () => {
  const snapshot = normalizeCapabilitySnapshot({ domains: { maintenance: ["view"], inventory: ["view"] } })
  const visible = filterOsAreas(osAreas, snapshot, { is_admin: false })
  const hrefs = visible.flatMap((area) => area.items.map((item) => item.href))
  assert.equal(hrefs.includes("/property-management"), true)
  assert.equal(hrefs.includes("/inventory"), true)
  assert.equal(hrefs.includes("/map"), false)
})

test("keeps all six area hubs while server-authorized children stay out of static navigation", () => {
  const snapshot = normalizeCapabilitySnapshot({ domains: { people: ["admin"], network: ["admin"] } })
  const visible = filterOsAreas(osAreas, snapshot, { is_admin: true })
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

test("ranking never grants capabilities or rewrites direct URLs", () => {
  const access = { is_admin: false, role: "hospitality", departments: ["booking", "hospitality"], allowed_actions: ["booking.modify", "hospitality.operate"] }
  const snapshot = normalizeCapabilitySnapshot({ domains: { booking: ["operate"], operations: ["operate"] } })
  const filtered = filterOsAreas(osAreas, snapshot, access)
  const hrefs = filtered.flatMap((area) => area.items.map((item) => item.href))
  assert.equal(hrefs.includes("/bookings"), true)
  assert.equal(hrefs.includes("/budgets"), false)
  assert.equal(resolveAreaForPath("/bookings/calendar"), "operations")
})

test("Operations API outage falls back to canonical RPCs without granting routes", async () => {
  const rpcCalls: string[] = []
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test-token" } }, error: null }),
    },
    rpc: async (name: string) => {
      rpcCalls.push(name)
      if (name === "get_current_route_access") {
        return {
          data: {
            role_key: "hospitality",
            is_admin: false,
            domains: { booking: ["view"], operations: ["view"] },
          },
          error: null,
        }
      }
      if (name === "get_black_swan_os_navigation") {
        return {
          data: { items: [{ key: "events", label: "Eventos", href: "/os/events" }] },
          error: null,
        }
      }
      if (name === "get_discovery_navigation_entitlement") return { data: true, error: null }
      throw new Error(`Unexpected RPC: ${name}`)
    },
  }
  const requests: Array<{ input: string; authorization: string | null }> = []
  const unavailableFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      input: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
    })
    throw new Error("Operations API unavailable")
  }) as typeof fetch

  const navigation = await loadAuthorizedNavigationWith({
    supabase: supabase as never,
    apiUrl: "https://operations.example",
    fetchImpl: unavailableFetch,
  })
  const keys = navigation.items?.map((item) => item.key) ?? []

  assert.deepEqual(requests, [{ input: "https://operations.example/v1/os/navigation", authorization: "Bearer test-token" }])
  assert.deepEqual(rpcCalls, ["get_current_route_access", "get_black_swan_os_navigation", "get_discovery_navigation_entitlement"])
  assert.equal(navigation.role, "hospitality")
  assert.equal(keys.includes("bookings"), true)
  assert.equal(keys.includes("tasks"), true)
  assert.equal(keys.includes("events"), true)
  assert.equal(keys.includes("discovery"), true)
  assert.equal(keys.includes("maintenance"), false)
  assert.equal(keys.includes("inventory"), false)
  assert.equal(keys.includes("approvals"), false)
})

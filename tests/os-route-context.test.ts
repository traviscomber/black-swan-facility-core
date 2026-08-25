import assert from "node:assert/strict"
import test from "node:test"
import { buildOsRouteContext } from "../lib/os/route-context.ts"

test("builds route context from existing path", () => {
  assert.deepEqual(buildOsRouteContext("/es/bookings/calendar"), { pathname: "/es/bookings/calendar", area: "operations" })
  assert.deepEqual(buildOsRouteContext("/unknown"), { pathname: "/unknown", area: null })
})

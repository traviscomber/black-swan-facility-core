import assert from "node:assert/strict"
import test from "node:test"
import { osAreas } from "../lib/os/navigation.ts"

const criticalLegacyRoutes = [
  "/bookings",
  "/activities-calendar",
  "/tasks",
  "/checklists",
  "/procurement",
  "/maintenance",
  "/issues",
  "/bookings/requests",
  "/employees",
  "/property-management",
  "/inventory",
  "/energy",
  "/map",
  "/orchard",
  "/vineyard",
  "/cattle",
  "/cattle-health",
  "/combustibles",
  "/budgets",
  "/budgets/approvals",
  "/budgets/documents",
  "/budgets/reconciliation",
  "/accounting",
  "/bookings/invoices",
  "/os/discovery",
]

test("six-area taxonomy preserves critical established route URLs", () => {
  const hrefs = new Set(osAreas.flatMap((area) => area.items.map((item) => item.href)))
  for (const route of criticalLegacyRoutes) assert.equal(hrefs.has(route), true, `missing legacy route ${route}`)
})

test("navigation taxonomy contains no domain write endpoints", () => {
  const hrefs = osAreas.flatMap((area) => area.items.map((item) => item.href))
  assert.equal(hrefs.some((href) => href.startsWith("/api/") || href.includes("rpc")), false)
})

test("invoice entry point remains a navigation reference only", () => {
  const finance = osAreas.find((area) => area.key === "finance")
  const invoice = finance?.items.find((item) => item.key === "invoices")
  assert.equal(invoice?.href, "/bookings/invoices")
  assert.equal(invoice?.action, "payments.record")
})

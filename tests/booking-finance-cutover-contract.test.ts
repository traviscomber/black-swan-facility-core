import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const invoiceRoute = readFileSync(new URL("../app/api/bookings/invoices/route.ts", import.meta.url), "utf8")
const paymentsRoute = readFileSync(new URL("../app/api/bookings/payments/route.ts", import.meta.url), "utf8")
const invoiceEditor = readFileSync(new URL("../components/invoice-editor-modal.tsx", import.meta.url), "utf8")

test("new operational invoices use the canonical finalized reservation folio", () => {
  assert.match(invoiceRoute, /rpc\("generate_reservation_invoice"/)
  assert.doesNotMatch(invoiceRoute, /rpc\("create_reservation_invoice"/)
  assert.match(invoiceRoute, /payload\.invoiceId/)
})

test("payments are recorded through the canonical reservation payment RPC", () => {
  assert.match(paymentsRoute, /rpc\("record_reservation_payment"/)
  assert.match(paymentsRoute, /p_reservation_id/)
  assert.match(paymentsRoute, /p_payment_method/)
  assert.match(paymentsRoute, /amount <= 0/)
})

test("invoice UI exposes canonical payment capture only for finalized invoices", () => {
  assert.match(invoiceEditor, /financial\.finalized/)
  assert.match(invoiceEditor, /\/api\/bookings\/payments/)
  assert.match(invoiceEditor, /paymentExceedsBalance/)
  assert.match(invoiceEditor, /disabled className="h-10 w-full rounded-md border bg-background px-3 text-sm"/)
})

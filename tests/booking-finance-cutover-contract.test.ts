import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const invoiceRoute = readFileSync(new URL("../app/api/bookings/invoices/route.ts", import.meta.url), "utf8")
const paymentsRoute = readFileSync(new URL("../app/api/bookings/payments/route.ts", import.meta.url), "utf8")
const invoiceEditor = readFileSync(new URL("../components/invoice-editor-modal.tsx", import.meta.url), "utf8")
const invoiceMutationRoute = readFileSync(new URL("../app/api/bookings/invoices/[id]/route.ts", import.meta.url), "utf8")
const stayCockpit = readFileSync(new URL("../components/booking-reservation-stay-cockpit.tsx", import.meta.url), "utf8")
const finalHardeningMigration = readFileSync(new URL("../supabase/migrations/20260924013000_booking_final_hardening.sql", import.meta.url), "utf8")

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


test("invoice workspace overrides the base dialog width and contains overflow", () => {
  assert.match(invoiceEditor, /sm:max-w-\[1180px\]/)
  assert.match(invoiceEditor, /xl:max-w-\[1280px\]/)
  assert.match(invoiceEditor, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(invoiceEditor, /overflow-y-auto overflow-x-hidden/)
  assert.match(invoiceEditor, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(300px,360px\)\]/)
})


test("finalized invoices are immutable and cannot be physically deleted", () => {
  assert.match(invoiceMutationRoute, /currentInvoice\.finalized_at/)
  assert.match(invoiceMutationRoute, /status === "finalized"/)
  assert.match(invoiceMutationRoute, /Una factura finalizada es inmutable/)
  assert.match(invoiceMutationRoute, /from\("payments"\)/)
  assert.doesNotMatch(invoiceMutationRoute, /from\("invoice_payments"\)/)
})

test("stay cockpit separates reservation balance from invoiced balance and humanizes operational tokens", () => {
  assert.match(stayCockpit, /reservationBalance:"Reservation balance"/)
  assert.match(stayCockpit, /invoicedBalance:"Invoiced balance"/)
  assert.match(stayCockpit, /notInvoiced:"Not invoiced"/)
  assert.match(stayCockpit, /post_checkout_laundry/)
  assert.match(stayCockpit, /pre_arrival_inspection/)
  assert.match(stayCockpit, /operationalLabel\(x\.task_type/)
  assert.match(stayCockpit, /reservationBalance = Math\.max/)
})


test("finalized invoices are immutable and the UI becomes payment-only", () => {
  assert.match(invoiceMutationRoute, /currentInvoice\.finalized_at/)
  assert.match(invoiceMutationRoute, /Una factura finalizada es inmutable/)
  assert.match(invoiceMutationRoute, /from\("payments"\)/)
  assert.doesNotMatch(invoiceMutationRoute, /from\("invoice_payments"\)/)
  assert.match(invoiceEditor, /const invoiceLocked = financial\.finalized/)
  assert.match(invoiceEditor, /readOnly=\{!effectiveInvoiceId \|\| invoiceLocked\}/)
  assert.match(invoiceEditor, /!invoiceLocked && <Button[^>]*onClick=\{\(\) => void saveInvoice\(\)\}/)
})

test("stay cockpit separates reservation and invoice balances and hides operational tokens", () => {
  assert.match(stayCockpit, /reservationBalance:"Reservation balance"/)
  assert.match(stayCockpit, /invoicedBalance:"Invoiced balance"/)
  assert.match(stayCockpit, /notInvoiced:"Not invoiced"/)
  assert.match(stayCockpit, /operationalLabel\(x\.task_type/)
  assert.match(stayCockpit, /reservationBalance = Math\.max/)
})

test("final booking hardening closes concurrent booking and payment races", () => {
  assert.match(finalHardeningMigration, /reservations_no_active_bed_overlap/)
  assert.match(finalHardeningMigration, /exclude using gist/)
  assert.match(finalHardeningMigration, /pg_advisory_xact_lock/)
  assert.match(finalHardeningMigration, /where id = p_reservation_id\s+for update/)
  assert.match(finalHardeningMigration, /p_amount > v_balance/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260924222000_finance_status_alerts.sql', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')
const payments = readFileSync(new URL('../components/santiago-payment-queue.tsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../components/sidebar.tsx', import.meta.url), 'utf8')

test('finance status changes produce recipient alerts for Santiago', () => {
  assert.match(migration, /finance_document_alerts/)
  assert.match(migration, /approval_status/)
  assert.match(migration, /payment_status/)
  assert.match(migration, /reconciliation_status/)
  assert.match(migration, /finance_payment_authorizers/)
  assert.match(migration, /emit_finance_document_state_alerts/)
})

test('Raimundo can record reconciliation independently from expense approval', () => {
  assert.match(migration, /set_finance_document_reconciliation_status/)
  assert.match(migration, /unpaid/)
  assert.match(migration, /paid_observed/)
  assert.match(migration, /reconciled/)
  assert.match(queue, /Estado de conciliación actualizado\. Santiago recibió una alerta/)
  assert.match(queue, /Pago observado/)
})

test('Santiago sees alerts even when no payment is actionable', () => {
  assert.match(payments, /Cambios relevantes/)
  assert.match(payments, /Solo cambios de estado que Santiago necesita conocer/)
  assert.match(payments, /finance_document_alerts/)
  assert.match(sidebar, /finance_document_alerts/)
  assert.match(sidebar, /paymentPendingResult\.count.*alertResult\.count/)
})

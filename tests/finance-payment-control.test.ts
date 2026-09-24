import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260924212000_santiago_supplier_payment_control.sql', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../components/santiago-payment-queue.tsx', import.meta.url), 'utf8')
const approval = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')

test('finance flow separates Raimundo expense validation from Santiago payment control', () => {
  assert.match(migration, /payment_status/)
  assert.match(migration, /pending_santiago/)
  assert.match(migration, /can_finance_payment_authorize/)
  assert.match(migration, /decide_finance_payment/)
  assert.match(migration, /record_finance_payment/)
  assert.match(migration, /Raimundo approval is required before payment decision/)
  assert.match(migration, /Payment must be authorized before it can be recorded/)
})

test('Santiago is the configured final payer and payment evidence is mandatory', () => {
  assert.match(migration, /santiago@blackswn\.org/)
  assert.match(migration, /Payment reference is required/)
  assert.match(migration, /record_supplier_payment/)
  assert.match(queue, /Aprobar pago/)
  assert.match(queue, /Rechazar pago/)
  assert.match(queue, /Registrar pago/)
  assert.match(queue, /Referencia \/ comprobante/)
})

test('Raimundo can reassign allocation before expense approval', () => {
  assert.match(approval, /Reasignar/)
  assert.match(approval, /reassign_finance_document_center/)
  assert.match(approval, /Motivo de la reasignación/)
  assert.match(approval, /Rechazar gasto/)
})

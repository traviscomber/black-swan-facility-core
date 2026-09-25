import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260924212000_santiago_supplier_payment_control.sql', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../components/santiago-payment-queue.tsx', import.meta.url), 'utf8')
const approval = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')
const budgetMappingFix = readFileSync(new URL('../supabase/migrations/20260925024500_fix_assign_finance_budget_audit_action.sql', import.meta.url), 'utf8')

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
  assert.match(approval, /Cambiar centro/)
  assert.match(approval, /Asignar centro de costo/)
  assert.match(approval, /assign_finance_document_budget_mapping/)
  assert.match(approval, /Seleccionar imputación del Budget/)
  assert.match(approval, /p_category_id/)
  assert.match(approval, /Motivo de la reasignación/)
  assert.match(approval, /Aprobar sugerencia → Santiago/)
  assert.match(approval, /Cambiar y aprobar → Santiago/)
  assert.match(approval, /Asignar y aprobar → Santiago/)
  assert.match(approval, /enviado a Santiago para revisión y pago/)
  assert.match(approval, /Rechazar gasto/)
})


test('canonical Budget mapping uses an allowed critical audit action', () => {
  assert.match(budgetMappingFix, /'UPDATE','finance'/)
  assert.match(budgetMappingFix, /'operation','assign_canonical_budget_mapping'/)
  assert.doesNotMatch(budgetMappingFix, /'assign_canonical_budget_mapping','finance'/)
})

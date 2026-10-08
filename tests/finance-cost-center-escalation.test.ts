import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const raimundoQueue = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')
const santiagoQueue = readFileSync(new URL('../components/santiago-payment-queue.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260925163500_finance_cost_center_escalation_to_santiago.sql', import.meta.url), 'utf8')

test('Raimundo can escalate uncertain cost-center assignment to Santiago', () => {
  assert.match(raimundoQueue, /escalate_finance_document_cost_center/)
  assert.match(raimundoQueue, /No sé → Santiago/)
  assert.match(raimundoQueue, /Escalar a Santiago/)
  assert.match(raimundoQueue, /cost_center_escalation_status !== 'pending_santiago'/)
})

test('Santiago may resolve and approve explicitly escalated expenses without returning to Raimundo', () => {
  assert.match(santiagoQueue, /santiago_resolve_and_approve_escalated_expense/)
  assert.match(santiagoQueue, /Asignar y aprobar gasto/)
  assert.match(santiagoQueue, /directamente en tu bandeja de pagos/)
  assert.match(migration, /approval_status='ready'/)
  assert.doesNotMatch(migration, /payment_status='pending_santiago'.*assign_escalated_cost_center/s)
})

test('database preserves separation of duties and audit traceability', () => {
  assert.match(migration, /can_finance_approve\(\)/)
  assert.match(migration, /can_finance_payment_authorize\(\)/)
  assert.match(migration, /escalate_cost_center_to_santiago/)
  assert.match(migration, /assign_escalated_cost_center/)
  assert.match(migration, /next_owner','Raimundo'/)
  assert.match(migration, /cost_center_escalation_status='pending_santiago'/)
})

const newMigration = readFileSync(new URL('../supabase/migrations/20261008202500_santiago_escalated_expense_final_approval.sql', import.meta.url), 'utf8')
test('Santiago final approval is auditable and does not authorize or execute payment', () => {
  assert.match(newMigration, /can_finance_payment_authorize\(\)/)
  assert.match(newMigration, /cost_center_escalation_status <> 'pending_santiago'/)
  assert.match(newMigration, /payment_status='pending_santiago'/)
  assert.match(newMigration, /next_owner','Santiago'/)
  assert.match(newMigration, /critical_action_audit_log/)
  assert.doesNotMatch(newMigration, /payment_status='authorized'/)
})

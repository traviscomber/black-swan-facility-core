import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260924212000_santiago_supplier_payment_control.sql', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../components/santiago-payment-queue.tsx', import.meta.url), 'utf8')
const approval = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')
const budgetMappingFix = readFileSync(new URL('../supabase/migrations/20260925024500_fix_assign_finance_budget_audit_action.sql', import.meta.url), 'utf8')
const paidObservedGuard = readFileSync(new URL('../supabase/migrations/20261007153500_guard_paid_observed_supplier_payment.sql', import.meta.url), 'utf8')
const infrastructureMigration = readFileSync(new URL('../supabase/migrations/20261007224500_tomas_infrastructure_invoice_review.sql', import.meta.url), 'utf8')
const tomasQueue = readFileSync(new URL('../components/tomas-infrastructure-invoice-queue.tsx', import.meta.url), 'utf8')
const approvalWorkspace = readFileSync(new URL('../components/finance-approval-workspace.tsx', import.meta.url), 'utf8')
const budgetDisplay = readFileSync(new URL('../lib/finance/budget-display.ts', import.meta.url), 'utf8')
const decisionContext = readFileSync(new URL('../components/finance-decision-context.tsx', import.meta.url), 'utf8')
const approvalContextMigration = readFileSync(new URL('../supabase/migrations/20261007232000_finance_approval_context.sql', import.meta.url), 'utf8')

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
  assert.match(queue, /placeholder="Comprobante"/)
})

test('Raimundo can reassign allocation before expense approval', () => {
  assert.match(approval, /Cambiar imputación/)
  assert.match(approval, /Asignar imputación/)
  assert.match(approval, /assign_finance_document_budget_mapping/)
  assert.match(approval, /Seleccionar imputación del Budget/)
  assert.match(approval, /p_category_id/)
  assert.match(approval, /Motivo de la reasignación/)
  assert.match(approval, /Aprobar y enviar a pago/)
  assert.match(approval, /Cambiar y aprobar/)
  assert.match(approval, /Asignar y aprobar/)
  assert.match(approval, /Pedir centro a Santiago/)
  assert.match(approval, /Rechazar gasto/)
})


test('canonical Budget mapping uses an allowed critical audit action', () => {
  assert.match(budgetMappingFix, /'UPDATE','finance'/)
  assert.match(budgetMappingFix, /'operation','assign_canonical_budget_mapping'/)
  assert.doesNotMatch(budgetMappingFix, /'assign_canonical_budget_mapping','finance'/)
})


test('observed reconciliation payments cannot be authorized or executed again', () => {
  assert.match(paidObservedGuard, /reconciliation_status in \('paid_observed','reconciled'\)/)
  assert.match(paidObservedGuard, /cannot be authorized again/)
  assert.match(paidObservedGuard, /cannot be recorded again/)
  assert.match(queue, /reconciliation_status/)
  assert.match(queue, /observedPayments/)
  assert.match(queue, /row\.reconciliation_status !== 'paid_observed'/)
  assert.match(queue, /row\.reconciliation_status !== 'reconciled'/)
})


test('infrastructure invoices bypass Raimundo and go to Tomas then Santiago', () => {
  assert.match(infrastructureMigration, /source_key = 'buildings'/)
  assert.match(infrastructureMigration, /pending_tomas/)
  assert.match(infrastructureMigration, /approved_by_tomas/)
  assert.match(infrastructureMigration, /rejected_by_tomas/)
  assert.match(infrastructureMigration, /Infrastructure invoices are reviewed by Tomas, not Raimundo/)
  assert.match(infrastructureMigration, /reject_infrastructure_invoice_to_santiago/)
  assert.match(infrastructureMigration, /payment_status = 'pending_santiago'/)
  assert.match(tomasQueue, /Facturas por revisar/)
  assert.match(tomasQueue, /enviada a Santiago/)
  assert.match(approval, /row.category_key !== 'buildings'/)
  assert.match(approvalWorkspace, /can_review_infrastructure_invoices/)
})

test('Santiago remains final payer even when Tomas rejects infrastructure invoice', () => {
  assert.match(queue, /infrastructure_review_status/)
  assert.match(queue, /Tomás observó esta factura/)
  assert.match(queue, /Autorizar igualmente/)
  assert.match(queue, /No pagar/)
  assert.match(infrastructureMigration, /santiago_after_tomas_rejection/)
  assert.match(infrastructureMigration, /can_finance_payment_authorize/)
})


test('hospitality budget labels preserve operational hierarchy', () => {
  assert.match(budgetDisplay, /Hospitality · Farm/)
  assert.match(budgetDisplay, /Hospitality · Torobayo/)
  assert.match(approval, /financeAllocationLabel/)
  assert.match(queue, /financeAllocationLabel/)
  assert.match(tomasQueue, /financeAllocationLabel/)
})


test('approval actions show a compact factual invoice explanation', () => {
  assert.match(decisionContext, /Qué es/)
  assert.match(decisionContext, /Imputación/)
  assert.match(decisionContext, /Por qué/)
  assert.match(decisionContext, /Evidencia/)
  assert.match(decisionContext, /Ver detalle/)
  assert.match(approval, /FinanceDecisionContext/)
  assert.match(tomasQueue, /FinanceDecisionContext/)
  assert.match(queue, /FinanceDecisionContext/)
})

test('Tomas receives persisted invoice analysis without a new AI request', () => {
  assert.match(approvalContextMigration, /classificationReason/)
  assert.match(approvalContextMigration, /d\.classification_reason/)
  assert.match(approvalContextMigration, /d\.confidence/)
  assert.match(tomasQueue, /classificationReason/)
  assert.doesNotMatch(tomasQueue, /cost-center-suggestion/)
})


test('Santiago payment surface stays easy and decision-first', () => {
  assert.match(queue, />Pagos</)
  assert.match(queue, />Autorizar</)
  assert.match(queue, />No pagar</)
  assert.match(queue, />Registrar pago</)
  assert.match(queue, />Más</)
  assert.doesNotMatch(queue, /Resolver excepciones y pagos/)
  assert.doesNotMatch(queue, /Control final habilitado/)
  assert.doesNotMatch(queue, /Proveedor \/ documento/)
  assert.doesNotMatch(queue, /Imputación validada/)
})

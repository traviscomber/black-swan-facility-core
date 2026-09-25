import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../app/api/finance/approve/route.ts', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')
const autoFx = readFileSync(new URL('../supabase/migrations/20260925030000_auto_finance_eur_conversion.sql', import.meta.url), 'utf8')
const paymentAudit = readFileSync(new URL('../supabase/migrations/20260925030500_fix_finance_payment_audit_actions.sql', import.meta.url), 'utf8')

test('Raimundo approval automatically resolves CLP to EUR from the document date', () => {
  assert.match(route, /mindicador\.cl\/api\/euro/)
  assert.match(route, /document_date/)
  assert.match(route, /offset <= 7/)
  assert.match(route, /Banco Central de Chile/)
  assert.match(route, /approve_finance_document_auto_eur/)
  assert.match(autoFx, /round\(abs\(v_doc\.total_amount\) \/ p_clp_per_eur, 2\)/)
  assert.match(autoFx, /v_rate_to_eur := 1 \/ p_clp_per_eur/)
})

test('automatic EUR conversion completes Budget posting before Santiago payment review', () => {
  assert.match(autoFx, /approval_status='approved'/)
  assert.match(autoFx, /valuation_status='valued'/)
  assert.match(autoFx, /payment_status=v_payment_status/)
  assert.match(autoFx, /financial_postings/)
  assert.match(autoFx, /automatic_eur_valuation/)
  assert.match(queue, /EUR convertido automáticamente/)
  assert.match(queue, /Conversión EUR automática/)
  assert.doesNotMatch(queue, /Monto canónico en EUR/)
  assert.doesNotMatch(queue, /Tipo de cambio: EUR por 1/)
})

test('legacy pending valuations are automatically backfilled for Raimundo', () => {
  assert.match(queue, /requestedValuations/)
  assert.match(queue, /approval_status === 'pending_valuation'/)
  assert.match(queue, /Conversión EUR automática de aprobación previa/)
  assert.match(route, /\['ready', 'pending_valuation'\]/)
})

test('Santiago payment audit keeps SQL action values valid', () => {
  assert.match(paymentAudit, /'UPDATE','finance'/)
  assert.match(paymentAudit, /'operation',case when p_decision='authorized' then 'authorize_payment' else 'reject_payment' end/)
  assert.match(paymentAudit, /'operation','record_supplier_payment'/)
  assert.doesNotMatch(paymentAudit, /'authorize_payment','finance'/)
  assert.doesNotMatch(paymentAudit, /'record_supplier_payment','finance'/)
})

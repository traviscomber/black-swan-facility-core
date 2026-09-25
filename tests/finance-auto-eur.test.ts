import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../app/api/finance/approve/route.ts', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')
const autoFx = readFileSync(new URL('../supabase/migrations/20260925030000_auto_finance_eur_conversion.sql', import.meta.url), 'utf8')
const paymentAudit = readFileSync(new URL('../supabase/migrations/20260925030500_fix_finance_payment_audit_actions.sql', import.meta.url), 'utf8')
const santiago = readFileSync(new URL('../components/santiago-payment-queue.tsx', import.meta.url), 'utf8')

test('CLP to EUR valuation remains automatic and auditable', () => {
  assert.match(route, /mindicador\.cl\/api\/euro/)
  assert.match(route, /document_date/)
  assert.match(route, /offset <= 7/)
  assert.match(route, /Banco Central de Chile/)
  assert.match(route, /approve_finance_document_auto_eur/)
  assert.match(autoFx, /round\(abs\(v_doc\.total_amount\) \/ p_clp_per_eur, 2\)/)
  assert.match(autoFx, /v_rate_to_eur := 1 \/ p_clp_per_eur/)
})

test('FX can never block Raimundo approval or Santiago hand-off', () => {
  const approvalCall = route.indexOf("supabase.rpc('approve_finance_document'")
  const fxLookup = route.indexOf('resolveClpPerEur(document.document_date)')
  assert.ok(approvalCall >= 0)
  assert.ok(fxLookup > approvalCall)
  assert.match(route, /valuation: 'deferred'/)
  assert.match(route, /EUR valuation deferred without blocking approval/)
  assert.match(route, /ok: true/)
  assert.doesNotMatch(route, /Automatic EUR conversion failed/)
})

test('background valuation retry is silent in Raimundo UI', () => {
  assert.match(queue, /requestedValuations/)
  assert.match(queue, /approval_status === 'pending_valuation'/)
  assert.match(queue, /Valorización interna automática/)
  assert.doesNotMatch(queue, /EUR automático/)
  assert.doesNotMatch(queue, /EUR convertido automáticamente/)
  assert.doesNotMatch(queue, /convertida.*automáticamente a EUR/)
  assert.doesNotMatch(queue, /falta de tasa válida/)
  assert.doesNotMatch(queue, /Monto canónico en EUR/)
  assert.doesNotMatch(queue, /Tipo de cambio: EUR por 1/)
})

test('Santiago operates only on the original payment amount', () => {
  assert.doesNotMatch(santiago, /amount_eur/)
  assert.doesNotMatch(santiago, /fx_rate_to_eur/)
  assert.doesNotMatch(santiago, /fx_date/)
  assert.doesNotMatch(santiago, /Budget ·/)
  assert.match(santiago, /money\(row\.total_amount, row\.currency\)/)
})

test('Santiago payment audit keeps SQL action values valid', () => {
  assert.match(paymentAudit, /'UPDATE','finance'/)
  assert.match(paymentAudit, /'operation',case when p_decision='authorized' then 'authorize_payment' else 'reject_payment' end/)
  assert.match(paymentAudit, /'operation','record_supplier_payment'/)
  assert.doesNotMatch(paymentAudit, /'authorize_payment','finance'/)
  assert.doesNotMatch(paymentAudit, /'record_supplier_payment','finance'/)
})

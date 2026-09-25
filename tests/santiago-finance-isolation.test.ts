import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const sidebar = readFileSync(new URL('../components/sidebar.tsx', import.meta.url), 'utf8')
const gate = readFileSync(new URL('../components/finance-approval-route-gate.tsx', import.meta.url), 'utf8')
const approvalPage = readFileSync(new URL('../app/budgets/approvals/page.tsx', import.meta.url), 'utf8')
const isolation = readFileSync(new URL('../supabase/migrations/20260925032500_isolate_santiago_payment_scope.sql', import.meta.url), 'utf8')
const authorizedNavigation = readFileSync(new URL('../lib/os/authorized-navigation-client.ts', import.meta.url), 'utf8')

test('payment-only finance users see Supplier payments but not Raimundo approvals in navigation', () => {
  assert.match(sidebar, /can_finance_approve/)
  assert.match(sidebar, /can_finance_payment_authorize/)
  assert.match(sidebar, /const paymentOnlyFinance = canFinancePay && !canFinanceApprove/)
  assert.match(sidebar, /area\.items\.filter\(item => item\.key === "payments"\)/)
  assert.match(sidebar, /paymentOnlyFinance \? "\/budgets\/payments"/)
})

test('direct approval route redirects payment-only users to their payment queue', () => {
  assert.match(approvalPage, /FinanceApprovalRouteGate/)
  assert.match(gate, /can_finance_approve/)
  assert.match(gate, /can_finance_payment_authorize/)
  assert.match(gate, /budgets\/payments/)
  assert.match(gate, /if \(canApprove\)/)
})

test('database hides Raimundo pre-approval rows from payment-only authorizers', () => {
  assert.match(isolation, /can_finance_approve\(\)/)
  assert.match(isolation, /can_finance_payment_authorize\(\)/)
  assert.match(isolation, /payment_status in \('pending_santiago','authorized','rejected','paid'\)/)
  assert.match(isolation, /not public\.can_finance_payment_authorize\(\)/)
  assert.doesNotMatch(isolation, /pending_mapping/)
})

test('OS home and Finance area also exclude Raimundo work for payment-only users', () => {
  assert.match(authorizedNavigation, /can_finance_approve/)
  assert.match(authorizedNavigation, /can_finance_payment_authorize/)
  assert.match(authorizedNavigation, /const paymentOnlyFinance = Boolean\(canPay\) && !Boolean\(canApprove\)/)
  assert.match(authorizedNavigation, /item\.key === 'payments'/)
  assert.match(sidebar, /href: "\/budgets\/payments"/)
})

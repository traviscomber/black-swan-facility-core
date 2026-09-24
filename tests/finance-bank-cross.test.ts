import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../app/api/finance/bank-statements/route.ts', import.meta.url), 'utf8')
const parser = readFileSync(new URL('../lib/finance/bank-statement.ts', import.meta.url), 'utf8')
const santiago = readFileSync(new URL('../components/santiago-payment-queue.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260924224000_weekly_bank_cross.sql', import.meta.url), 'utf8')

test('every bank statement upload triggers an automatic cross', () => {
  assert.match(route, /parseBankStatement/)
  assert.match(route, /matchBankRow/)
  assert.match(route, /finance_bank_statement_rows/)
  assert.match(route, /reconciliation_status: 'paid_observed'/)
  assert.match(route, /matched_count/)
  assert.match(route, /unmatched_count/)
})

test('automatic bank matching is evidence-based and never final reconciliation', () => {
  assert.match(parser, /direction !== 'debit'/)
  assert.match(parser, /total_amount/)
  assert.match(parser, /document_number/)
  assert.match(parser, /supplier_name/)
  assert.match(parser, /confidence < 0\.85/)
  assert.doesNotMatch(route, /reconciliation_status: 'reconciled'/)
  assert.match(migration, /paid_observed, never final reconciliation automatically/)
})

test('Santiago view centers paid versus not-yet-reconciled', () => {
  assert.match(santiago, /Qué está pagado y qué sigue pendiente/)
  assert.match(santiago, /Sin pago conciliado/)
  assert.match(santiago, /Pago observado/)
  assert.match(santiago, /Conciliados/)
  assert.match(santiago, /Banco actualizado al/)
})

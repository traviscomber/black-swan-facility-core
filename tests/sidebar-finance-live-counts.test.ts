import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const sidebar = readFileSync(new URL('../components/sidebar.tsx', import.meta.url), 'utf8')

test('Raimundo approval badge excludes invoices escalated to Santiago', () => {
  assert.match(sidebar, /in\("approval_status", \["ready", "pending_mapping"\]\)/)
  assert.match(sidebar, /cost_center_escalation_status\.neq\.pending_santiago/)
})

test('finance sidebar badges refresh from realtime finance_document changes', () => {
  assert.match(sidebar, /sidebar-finance-counts-live/)
  assert.match(sidebar, /postgres_changes/)
  assert.match(sidebar, /table: "finance_documents"/)
  assert.match(sidebar, /loadFinancePendingCount/)
  assert.match(sidebar, /removeChannel\(financeCountChannel\)/)
})

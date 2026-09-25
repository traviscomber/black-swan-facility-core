import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../app/api/finance/cost-center-suggestion/route.ts', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../components/finance-approval-queue.tsx', import.meta.url), 'utf8')

test('AI center suggestion is constrained to canonical Budget cost mappings', () => {
  assert.match(route, /can_finance_approve/)
  assert.match(route, /budget_categories/)
  assert.match(route, /category_role/)
  assert.match(route, /enum: candidateIds/)
  assert.match(route, /category_id=null/)
  assert.match(route, /nunca elijas fuera de la lista/i)
  assert.match(route, /parsed\.confidence < 0\.55/)
})

test('AI reads source invoice but never approves or mutates the finance document', () => {
  assert.match(route, /finance_sii_uploads/)
  assert.match(route, /input_file/)
  assert.match(route, /data:application\/pdf;base64/)
  assert.doesNotMatch(route, /approve_finance_document/)
  assert.doesNotMatch(route, /assign_finance_document_budget_mapping/)
  assert.doesNotMatch(route, /\.update\(/)
})

test('Raimundo sees the AI suggestion and remains the human decision gate', () => {
  assert.match(queue, /IA sugiere/)
  assert.match(queue, /Sin sugerencia IA segura/)
  assert.match(queue, /Aprobar sugerencia → Santiago/)
  assert.match(queue, /Cambiar centro/)
  assert.match(queue, /Sugerencia IA confirmada por Raimundo/)
  assert.match(queue, /saveCenterAndApprove/)
})

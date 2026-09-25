import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const brief = readFileSync(new URL('../components/role-agentic-brief.tsx', import.meta.url), 'utf8')
const santiago = readFileSync(new URL('../components/santiago-home.tsx', import.meta.url), 'utf8')
const raimundo = readFileSync(new URL('../components/raimundo-home.tsx', import.meta.url), 'utf8')
const route = readFileSync(new URL('../app/api/ai/orchestrate/route.ts', import.meta.url), 'utf8')

test('role agentic brief is proactive but confirmation-gated', () => {
  assert.match(brief, /Next best action|Siguiente mejor acción/)
  assert.match(brief, /Prepare action|Preparar acción/)
  assert.match(brief, /Confirm and create task|Confirmar y crear tarea/)
  assert.match(brief, /proposalId/)
  assert.match(brief, /confirmed: true/)
  assert.match(brief, /Financial approvals and payments remain outside automatic execution/)
})

test('Santiago gets agentic finance follow-up without automatic approval', () => {
  assert.match(santiago, /RoleAgenticBrief/)
  assert.match(santiago, /cost-center-exceptions/)
  assert.match(santiago, /payments-to-authorize/)
  assert.match(santiago, /sin aprobarlos automáticamente/)
})

test('Raimundo gets agentic actions across finance hospitality cattle and vineyard', () => {
  assert.match(raimundo, /RoleAgenticBrief/)
  assert.match(raimundo, /finance-approvals/)
  assert.match(raimundo, /guest-requests/)
  assert.match(raimundo, /cattle-health/)
  assert.match(raimundo, /vineyard-risk/)
})

test('agentic proposals persist role-aware audit context', () => {
  assert.match(route, /const persona = readString\(contextInput\.persona/)
  assert.match(route, /const source = readString\(contextInput\.source/)
  assert.match(route, /operational_area: operationalArea/)
})


test('Santiago agent includes booking and hospitality operational signals', () => {
  assert.match(santiago, /openGuestRequests/)
  assert.match(santiago, /pendingHousekeeping/)
  assert.match(santiago, /guest-requests/)
  assert.match(santiago, /housekeeping-today/)
  assert.match(santiago, /table: "hospitality_requests"/)
  assert.match(santiago, /table: "housekeeping_tasks"/)
})

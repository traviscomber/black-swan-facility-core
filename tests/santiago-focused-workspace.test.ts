import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const personas = readFileSync(new URL('../lib/os/personas.ts', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../components/os-entry.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../components/santiago-home.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260925205500_santiago_focused_workspace.sql', import.meta.url), 'utf8')

test('Santiago has a dedicated OS persona and focused Today workspace', () => {
  assert.match(personas, /"santiago"/)
  assert.match(personas, /santiago: \["today", "operations", "finance"/)
  assert.match(entry, /persona === 'santiago'/)
  assert.match(entry, /<SantiagoHome \/>/)
})

test('Santiago home prioritizes booking and finance documents with live finance refresh', () => {
  assert.match(home, /Booking y documentos primero/)
  assert.match(home, /cost_center_escalation_status/)
  assert.match(home, /payment_status/)
  assert.match(home, /santiago-home-live/)
  assert.match(home, /table: "finance_documents"/)
  assert.match(home, /SantiagoTodayCommandCenter/)
})

test('Santiago profile starts in focused OS home', () => {
  assert.match(migration, /os_persona_key='santiago'/)
  assert.match(migration, /os_start_path='\/os'/)
  assert.match(migration, /external_orchard/)
})


test('Raimundo home prioritizes approvals, cattle, vineyard and orchard', () => {
  const raimundo = readFileSync(new URL('../components/raimundo-home.tsx', import.meta.url), 'utf8')
  assert.match(raimundo, /Aprobaciones, Ganadería, Viñedo y Huerto/)
  assert.match(raimundo, /\/budgets\/approvals/)
  assert.match(raimundo, /\/cattle/)
  assert.match(raimundo, /\/vineyard/)
  assert.match(raimundo, /\/orchard\/dashboard/)
  assert.match(raimundo, /raimundo-home-live/)
  assert.match(personas, /raimundo/)
  assert.match(migration, /raimundo@blackswn\.org/)
})


test('Raimundo keeps elevated field-admin visibility with booking and hospitality primary', () => {
  const raimundo = readFileSync(new URL('../components/raimundo-home.tsx', import.meta.url), 'utf8')
  assert.match(raimundo, /Booking y Hospitality/)
  assert.match(raimundo, /\/bookings\/calendar/)
  assert.match(raimundo, /\/bookings\/requests/)
  assert.match(personas, /raimundo: \["today", "finance", "operations", "places-assets"/)
})


test('Raimundo booking overview is live and operational', () => {
  const raimundo = readFileSync(new URL('../components/raimundo-home.tsx', import.meta.url), 'utf8')
  assert.match(raimundo, /arrivalsToday/)
  assert.match(raimundo, /departuresToday/)
  assert.match(raimundo, /openGuestRequests/)
  assert.match(raimundo, /table: "reservations"/)
  assert.match(raimundo, /table: "hospitality_requests"/)
  assert.match(raimundo, /\/bookings\/calendar/)
})

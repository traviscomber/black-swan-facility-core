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

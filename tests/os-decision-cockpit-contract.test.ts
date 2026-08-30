import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const cockpit = readFileSync(new URL('../components/os-decision-cockpit.tsx', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../components/os-entry.tsx', import.meta.url), 'utf8')

test('Today exposes a canonical concrete decision queue without replacing Panorama', () => {
  assert.match(entry, /<OsDecisionCockpit \/>/)
  assert.match(entry, /panorama \? <BigPictureHome \/>/)
  assert.match(cockpit, /Needs a decision now/)
  assert.match(cockpit, /Necesita decisión ahora/)
  assert.match(cockpit, /Jetzt entscheidungsrelevant/)
  assert.match(cockpit, /No synthetic scores/)
  assert.doesNotMatch(cockpit, /\.insert\(/)
  assert.doesNotMatch(cockpit, /\.update\(/)
  assert.doesNotMatch(cockpit, /\.delete\(/)
})

test('decision cockpit gates every source through canonical capabilities or finance permission', () => {
  assert.match(cockpit, /get_black_swan_os_navigation/)
  assert.match(cockpit, /hasNavKey\(navigation, 'bookings'\)/)
  assert.match(cockpit, /hasNavKey\(navigation, 'maintenance'\)/)
  assert.match(cockpit, /hasNavKey\(navigation, 'procurement'\)/)
  assert.match(cockpit, /hasNavKey\(navigation, 'tasks'\)/)
  assert.match(cockpit, /hasNavKey\(navigation, 'issues'\)/)
  assert.match(cockpit, /rpc\('can_finance_approve'\)/)
  assert.match(cockpit, /hasNavKey\(navigation, 'approvals'\)/)
})

test('decision cockpit uses concrete canonical objects and partial-source degradation', () => {
  assert.match(cockpit, /reservation_operational_exceptions/)
  assert.match(cockpit, /finance_approval_queue/)
  assert.match(cockpit, /maintenance_tasks/)
  assert.match(cockpit, /procurement_requests/)
  assert.match(cockpit, /from\('tasks'\)/)
  assert.match(cockpit, /from\('issues'\)/)
  assert.match(cockpit, /results\.some\(\(result\) => Boolean\(result\.error\)\)/)
  assert.match(cockpit, /next\.slice\(0, 8\)/)
})

test('decision cockpit reports observed last-24-hour changes instead of an inferred score', () => {
  assert.match(cockpit, /last24HoursIso/)
  assert.match(cockpit, /\.gte\('updated_at', since\)/)
  assert.match(cockpit, /\.gte\('created_at', since\)/)
  assert.match(cockpit, /Changed in the last 24 hours/)
  assert.match(cockpit, /Cambió en las últimas 24 horas/)
})

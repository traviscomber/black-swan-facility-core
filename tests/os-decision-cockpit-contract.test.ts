import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const cockpit = readFileSync(new URL('../components/os-decision-cockpit.tsx', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../components/os-entry.tsx', import.meta.url), 'utf8')

test('Today exposes a plain-language action center without replacing Panorama', () => {
  assert.match(entry, /<OsDecisionCockpit \/>/)
  assert.match(entry, /panorama \? <BigPictureHome \/>/)
  assert.match(cockpit, /What needs your attention/)
  assert.match(cockpit, /Qué necesita tu atención/)
  assert.match(cockpit, /Was jetzt deine Aufmerksamkeit braucht/)
  assert.match(cockpit, /Why it matters/)
  assert.match(cockpit, /Por qué importa/)
  assert.match(cockpit, /Review approval/)
  assert.match(cockpit, /Revisar aprobación/)
  assert.doesNotMatch(cockpit, /canonical objects|decision queue|synthetic scores|triaje/i)
  assert.doesNotMatch(cockpit, /\.insert\(/)
  assert.doesNotMatch(cockpit, /\.update\(/)
  assert.doesNotMatch(cockpit, /\.delete\(/)
})

test('decision cockpit gates every source through canonical capabilities or finance permission', () => {
  assert.match(cockpit, /get_current_route_access/)
  assert.match(cockpit, /normalizeCapabilitySnapshot/)
  assert.match(cockpit, /hasCapability\(capabilities, 'booking', 'view'\)/)
  assert.match(cockpit, /hasCapability\(capabilities, 'maintenance', 'view'\)/)
  assert.match(cockpit, /hasCapability\(capabilities, 'procurement', 'view'\)/)
  assert.match(cockpit, /hasCapability\(capabilities, 'operations', 'view'\)/)
  assert.match(cockpit, /hasCapability\(capabilities, 'finance', 'view'\)/)
  assert.match(cockpit, /rpc\('can_finance_approve'\)/)
  assert.doesNotMatch(cockpit, /hasNavKey/)
})

test('decision cockpit uses concrete canonical objects and partial-source degradation', () => {
  assert.match(cockpit, /reservation_operational_exceptions/)
  assert.match(cockpit, /finance_approval_queue/)
  assert.doesNotMatch(cockpit, /operational_label/)
  assert.match(cockpit, /maintenance_tasks/)
  assert.match(cockpit, /procurement_requests/)
  assert.match(cockpit, /from\('tasks'\)/)
  assert.match(cockpit, /from\('issues'\)/)
  assert.match(cockpit, /href: `\/budgets\/approvals\/\$\{row\.id\}`/)
  assert.match(cockpit, /href: `\/maintenance\/\$\{row\.id\}`/)
  assert.match(cockpit, /href: `\/tasks\?selected=\$\{row\.id\}`/)
  assert.match(cockpit, /href: `\/issues\/\$\{row\.id\}`/)
  assert.match(cockpit, /href: `\/procurement\/requests\/\$\{row\.id\}`/)
  assert.match(cockpit, /results\.some\(\(result\) => Boolean\(result\.error\)\)/)
  assert.match(cockpit, /next\.slice\(0, 8\)/)
  assert.match(cockpit, /\['submitted', 'under_review'\]/)
  assert.doesNotMatch(cockpit, /pending_approval/)
})

test('decision cockpit reports observed last-24-hour changes instead of an inferred score', () => {
  assert.match(cockpit, /last24HoursIso/)
  assert.match(cockpit, /\.gte\('updated_at', since\)/)
  assert.match(cockpit, /\.gte\('created_at', since\)/)
  assert.match(cockpit, /What changed today/)
  assert.match(cockpit, /Qué cambió hoy/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { hasCapability, normalizeCapabilitySnapshot } from '../lib/access/capabilities.ts'

test('capability levels are monotonic and unknown domains fail closed', () => {
  const snapshot = normalizeCapabilitySnapshot({ domains: { people: ['admin'], booking: ['view'] } })
  assert.equal(hasCapability(snapshot, 'people', 'view'), true)
  assert.equal(hasCapability(snapshot, 'people', 'operate'), true)
  assert.equal(hasCapability(snapshot, 'people', 'approve'), true)
  assert.equal(hasCapability(snapshot, 'people', 'admin'), true)
  assert.equal(hasCapability(snapshot, 'booking', 'view'), true)
  assert.equal(hasCapability(snapshot, 'booking', 'operate'), false)
  assert.equal(hasCapability(snapshot, 'unknown', 'view'), false)
})

test('malformed snapshots fail closed', () => {
  const snapshot = normalizeCapabilitySnapshot({ domains: { people: ['bogus'] } })
  assert.equal(hasCapability(snapshot, 'people', 'view'), false)
})

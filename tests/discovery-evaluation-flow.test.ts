import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const operationsWorker = readFileSync(new URL('../cloudflare/workers/operations/src/index.ts', import.meta.url), 'utf8')

test('Discovery refresh uses candidate and evaluation RPCs instead of legacy matching', () => {
  assert.match(operationsWorker, /get_discovery_candidate_pairs/)
  assert.match(operationsWorker, /record_discovery_evaluation/)
  assert.match(operationsWorker, /discovery-evaluate/)
})

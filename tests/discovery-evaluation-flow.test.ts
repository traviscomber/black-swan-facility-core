import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const operationsWorker = readFileSync(new URL('../cloudflare/workers/operations/src/index.ts', import.meta.url), 'utf8')

test('Discovery refresh evaluates candidate pairs through the new RPCs', () => {
  assert.match(operationsWorker, /get_discovery_candidate_pairs/)
  assert.match(operationsWorker, /record_discovery_evaluation/)
  assert.match(operationsWorker, /discovery-evaluate/)
  assert.doesNotMatch(operationsWorker, /case 'discovery-match': return \{ rpc: 'run_discovery_matching'/)
})

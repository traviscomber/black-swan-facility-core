import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('web manifest bypasses auth and locale proxy', () => {
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  assert.match(proxy, /manifest\.webmanifest/)
  assert.match(proxy, /webmanifest/)
})

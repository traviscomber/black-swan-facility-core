import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/20260825090000_expand_canonical_route_access.sql', import.meta.url)
const proxyUrl = new URL('../proxy.ts', import.meta.url)

function migrationSql() {
  return readFileSync(migrationUrl, 'utf8')
}

function proxySource() {
  return readFileSync(proxyUrl, 'utf8')
}

test('route access snapshot is canonical, backward compatible, and fail-closed', () => {
  const sql = migrationSql()
  assert.match(sql, /current_app_role\(\)/)
  assert.match(sql, /get_current_user_effective_access\(\)/)
  assert.match(sql, /'role_key'/)
  assert.match(sql, /'is_admin'/)
  assert.match(sql, /'can_approve_procurement'/)
  assert.match(sql, /'capabilities'/)
  assert.doesNotMatch(sql, /app_metadata|employees\s+e|full_name|lower\(coalesce\(e\.email/i)
  assert.match(sql, /revoke all on function public\.get_current_route_access\(\) from public/i)
})

test('route access snapshot names every OS route domain and only canonical levels', () => {
  const sql = migrationSql()
  for (const domain of ['booking','operations','people','places_assets','finance','network','admin','procurement','maintenance','inventory','orchard','vineyard','cattle','fuel','map']) {
    assert.match(sql, new RegExp(`'${domain}'`))
  }
  for (const level of ['view','operate','approve','admin']) assert.match(sql, new RegExp(`'${level}'`))
})

test('proxy maps sensitive route families to canonical capabilities', () => {
  const source = proxySource()
  assert.match(source, /\/bookings["']/)
  assert.match(source, /domain:\s*["']booking["'],\s*required:\s*["']view["']/)
  assert.match(source, /\/employees/)
  assert.match(source, /\/os\/people/)
  assert.match(source, /domain:\s*["']people["'],\s*required:\s*["']view["']/)
  assert.match(source, /\/map/)
  assert.match(source, /domain:\s*["']map["'],\s*required:\s*["']view["']/)
  assert.match(source, /\/activities-calendar/)
  assert.match(source, /\/tasks/)
  assert.match(source, /\/checklists/)
  assert.match(source, /domain:\s*["']operations["'],\s*required:\s*["']view["']/)
  assert.match(source, /\/admin/)
  assert.match(source, /domain:\s*["']admin["'],\s*required:\s*["']admin["']/)
})

test('proxy checks normalized localized pathname and fails closed', () => {
  const source = proxySource()
  assert.match(source, /effectivePathname\s*=\s*localized\.internalPathname/)
  assert.match(source, /normalizeCapabilitySnapshot\(null\)/)
  assert.match(source, /status:\s*401/)
  assert.match(source, /status:\s*403/)
  assert.match(source, /NextResponse\.redirect/)
  assert.doesNotMatch(source, /app_metadata/)
})

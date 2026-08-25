import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/20260825090000_expand_canonical_route_access.sql', import.meta.url)

function migrationSql() {
  return readFileSync(migrationUrl, 'utf8')
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

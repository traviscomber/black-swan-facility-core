import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260825110000_harden_map_gis_rls.sql', import.meta.url), 'utf8')

for (const table of ['infrastructure_plans', 'infrastructure_connections', 'gis_overlays']) {
  test(`${table} enables RLS and requires map view for reads`, () => {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    assert.match(sql, new RegExp(`create policy ${table}_map_read`, 'i'))
  })
}

test('Map writes are stricter than reads and preserve overlay color updates', () => {
  assert.match(sql, /can_view_operational_map\(\)/)
  assert.match(sql, /can_operate_operational_map\(\)/)
  assert.match(sql, /gis_overlays_map_update/i)
  assert.match(sql, /for update to authenticated/i)
  assert.match(sql, /current_app_role\(\) = 'admin'/i)
})

test('legacy permissive policies are removed before canonical policies are installed', () => {
  assert.match(sql, /from pg_policies/i)
  assert.match(sql, /drop policy/i)
  assert.match(sql, /infrastructure_plans.*infrastructure_connections.*gis_overlays/is)
})

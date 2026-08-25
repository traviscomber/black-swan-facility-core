import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260825100000_harden_people_graph_privacy.sql', import.meta.url), 'utf8')

test('People Graph shapes privacy on the server', () => {
  assert.match(sql, /get_people_graph_workspace\(\)/)
  assert.match(sql, /current_discovery_member_id\(\)/)
  assert.match(sql, /get_current_route_access\(\)/)
  assert.match(sql, /v_can_operate/)
  assert.match(sql, /jsonb_strip_nulls/i)
  assert.doesNotMatch(sql, /React|column hiding|client-side/i)
})

test('cross-member presence and guest details are gated while self-service remains possible', () => {
  for (const sensitive of ['guests', 'guest_name', 'valid_from', 'valid_until', 'can_enter_now', 'on_ground']) {
    assert.match(sql, new RegExp(sensitive))
  }
  assert.match(sql, /v_can_operate\s+or\s+m\.id\s*=\s*v_member_id/i)
  assert.match(sql, /case\s+when\s+v_can_operate/i)
  assert.match(sql, /'active_members'/)
  assert.match(sql, /'members_on_ground'/)
  assert.match(sql, /'open_guest_invitations'/)
})

test('ordinary directory access still requires Corporacion workspace entitlement', () => {
  assert.match(sql, /can_view_corporacion_workspace\(\)/)
  assert.match(sql, /PEOPLE_GRAPH_FORBIDDEN/)
  assert.match(sql, /revoke all on function public\.get_people_graph_workspace\(\) from public/i)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  new URL("../supabase/migrations/20260831144604_harden_incident_mutations.sql", import.meta.url),
  "utf8",
)

test("incident tables revoke anonymous and broad authenticated privileges", () => {
  for (const table of ["issues", "issue_labels", "issue_label_assignments", "issue_task_assignments"]) {
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`))
  }
  assert.doesNotMatch(migration, /grant all/i)
  assert.doesNotMatch(migration, /grant (truncate|trigger|references)/i)
})

test("incident authorization uses canonical access instead of JWT metadata", () => {
  assert.match(migration, /public\.current_app_role\(\)/)
  assert.match(migration, /public\.can_app_action\('maintenance\.operate'\)/)
  assert.match(migration, /public\.can_access_operational_scope\(/)
  assert.doesNotMatch(migration, /auth\.jwt\(\)/)
  assert.doesNotMatch(migration, /procurement_role/)
})

test("location-bound incident access resolves only canonical relationships", () => {
  assert.match(migration, /create or replace function public\.resolve_issue_scope_location/)
  assert.match(migration, /security invoker/)
  assert.match(migration, /assets a where a\.id = p_asset_id/)
  assert.match(migration, /infrastructure_plans i where i\.id = p_infrastructure_id/)
  assert.match(migration, /p_related_item_type = 'room'/)
  assert.match(migration, /p_related_item_type = 'reservation'/)
  assert.match(migration, /p_related_item_type = 'hospitality_request'/)
  assert.doesNotMatch(migration, /security definer/)
})

test("incident mutations preserve reporting while restricting triage and deletion", () => {
  assert.match(migration, /create policy issues_insert_authorized[\s\S]*current_app_role/)
  assert.match(migration, /create policy issues_update_maintenance[\s\S]*maintenance\.operate/)
  assert.match(migration, /create policy issues_delete_admin[\s\S]*current_app_role\(\).* = 'admin'/)
  assert.match(migration, /issue_label_assignments_insert_maintenance/)
  assert.match(migration, /issue_label_assignments_delete_maintenance/)
  assert.match(migration, /issue_task_assignments_insert_maintenance/)
  assert.match(migration, /issue_task_assignments_delete_maintenance/)
})

test("incident relationship policies validate visible parents", () => {
  assert.match(migration, /exists \(select 1 from public\.issues i where i\.id = issue_id\)/)
  assert.match(migration, /exists \(select 1 from public\.issue_labels l where l\.id = label_id and coalesce\(l\.is_active, true\)\)/)
  assert.match(migration, /exists \(select 1 from public\.tasks t where t\.id = task_id\)/)
})

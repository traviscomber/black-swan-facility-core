import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflowPath = new URL("../supabase/migrations/20260826190000_harden_inventory_asset_maintenance_workflow.sql", import.meta.url)
const assigneePath = new URL("../supabase/migrations/20260826190500_add_maintenance_assignee_directory.sql", import.meta.url)
const syncPath = new URL("../supabase/migrations/20260826194000_refine_inventory_asset_maintenance_status_sync.sql", import.meta.url)
const [workflow, assignees, sync] = await Promise.all([readFile(workflowPath, "utf8"), readFile(assigneePath, "utf8"), readFile(syncPath, "utf8")])

function includesSql(source: string, fragment: string) {
  return source.toLowerCase().includes(fragment.toLowerCase())
}

test("asset-linked maintenance has a covering index", () => {
  assert.ok(includesSql(workflow, "create index if not exists idx_maintenance_tasks_asset_id"))
  assert.ok(includesSql(workflow, "on public.maintenance_tasks(asset_id)"))
})

test("direct maintenance writes are limited to non-asset work", () => {
  assert.ok(includesSql(workflow, "create policy maintenance_tasks_insert_authorized"))
  assert.ok(includesSql(workflow, "create policy maintenance_tasks_update_authorized"))
  assert.ok(includesSql(workflow, "maintenance_tasks.asset_id is null"))
})

test("asset maintenance reads derive scope from the physical warehouse location", () => {
  assert.ok(includesSql(workflow, "join public.warehouse_locations wl on wl.id = a.warehouse_location_id"))
  assert.ok(includesSql(workflow, "join public.warehouses w on w.id = wl.warehouse_id"))
  assert.ok(includesSql(workflow, "public.can_access_operational_scope('maintenance', w.location_id)"))
})

test("asset maintenance creation requires inventory and maintenance permissions", () => {
  assert.ok(includesSql(workflow, "create or replace function public.create_inventory_asset_maintenance_task"))
  assert.ok(includesSql(workflow, "public.can_app_action('inventory.process')"))
  assert.ok(includesSql(workflow, "public.can_app_action('maintenance.operate')"))
  assert.ok(includesSql(workflow, "asset requires a warehouse location before maintenance can be scheduled"))
})

test("asset maintenance state machine fails closed", () => {
  assert.ok(includesSql(workflow, "p_action not in ('start','block','resume','complete','cancel')"))
  assert.ok(includesSql(workflow, "p_action = 'start' and v_state in ('scheduled','assigned')"))
  assert.ok(includesSql(workflow, "p_action = 'block' and v_state = 'in_progress'"))
  assert.ok(includesSql(workflow, "p_action = 'resume' and v_state = 'blocked'"))
  assert.ok(includesSql(workflow, "p_action = 'complete' and v_state in ('in_progress','blocked')"))
  assert.ok(includesSql(workflow, "p_action = 'cancel' and v_state in ('scheduled','assigned','in_progress','blocked')"))
})

test("asset status follows actual execution and scheduling never clears a manual maintenance state", () => {
  assert.ok(includesSql(sync, "v_new_state in ('in_progress','blocked')"))
  assert.ok(includesSql(sync, "set status = 'maintenance'"))
  assert.ok(includesSql(sync, "v_old_state in ('in_progress','blocked') and v_new_state not in ('in_progress','blocked')"))
  assert.ok(includesSql(sync, "set status = 'active'"))
  assert.ok(includesSql(sync, "where id = v_asset_id and status = 'maintenance'"))
  assert.equal(includesSql(sync, "if tg_op <> 'DELETE' and v_new_state in ('scheduled','assigned')"), false)
})

test("asset maintenance transitions leave an asset audit trail", () => {
  assert.ok(includesSql(workflow, "'maintenance_scheduled'"))
  assert.ok(includesSql(workflow, "'maintenance_' || p_action"))
  assert.ok(includesSql(workflow, "insert into public.asset_logs"))
})

test("asset maintenance RPCs are unavailable to public and anon", () => {
  assert.ok(includesSql(workflow, "revoke all on function public.create_inventory_asset_maintenance_task(uuid,text,text,uuid,text,integer,text,date) from public, anon"))
  assert.ok(includesSql(workflow, "revoke all on function public.transition_inventory_asset_maintenance_task(uuid,text,text,text,integer) from public, anon"))
  assert.ok(includesSql(workflow, "grant execute on function public.create_inventory_asset_maintenance_task(uuid,text,text,uuid,text,integer,text,date) to authenticated"))
  assert.ok(includesSql(workflow, "grant execute on function public.transition_inventory_asset_maintenance_task(uuid,text,text,text,integer) to authenticated"))
})

test("maintenance assignee directory is permission checked and hides direct employee-table dependency", () => {
  assert.ok(includesSql(assignees, "create or replace function public.list_maintenance_assignees()"))
  assert.ok(includesSql(assignees, "public.can_app_action('maintenance.operate')"))
  assert.ok(includesSql(assignees, "where coalesce(e.is_active, true)"))
  assert.ok(includesSql(assignees, "revoke all on function public.list_maintenance_assignees() from public, anon"))
})

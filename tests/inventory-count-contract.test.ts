import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("../supabase/migrations/20260826181805_add_inventory_cycle_count_workflow.sql", import.meta.url)
const source = await readFile(migrationPath, "utf8")

function includesSql(fragment: string) {
  return source.toLowerCase().includes(fragment.toLowerCase())
}

test("cycle count allows only one open session per warehouse location", () => {
  assert.ok(includesSql("create unique index if not exists inventory_count_one_open_per_location_uidx"))
  assert.ok(includesSql("where status in ('in_progress','submitted','approved')"))
})

test("cycle count tables expose scoped reads but no direct write policies", () => {
  assert.ok(includesSql("create policy inventory_count_sessions_select_scoped"))
  assert.ok(includesSql("create policy inventory_count_lines_select_scoped"))
  assert.equal(/create\s+policy[\s\S]{0,180}\b(for\s+)?(insert|update|delete|all)\b/i.test(source), false)
})

test("stock operations freeze counted source and destination locations", () => {
  assert.ok(includesSql("inventory_location_count_locked(v_item.warehouse_location_id)"))
  assert.ok(includesSql("inventory_location_count_locked(p_to_location_id)"))
})

test("procurement intake cannot mutate a frozen consumable location", () => {
  assert.ok(includesSql("inventory_location_count_locked(p_warehouse_location_id)"))
  assert.ok(includesSql("destination location is frozen by an active inventory count"))
})

test("count application fails closed when stock changed after snapshot", () => {
  assert.ok(includesSql("v_item.quantity_on_hand <> v_line.expected_quantity"))
  assert.ok(includesSql("stock balance changed after count session started"))
})

test("approved differences create auditable stock adjustment movements", () => {
  assert.ok(includesSql("insert into public.inventory_stock_movements"))
  assert.ok(includesSql("'adjustment'"))
  assert.ok(includesSql("v_line.expected_quantity,v_line.counted_quantity"))
})

test("cycle count RPCs are explicitly unavailable to public and anon", () => {
  assert.ok(includesSql("revoke all on function public.create_inventory_count_session(uuid,text) from public,anon,authenticated"))
  assert.ok(includesSql("revoke all on function public.apply_inventory_count_session(uuid) from public,anon,authenticated"))
  assert.ok(includesSql("grant execute on function public.create_inventory_count_session(uuid,text) to authenticated,service_role"))
  assert.ok(includesSql("grant execute on function public.apply_inventory_count_session(uuid) to authenticated,service_role"))
})

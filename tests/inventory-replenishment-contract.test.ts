import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("../supabase/migrations/20260826195549_add_inventory_replenishment_workflow.sql", import.meta.url)
const source = await readFile(migrationPath, "utf8")

function includesSql(fragment: string) {
  return source.toLowerCase().includes(fragment.toLowerCase())
}

test("replenishment keeps one active need per stock item", () => {
  assert.ok(includesSql("create unique index if not exists inventory_replenishment_one_active_per_stock_uidx"))
  assert.ok(includesSql("where status in ('open','requested','approved','ordered','receiving')"))
})

test("stock movements automatically refresh replenishment needs", () => {
  assert.ok(includesSql("create trigger inventory_stock_replenishment_sync"))
  assert.ok(includesSql("after insert or update of quantity_on_hand, minimum_stock, reorder_quantity, is_active"))
  assert.ok(includesSql("greatest(v_item.reorder_quantity, v_item.minimum_stock - v_item.quantity_on_hand, 0)"))
})

test("replenishment request creation is idempotent and permission scoped", () => {
  assert.ok(includesSql("create or replace function public.create_procurement_request_from_replenishment"))
  assert.ok(includesSql("if v_need.procurement_request_id is not null then"))
  assert.ok(includesSql("return v_need.procurement_request_id"))
  assert.ok(includesSql("public.can_app_action('inventory.process')"))
  assert.ok(includesSql("public.can_access_operational_scope('procurement', v_location_id)"))
})

test("procurement lifecycle states are compatible with quotation and receiving functions", () => {
  assert.ok(includesSql("'approved_for_quotation'"))
  assert.ok(includesSql("'final_approved'"))
  assert.ok(includesSql("'confirmed'"))
  assert.ok(includesSql("v_po.status not in ('issued','acknowledged','confirmed','partially_received')"))
})

test("purchase orders cannot duplicate an active order for the same request", () => {
  assert.ok(includesSql("create unique index if not exists procurement_purchase_orders_one_active_per_request_uidx"))
  assert.ok(includesSql("on public.procurement_purchase_orders(request_id)"))
  assert.ok(includesSql("where status <> 'cancelled'"))
})

test("request order and intake events advance the same replenishment lineage", () => {
  assert.ok(includesSql("create trigger procurement_request_replenishment_sync"))
  assert.ok(includesSql("create trigger procurement_order_replenishment_sync"))
  assert.ok(includesSql("create trigger procurement_intake_replenishment_sync"))
  assert.ok(includesSql("procurement_request_id=v_request_id"))
  assert.ok(includesSql("new.linked_stock_item_id = v_need.stock_item_id"))
})

test("replenishment tables are client read-only and scope protected", () => {
  assert.ok(includesSql("alter table public.inventory_replenishment_needs enable row level security"))
  assert.ok(includesSql("revoke all on table public.inventory_replenishment_needs from anon, authenticated"))
  assert.ok(includesSql("grant select on table public.inventory_replenishment_needs to authenticated"))
  assert.ok(includesSql("create policy inventory_replenishment_needs_select_scoped"))
})

test("purchase order transitions and receipt posting are server controlled", () => {
  assert.ok(includesSql("create or replace function public.transition_procurement_purchase_order"))
  assert.ok(includesSql("p_action='issue' and v_order.status='ready_to_issue'"))
  assert.ok(includesSql("p_action='confirm' and v_order.status in ('issued','acknowledged')"))
  assert.ok(includesSql("'receipt_posted','user'"))
  assert.ok(includesSql("revoke all on function public.post_procurement_receipt"))
})

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("../supabase/migrations/20260826201607_close_replenishment_receiving_lineage.sql", import.meta.url)
const source = await readFile(migrationPath, "utf8")

function includesSql(fragment: string) {
  return source.toLowerCase().includes(fragment.toLowerCase())
}

test("replenishment receipts always create consumable inventory intake", () => {
  assert.ok(includesSql("v_intake_required := p_inventory_intake_required or v_is_replenishment"))
  assert.ok(includesSql("v_intake_type := case when v_is_replenishment then 'consumable' else p_intake_type end"))
  assert.ok(includesSql("Ingreso obligatorio generado por reposición de Inventario"))
})

test("only manual non-replenishment intake requires inventory permission during receiving", () => {
  assert.ok(includesSql("p_inventory_intake_required and not v_is_replenishment and not public.can_app_action('inventory.process')"))
})

test("replenishment intake resolves and locks the originating stock item", () => {
  assert.ok(includesSql("select n.stock_item_id,si.warehouse_location_id"))
  assert.ok(includesSql("where n.procurement_request_id=v_request_id"))
  assert.ok(includesSql("where id=v_replenishment_stock_id and is_active=true"))
  assert.ok(includesSql("where id=v_stock_id"))
})

test("replenishment intake cannot be redirected to another warehouse position", () => {
  assert.ok(includesSql("p_warehouse_location_id <> v_replenishment_location_id"))
  assert.ok(includesSql("Replenishment intake must return to the originating stock location"))
})

test("wrong stock lineage becomes an exception instead of silently closing the need", () => {
  assert.ok(includesSql("new.linked_stock_item_id is distinct from v_need.stock_item_id"))
  assert.ok(includesSql("reconciliation_status='exception'"))
  assert.ok(includesSql("Inventory intake SKU mismatch requires review"))
})

test("partial receipt remains receiving until stock or purchase cycle is actually resolved", () => {
  assert.ok(includesSql("if v_stock.quantity_on_hand > v_stock.minimum_stock then"))
  assert.ok(includesSql("if v_order_status='received' and v_pending_intakes=0 then"))
  assert.ok(includesSql("set status='receiving'"))
  assert.ok(includesSql("perform public.refresh_inventory_replenishment_need(v_need.stock_item_id)"))
})

test("receiving RPCs are closed to anon and internal sync remains non-callable", () => {
  assert.ok(includesSql("revoke all on function public.post_procurement_receipt(uuid,numeric,numeric,text,text,text,text,text,boolean,text) from public,anon,authenticated"))
  assert.ok(includesSql("grant execute on function public.post_procurement_receipt(uuid,numeric,numeric,text,text,text,text,text,boolean,text) to authenticated,service_role"))
  assert.ok(includesSql("revoke all on function public.process_procurement_inventory_intake(uuid,uuid,uuid,uuid,text,numeric,text) from public,anon,authenticated"))
  assert.ok(includesSql("revoke all on function public.sync_inventory_replenishment_from_intake() from public,anon,authenticated"))
})

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("../supabase/migrations/20260826185000_add_inventory_asset_custody_workflow.sql", import.meta.url)
const source = await readFile(migrationPath, "utf8")

function includesSql(fragment: string) {
  return source.toLowerCase().includes(fragment.toLowerCase())
}

test("asset custody is normalized to an employee and keeps an audit snapshot", () => {
  assert.ok(includesSql("employee_id uuid not null references public.employees(id)"))
  assert.ok(includesSql("employee_name_snapshot text not null"))
})

test("an asset can have only one active custody", () => {
  assert.ok(includesSql("create unique index if not exists inventory_asset_custodies_one_active_per_asset_uidx"))
  assert.ok(includesSql("where status = 'active'"))
})

test("custody dates cannot expire before the handover", () => {
  assert.ok(includesSql("inventory_asset_custodies_due_after_issue"))
  assert.ok(includesSql("due_at is null or due_at > issued_at"))
})

test("custody table is client read-only and scoped", () => {
  assert.ok(includesSql("revoke all on table public.inventory_asset_custodies from anon, authenticated"))
  assert.ok(includesSql("grant select on table public.inventory_asset_custodies to authenticated"))
  assert.ok(includesSql("create policy inventory_asset_custodies_select_scoped"))
  assert.equal(/create\s+policy[\s\S]{0,180}\b(for\s+)?(insert|update|delete|all)\b/i.test(source), false)
})

test("custody assignment requires inventory permission and writes the operational ledger", () => {
  assert.ok(includesSql("create or replace function public.assign_inventory_asset_custody"))
  assert.ok(includesSql("public.can_app_action('inventory.process')"))
  assert.ok(includesSql("insert into public.inventory_asset_custodies"))
  assert.ok(includesSql("v_asset.id, 'assignment'"))
  assert.ok(includesSql("'custody_assignment'"))
})

test("custody return closes history and clears the legacy display assignee", () => {
  assert.ok(includesSql("create or replace function public.return_inventory_asset_custody"))
  assert.ok(includesSql("set status = 'returned'"))
  assert.ok(includesSql("assigned_to = null"))
  assert.ok(includesSql("v_asset.id, 'return'"))
  assert.ok(includesSql("'custody_return'"))
})

test("custody RPCs are not executable by public or anon", () => {
  assert.ok(includesSql("revoke all on function public.assign_inventory_asset_custody(uuid, uuid, text, timestamptz, text) from public, anon"))
  assert.ok(includesSql("revoke all on function public.return_inventory_asset_custody(uuid, uuid, text, text) from public, anon"))
  assert.ok(includesSql("grant execute on function public.assign_inventory_asset_custody(uuid, uuid, text, timestamptz, text) to authenticated"))
  assert.ok(includesSql("grant execute on function public.return_inventory_asset_custody(uuid, uuid, text, text) to authenticated"))
})

test("custodian directory exposes only active employees through a permission checked RPC", () => {
  assert.ok(includesSql("create or replace function public.list_inventory_custodians()"))
  assert.ok(includesSql("where coalesce(e.is_active, true)"))
  assert.ok(includesSql("revoke all on function public.list_inventory_custodians() from public, anon"))
})
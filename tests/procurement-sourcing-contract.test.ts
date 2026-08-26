import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("../supabase/migrations/20260826200745_harden_procurement_sourcing_workflow.sql", import.meta.url)
const source = await readFile(migrationPath, "utf8")

function includesSql(fragment: string) {
  return source.toLowerCase().includes(fragment.toLowerCase())
}

test("one procurement request can have only one active quotation round", () => {
  assert.ok(includesSql("create unique index if not exists procurement_quotation_one_active_per_request_uidx"))
  assert.ok(includesSql("where status in ('draft','ready','sent','collecting','comparison_ready','pending_final_approval')"))
})

test("sourcing tables are client read-only for authenticated users", () => {
  for (const table of ["procurement_quotation_rounds", "procurement_quotation_requests", "procurement_supplier_quotes", "procurement_quote_items", "procurement_comparisons"]) {
    assert.ok(includesSql(`revoke insert, update, delete on table public.${table} from authenticated`))
  }
})

test("RFQ creation uses canonical permission and location scope", () => {
  assert.ok(includesSql("create or replace function public.start_procurement_quotation"))
  assert.ok(includesSql("public.can_app_action('procurement.manage')"))
  assert.ok(includesSql("public.can_access_operational_scope('procurement',v_request.location_id)"))
  assert.ok(includesSql("every selected supplier must be active and approved"))
  assert.ok(includesSql("if v_round_id is not null then return v_round_id"))
})

test("manual quote capture validates and upserts one quote per RFQ", () => {
  assert.ok(includesSql("create or replace function public.submit_procurement_supplier_quote"))
  assert.ok(includesSql("if p_total <= 0 then raise exception"))
  assert.ok(includesSql("on conflict(quotation_request_id) do update"))
  assert.ok(includesSql("status='responded'"))
})

test("comparison requires the configured minimum of valid human-approved quotes", () => {
  assert.ok(includesSql("create or replace function public.build_procurement_comparison"))
  assert.ok(includesSql("if v_count < greatest(v_minimum,2)"))
  assert.ok(includesSql("and not q.requires_human_review"))
  assert.ok(includesSql("generated_by=excluded.generated_by"))
})

test("final supplier approval is role checked and purchase-order idempotent", () => {
  assert.ok(includesSql("v_role := public.current_app_role()"))
  assert.ok(includesSql("v_role not in ('admin','approver')"))
  assert.ok(includesSql("select id into v_order_id from public.procurement_purchase_orders where request_id=v_request_id and status<>'cancelled'"))
  assert.ok(includesSql("if v_order_id is not null then"))
  assert.ok(includesSql("'ready_to_issue'"))
})

test("all sourcing mutation RPCs are unavailable to public and anon", () => {
  assert.ok(includesSql("revoke all on function public.start_procurement_quotation"))
  assert.ok(includesSql("revoke all on function public.submit_procurement_supplier_quote"))
  assert.ok(includesSql("revoke all on function public.build_procurement_comparison"))
  assert.ok(includesSql("revoke all on function public.approve_procurement_comparison"))
})

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("../supabase/migrations/20260826193000_add_inventory_asset_physical_audits.sql", import.meta.url)
const source = await readFile(migrationPath, "utf8")

function includesSql(fragment: string) {
  return source.toLowerCase().includes(fragment.toLowerCase())
}

test("serialized asset audits allow one open session per location", () => {
  assert.ok(includesSql("create unique index if not exists inventory_asset_audit_one_open_per_location_uidx"))
  assert.ok(includesSql("where status in ('in_progress','submitted','approved')"))
})

test("audit tables are client read-only with scoped select policies", () => {
  assert.ok(includesSql("create policy inventory_asset_audit_sessions_select_scoped"))
  assert.ok(includesSql("create policy inventory_asset_audit_lines_select_scoped"))
  assert.ok(includesSql("revoke all on table public.inventory_asset_audit_sessions from anon, authenticated"))
  assert.ok(includesSql("revoke all on table public.inventory_asset_audit_lines from anon, authenticated"))
  assert.equal(/create\s+policy[\s\S]{0,180}\b(for\s+)?(insert|update|delete|all)\b/i.test(source), false)
})

test("snapshot excludes assets whose physical accountability is elsewhere", () => {
  assert.ok(includesSql("coalesce(a.status, 'active') not in ('deprecated','maintenance')"))
  assert.ok(includesSql("nullif(trim(coalesce(a.assigned_to,'')), '') is null"))
  assert.ok(includesSql("public.inventory_asset_custodies c where c.asset_id = a.id and c.status = 'active'"))
})

test("scans distinguish expected present assets from unexpected assets", () => {
  assert.ok(includesSql("v_line.is_expected"))
  assert.ok(includesSql("set scan_status = 'present'"))
  assert.ok(includesSql("scan_status, condition, notes, scanned_by, scanned_at"))
  assert.ok(includesSql("'unexpected'"))
})

test("submitting converts unscanned expected assets to formal missing findings", () => {
  assert.ok(includesSql("set scan_status='missing'"))
  assert.ok(includesSql("is_expected and scan_status='pending'"))
})

test("review and closure require an independent approval role", () => {
  assert.ok(includesSql("public.current_app_role() not in ('admin','approver')"))
  assert.ok(includesSql("only approved asset audits can be closed"))
})

test("closing an audit logs findings without mutating asset master data", () => {
  assert.ok(includesSql("'physical_audit_missing'"))
  assert.ok(includesSql("'physical_audit_unexpected'"))
  assert.ok(includesSql("'physical_audit_condition'"))
  assert.ok(includesSql("'assets_mutated',0"))
  assert.equal(/update\s+public\.assets\b/i.test(source), false)
})

test("asset audit RPCs are unavailable to public and anon", () => {
  for (const signature of [
    "public.create_inventory_asset_audit_session(uuid,text)",
    "public.record_inventory_asset_audit_scan(uuid,uuid,text,text)",
    "public.submit_inventory_asset_audit_session(uuid)",
    "public.review_inventory_asset_audit_session(uuid,boolean,text)",
    "public.close_inventory_asset_audit_session(uuid)",
    "public.cancel_inventory_asset_audit_session(uuid,text)",
  ]) {
    assert.ok(includesSql(`revoke all on function ${signature} from public, anon`))
    assert.ok(includesSql(`grant execute on function ${signature} to authenticated`))
  }
})

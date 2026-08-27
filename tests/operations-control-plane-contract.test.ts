import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  new URL("../supabase/migrations/20260827210000_operations_control_plane_v1.sql", import.meta.url),
  "utf8",
)
const whatsappRoute = readFileSync(
  new URL("../app/api/send-whatsapp-notification/route.ts", import.meta.url),
  "utf8",
)
const alertsRoute = readFileSync(new URL("../app/api/alerts/route.ts", import.meta.url), "utf8")
const alertGenerator = readFileSync(new URL("../lib/alert-generator.ts", import.meta.url), "utf8")

test("operations health snapshot is scheduled, observable and overlap-safe", () => {
  assert.match(migration, /create extension if not exists pg_cron/i)
  assert.match(migration, /create table if not exists public\.integration_job_runs/i)
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /pg_try_advisory_xact_lock/i)
  assert.match(migration, /operations-health-snapshot/)
  assert.match(migration, /\*\/15 \* \* \* \*/)
})

test("health snapshot does not auto-resolve business decisions", () => {
  assert.doesNotMatch(migration, /resolve_hospitality_import_reconciliation/i)
  assert.doesNotMatch(migration, /refresh_finance_historical_alias_proposals/i)
  assert.doesNotMatch(migration, /classify_hospitality_import_reconciliation/i)
})

test("WhatsApp notification route never claims an automated delivery that did not happen", () => {
  assert.doesNotMatch(whatsappRoute, /success:\s*true/)
  assert.doesNotMatch(whatsappRoute, /Notification sent/)
  assert.match(whatsappRoute, /manual_required/)
  assert.match(whatsappRoute, /status:\s*501/)
})

test("operational alerts expose degraded and failed source health", () => {
  assert.match(alertGenerator, /\.error/)
  assert.match(alertGenerator, /health:\s*'healthy' \| 'degraded' \| 'failed'/)
  assert.match(alertsRoute, /x-operations-health/)
  assert.match(alertsRoute, /status:\s*503/)
})

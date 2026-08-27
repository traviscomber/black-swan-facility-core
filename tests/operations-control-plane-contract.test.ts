import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const migrationV1 = readFileSync(
  new URL("../supabase/migrations/20260827210000_operations_control_plane_v1.sql", import.meta.url),
  "utf8",
)
const migrationV2 = readFileSync(
  new URL("../supabase/migrations/20260827213000_operations_control_plane_v2.sql", import.meta.url),
  "utf8",
)
const migrations = `${migrationV1}\n${migrationV2}`
const whatsappRoute = readFileSync(
  new URL("../app/api/send-whatsapp-notification/route.ts", import.meta.url),
  "utf8",
)
const alertsRoute = readFileSync(new URL("../app/api/alerts/route.ts", import.meta.url), "utf8")
const alertGenerator = readFileSync(new URL("../lib/alert-generator.ts", import.meta.url), "utf8")

test("operations health snapshot is scheduled, observable and overlap-safe", () => {
  assert.match(migrationV1, /create extension if not exists pg_cron/i)
  assert.match(migrationV1, /create table if not exists public\.integration_job_runs/i)
  assert.match(migrationV1, /enable row level security/i)
  assert.match(migrations, /pg_try_advisory_xact_lock/i)
  assert.match(migrations, /operations-health-snapshot/)
  assert.match(migrations, /\*\/15 \* \* \* \*/)
})

test("control plane v2 has bounded retries, stale recovery and terminal dead letters", () => {
  assert.match(migrationV2, /private\.integration_job_registry/i)
  assert.match(migrationV2, /max_attempts/i)
  assert.match(migrationV2, /retry_backoff_seconds/i)
  assert.match(migrationV2, /retry_after/i)
  assert.match(migrationV2, /recovered_at/i)
  assert.match(migrationV2, /dead_lettered_at/i)
  assert.match(migrationV2, /superseded_by_run_id/i)
  assert.match(migrationV2, /for update of r skip locked/i)
  assert.match(migrationV2, /stale_timeout/i)
  assert.match(migrationV2, /integration-job-supervisor/i)
  assert.match(migrationV2, /3,8,13,18,23,28,33,38,43,48,53,58 \* \* \* \*/)
})

test("automatic recovery only retries the read-only health snapshot", () => {
  assert.match(migrationV2, /r\.job_key = 'operations-health-snapshot'/)
  assert.match(migrationV2, /execute_operations_health_snapshot/i)
  assert.doesNotMatch(migrationV2, /resolve_hospitality_import_reconciliation/i)
  assert.doesNotMatch(migrationV2, /refresh_finance_historical_alias_proposals/i)
  assert.doesNotMatch(migrationV2, /classify_hospitality_import_reconciliation/i)
  assert.doesNotMatch(migrationV2, /approve_finance_document/i)
  assert.doesNotMatch(migrationV2, /decide_procurement_request/i)
})

test("health snapshot does not auto-resolve business decisions", () => {
  assert.doesNotMatch(migrations, /resolve_hospitality_import_reconciliation/i)
  assert.doesNotMatch(migrations, /refresh_finance_historical_alias_proposals/i)
  assert.doesNotMatch(migrations, /classify_hospitality_import_reconciliation/i)
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

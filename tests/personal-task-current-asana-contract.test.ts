import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const myTasks = fs.readFileSync("app/my-tasks/page.tsx", "utf8")
const syncRoute = fs.readFileSync("app/api/asana-live/sync/route.ts", "utf8")
const migration = fs.readFileSync("supabase/migrations/20260908021500_asana_current_task_store.sql", "utf8")
const catalogMigration = fs.readFileSync("supabase/migrations/20260908020500_asana_current_intake_catalog.sql", "utf8")

test("personal tasks do not treat routing candidates, demos or historical Asana imports as assigned work", () => {
  assert.doesNotMatch(myTasks, /get_my_routed_task_ids/)
  assert.match(myTasks, /isDemoTask/)
  assert.match(myTasks, /isHistoricalAsanaTask/)
  assert.match(myTasks, /task_assignments/)
})

test("personal tasks expose refresh and only current Asana intake", () => {
  assert.match(myTasks, /\/api\/asana-live\/sync/)
  assert.match(myTasks, /asana_current_tasks/)
  assert.match(myTasks, /asana_sync_baselines/)
  assert.match(myTasks, /created_at_source/)
  assert.match(myTasks, /last_seen_at/)
  assert.match(myTasks, /Actualizar desde Asana/)
})

test("workspace sync persists current Asana API state separately from historical observations", () => {
  assert.match(syncRoute, /asana_current_tasks/)
  assert.match(syncRoute, /created_at/)
  assert.match(syncRoute, /created_at_source/)
  assert.doesNotMatch(syncRoute, /\.from\("asana_live_observations"\)/)
})

test("Asana titles are stored in a unique normalized catalog without creating canonical tasks", () => {
  assert.match(syncRoute, /asana_task_title_catalog/)
  assert.match(syncRoute, /normalized_title/)
  assert.match(catalogMigration, /normalized_title text not null unique/)
  assert.match(catalogMigration, /task_category like 'asana_import%'/)
  assert.match(migration, /asana_current_tasks/)
  assert.match(migration, /2026-09-07T03:00:00\+00:00/)
})

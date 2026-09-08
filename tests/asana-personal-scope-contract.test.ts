import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const historyPage = readFileSync(new URL("../app/asana-live/page.tsx", import.meta.url), "utf8")
const myTasksPage = readFileSync(new URL("../app/my-tasks/page.tsx", import.meta.url), "utf8")
const syncRoute = readFileSync(new URL("../app/api/asana-live/sync/route.ts", import.meta.url), "utf8")

test("Asana history remains scoped to the authenticated Black Swan identity", () => {
  assert.match(historyPage, /supabase\.auth\.getUser\(\)/)
  assert.match(historyPage, /user_access_profiles/)
  assert.match(historyPage, /belongsToIdentity/)
  assert.match(historyPage, /Histórico Asana/)
  assert.doesNotMatch(historyPage, /trabajo de Raimundo/i)
  assert.doesNotMatch(historyPage, /Ámbito de Raimundo/i)
  assert.doesNotMatch(historyPage, /Raimundo scope/i)
})

test("current personal work uses explicit canonical Asana identity links", () => {
  assert.match(myTasksPage, /"juan vial": "travis@blackswn\.org"/)
  assert.match(myTasksPage, /"raimundo colvin": "raimundo@blackswn\.org"/)
  assert.match(myTasksPage, /linkedAsanaEmail/)
  assert.match(myTasksPage, /asana_current_tasks/)
})

test("workspace synchronization is no longer pinned to one assignee", () => {
  assert.match(syncRoute, /fetchWorkspaceUsers/)
  assert.match(syncRoute, /fetchIncompleteTasksForUser/)
  assert.match(syncRoute, /assignee_email: task\.assignee\?\.email/)
  assert.doesNotMatch(syncRoute, /DEFAULT_RAIMUNDO_GID/)
  assert.doesNotMatch(syncRoute, /ASANA_RAIMUNDO_GID/)
})

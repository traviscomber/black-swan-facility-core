import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const historyPage = readFileSync(new URL("../app/asana-live/page.tsx", import.meta.url), "utf8")
const myTasksPage = readFileSync(new URL("../app/my-tasks/page.tsx", import.meta.url), "utf8")
const syncRoute = readFileSync(new URL("../app/api/asana-live/sync/route.ts", import.meta.url), "utf8")

test("Asana history remains scoped to the authenticated Black Swan identity", () => {
  assert.match(historyPage, /supabase\.auth\.getUser\(\)/)
  assert.match(historyPage, /user_access_profiles/)
  assert.match(historyPage, /asana_identity_links/)
  assert.match(historyPage, /belongsToIdentity/)
  assert.match(historyPage, /Histórico Asana/)
  assert.doesNotMatch(historyPage, /trabajo de Raimundo/i)
  assert.doesNotMatch(historyPage, /Ámbito de Raimundo/i)
  assert.doesNotMatch(historyPage, /Raimundo scope/i)
})

test("current personal work uses canonical Asana identity links instead of hardcoded people", () => {
  assert.match(myTasksPage, /asana_identity_links/)
  assert.match(myTasksPage, /asana_email,asana_user_gid/)
  assert.match(myTasksPage, /asana_current_tasks/)
  assert.doesNotMatch(myTasksPage, /ASANA_EMAIL_BY_EMPLOYEE/)
  assert.doesNotMatch(myTasksPage, /"juan vial": "travis@blackswn\.org"/)
})

test("workspace synchronization searches only post-cutover intake and includes unassigned tasks", () => {
  assert.match(syncRoute, /fetchCurrentWorkspaceTasks/)
  assert.match(syncRoute, /workspaces\/\$\{workspaceGid\}\/tasks\/search/)
  assert.match(syncRoute, /created_at\.after/)
  assert.match(syncRoute, /assignee_email: task\.assignee\?\.email/)
  assert.match(syncRoute, /const unassigned = currentTasks\.filter/)
  assert.doesNotMatch(syncRoute, /fetchWorkspaceUsers/)
  assert.doesNotMatch(syncRoute, /DEFAULT_RAIMUNDO_GID/)
})

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const page = readFileSync(new URL("../app/asana-live/page.tsx", import.meta.url), "utf8")
const syncRoute = readFileSync(new URL("../app/api/asana-live/sync/route.ts", import.meta.url), "utf8")

test("Asana live is scoped to the authenticated Black Swan identity", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/)
  assert.match(page, /user_access_profiles/)
  assert.match(page, /belongsToIdentity/)
  assert.match(page, /Mis tareas de Asana/)
  assert.doesNotMatch(page, /trabajo de Raimundo/i)
  assert.doesNotMatch(page, /Ámbito de Raimundo/i)
  assert.doesNotMatch(page, /Raimundo scope/i)
})

test("workspace synchronization is no longer pinned to one assignee", () => {
  assert.match(syncRoute, /fetchWorkspaceUsers/)
  assert.match(syncRoute, /fetchIncompleteTasksForUser/)
  assert.match(syncRoute, /collaborator_label: task\.assignee\?\.email/)
  assert.doesNotMatch(syncRoute, /DEFAULT_RAIMUNDO_GID/)
  assert.doesNotMatch(syncRoute, /ASANA_RAIMUNDO_GID/)
})

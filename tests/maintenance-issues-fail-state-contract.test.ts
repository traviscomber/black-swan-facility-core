import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const maintenance = readFileSync(new URL("../app/maintenance/page.tsx", import.meta.url), "utf8")
const issues = readFileSync(new URL("../components/issues-view.tsx", import.meta.url), "utf8")
const maintenanceDrawer = readFileSync(new URL("../components/maintenance-quick-add-drawer.tsx", import.meta.url), "utf8")

test("maintenance load failures do not render zero metrics or an empty queue", () => {
  assert.match(maintenance, /disabled=\{loading\|\|error\}/)
  assert.match(maintenance, /\{!loading&&!error&&<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">/)
  assert.match(maintenance, /\{!loading&&!error&&<Card>/)
  assert.match(maintenance, /: error\s*\? null\s*: filteredTasks\.length===0/)
})

test("issue load failures suppress metrics, empty state and write entry points", () => {
  assert.match(issues, /actions=\{loadFailed \? undefined : <Button asChild>/)
  assert.match(issues, /\{loadFailed && <div[^>]*>.*copy\.retry/s)
  assert.match(issues, /\{!loadFailed && <>/)
  assert.match(issues, /issues\.length === 0 \? <Card>/)
})

test("location-scoped maintenance creation requires a canonical asset location", () => {
  assert.match(maintenanceDrawer, /useEffectiveAccess\(\)/)
  assert.match(maintenanceDrawer, /access\.has_explicit_scopes && access\.location_ids\.length > 0/)
  assert.match(maintenanceDrawer, /locationScoped && !selectedAsset/)
  assert.match(maintenanceDrawer, /can\('maintenance\.operate'\)/)
  assert.match(maintenanceDrawer, /can\('inventory\.process'\)/)
  assert.match(maintenanceDrawer, /create_inventory_asset_maintenance_task/)
  assert.match(maintenanceDrawer, /Selecciona un activo con ubicación/)
})

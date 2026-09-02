import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const entry = readFileSync(new URL("../components/os-entry.tsx", import.meta.url), "utf8")
const panorama = readFileSync(new URL("../components/big-picture-home.tsx", import.meta.url), "utf8")
const navigationLoader = readFileSync(new URL("../lib/os/authorized-navigation-client.ts", import.meta.url), "utf8")

test("OS exposes daily operation and Panorama as two views of the same shell", () => {
  assert.match(entry, /searchParams\.get\('view'\) === 'panorama'/)
  assert.match(entry, /const osHref = `\/\$\{language\}\/os`/)
  assert.match(entry, /href=\{osHref\}/)
  assert.match(entry, /href=\{`\$\{osHref\}\?view=panorama`\}/)
  assert.match(entry, /panorama \? <BigPictureHome \/>/)
  assert.match(entry, /persona === 'field_admin' \? <FieldAdminHome \/> : <OsHome \/>/)
})

test("OS normalizes dynamic finance labels without changing canonical hrefs", () => {
  assert.match(navigationLoader, /'\/accounting\/reports': 'Reportes financieros'/)
  assert.match(navigationLoader, /presentationLabelsByHref\[item\.href\] \?\? item\.label/)
  assert.match(navigationLoader, /merged\.set\(item\.key, normalizePresentationLabel\(item\)\)/)
})

test("Panorama remains capability and RLS scoped instead of persona-authorized", () => {
  assert.match(panorama, /loadAuthorizedNavigation/)
  assert.match(navigationLoader, /rpc\('get_current_route_access'\)/)
  assert.match(navigationLoader, /filterOsAreas/)
  assert.match(panorama, /hasNavKey\(nav, 'bookings'\)/)
  assert.match(panorama, /hasNavKey\(nav, 'tasks'\)/)
  assert.match(panorama, /hasNavKey\(nav, 'maintenance'\)/)
  assert.match(panorama, /hasNavKey\(nav, 'issues'\)/)
  assert.match(panorama, /hasNavKey\(nav, 'inventory'\)/)
  assert.match(panorama, /hasNavKey\(nav, 'procurement'\)/)
  assert.doesNotMatch(panorama, /persona ===/)
})

test("Panorama is grounded in canonical operational sources and finance permission", () => {
  assert.match(panorama, /from\('reservations'\)/)
  assert.match(panorama, /from\('hospitality_requests'\)/)
  assert.match(panorama, /from\('reservation_operational_exceptions'\)/)
  assert.match(panorama, /from\('tasks'\)/)
  assert.match(panorama, /from\('maintenance_tasks'\)/)
  assert.match(panorama, /from\('issues'\)/)
  assert.match(panorama, /from\('inventory_stock_status'\)/)
  assert.match(panorama, /from\('inventory_replenishment_needs'\)/)
  assert.match(panorama, /from\('procurement_requests'\)/)
  assert.match(panorama, /rpc\('can_finance_approve'\)/)
  assert.match(panorama, /from\('finance_approval_queue'\)/)
  assert.match(panorama, /approval_status', 'ready'/)
})

test("Panorama exposes concrete priority objects instead of stopping at counts", () => {
  assert.match(panorama, /Requiere atención ahora/)
  assert.match(panorama, /Objetos concretos detrás de las señales/)
  assert.match(panorama, /href: `\/bookings\/reservations\/\$\{row\.reservation_id\}`/)
  assert.match(panorama, /href: `\/procurement\/requests\/\$\{row\.id\}`/)
  assert.match(panorama, /priorityRank/)
  assert.match(panorama, /slice\(0, 8\)/)
  assert.match(panorama, /if \(!blockerRows\.error\)/)
  assert.match(panorama, /if \(!blockedMaintenanceRows\.error\)/)
  assert.match(panorama, /if \(!procurementDecisionRows\.error\)/)
})

test("Panorama reports evidence, not synthetic business scores", () => {
  assert.match(panorama, /Sin scores sintéticos/)
  assert.match(panorama, /Estado visible/)
  assert.match(panorama, /señales requieren atención/)
  assert.doesNotMatch(panorama, /AI score/i)
  assert.doesNotMatch(panorama, /ROI/i)
  assert.doesNotMatch(panorama, /efficiency score/i)
  assert.doesNotMatch(panorama, /\.insert\(/)
  assert.doesNotMatch(panorama, /\.update\(/)
  assert.doesNotMatch(panorama, /\.delete\(/)
})

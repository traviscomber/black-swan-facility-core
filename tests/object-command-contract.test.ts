import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const palette = readFileSync(new URL("../components/object-command-palette.tsx", import.meta.url), "utf8")
const layout = readFileSync(new URL("../components/app-layout.tsx", import.meta.url), "utf8")
const sidebar = readFileSync(new URL("../components/sidebar.tsx", import.meta.url), "utf8")

test("global shell mounts the object command palette and keeps the sidebar shortcut", () => {
  assert.match(layout, /import \{ ObjectCommandPalette \}/)
  assert.match(layout, /<ObjectCommandPalette access=\{access\} canAccessDepartment=\{canAccessDepartment\} \/>/)
  assert.match(sidebar, /metaKey: true/)
  assert.match(sidebar, /⌘K/)
  assert.match(palette, /event\.metaKey \|\| event\.ctrlKey/)
  assert.match(palette, /event\.key\.toLowerCase\(\) === "k"/)
})

test("object search is lazy, debounced and capability scoped", () => {
  assert.match(palette, /term\.length < 2/)
  assert.match(palette, /window\.setTimeout/)
  assert.match(palette, /180/)
  assert.match(palette, /rpc\("get_current_route_access"\)/)
  assert.match(palette, /hasCapability\(routeCapabilities, "booking", "view"\)/)
  assert.match(palette, /hasCapability\(routeCapabilities, "inventory", "view"\)/)
  assert.match(palette, /hasCapability\(routeCapabilities, "procurement", "view"\)/)
  assert.match(palette, /canAccessDepartment\("booking"\)/)
  assert.match(palette, /canAccessDepartment\("inventory"\)/)
  assert.match(palette, /canAccessDepartment\("procurement"\)/)
})

test("command layer searches canonical RLS-backed objects and opens canonical object routes", () => {
  assert.match(palette, /from\("reservations"\)/)
  assert.match(palette, /from\("rooms"\)/)
  assert.match(palette, /from\("assets"\)/)
  assert.match(palette, /from\("procurement_requests"\)/)
  assert.match(palette, /href: `\/bookings\/reservations\/\$\{row\.id\}`/)
  assert.match(palette, /href: `\/bookings\/rooms\/\$\{row\.id\}`/)
  assert.match(palette, /href: `\/inventory\/\$\{row\.id\}`/)
  assert.match(palette, /href: `\/procurement\/requests\/\$\{row\.id\}`/)
})

test("command layer remains read-only and does not introduce privileged browser access", () => {
  assert.doesNotMatch(palette, /service_role/i)
  assert.doesNotMatch(palette, /\.insert\(/)
  assert.doesNotMatch(palette, /\.update\(/)
  assert.doesNotMatch(palette, /\.delete\(/)
  assert.doesNotMatch(palette, /raw_app_meta_data/)
  assert.doesNotMatch(palette, /raw_user_meta_data/)
})

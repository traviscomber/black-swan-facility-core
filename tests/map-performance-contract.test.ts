import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageUrl = new URL("../app/map/page.tsx", import.meta.url)

test("map startup is progressive and hidden overlays are lazy", async () => {
  const source = await readFile(pageUrl, "utf8")
  assert.doesNotMatch(source, /for\s*\([^)]*overlay[^)]*\)[\s\S]{0,300}await\s+loadOverlayGeoJson/)
  const readyIndex = source.indexOf("setLoading(false)")
  const visibleScheduleIndex = source.indexOf("overlayRows.filter((overlay) => overlay.is_visible !== false)")
  assert.ok(readyIndex >= 0, "base map must mark global loading complete")
  assert.ok(visibleScheduleIndex > readyIndex, "visible overlay scheduling must happen after base readiness")
  for (const status of ["idle", "loading", "ready", "error"]) assert.match(source, new RegExp(`"${status}"`))
  assert.match(source, /createOverlayLoadQueue\(\{ concurrency: 2 \}\)/)
  assert.match(source, /\[map-overlay-performance\]/)
})

test("map page no longer owns KMZ decompression or KML parsing", async () => {
  const source = await readFile(pageUrl, "utf8")
  assert.doesNotMatch(source, /JSZip|DOMParser|togeojson/i)
  assert.match(source, /loadOverlayGeoJson/)
})

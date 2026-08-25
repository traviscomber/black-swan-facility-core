import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageUrl = new URL("../app/map/page.tsx", import.meta.url)

test("map startup is progressive and hidden overlays are lazy", async () => {
  const source = await readFile(pageUrl, "utf8")
  assert.doesNotMatch(source, /for\s*\([^)]*overlay[^)]*\)[\s\S]{0,300}await\s+loadOverlayGeoJson/)
  assert.match(source, /filter\(\(overlay\) => overlay\.is_visible !== false\)/)
  assert.match(source, /setLoading\(false\)[\s\S]{0,1800}overlayRows\.filter/)
  for (const status of ["idle", "loading", "ready", "error"]) assert.match(source, new RegExp(`"${status}"`))
  assert.match(source, /createOverlayLoadQueue\(\{ concurrency: 2 \}\)/)
  assert.match(source, /\[map-overlay-performance\]/)
})

test("map page no longer owns KMZ decompression or KML parsing", async () => {
  const source = await readFile(pageUrl, "utf8")
  assert.doesNotMatch(source, /JSZip|DOMParser|togeojson/i)
  assert.match(source, /loadOverlayGeoJson/)
})

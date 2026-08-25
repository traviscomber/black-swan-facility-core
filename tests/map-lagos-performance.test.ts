import assert from "node:assert/strict"
import test from "node:test"
import JSZip from "jszip"
import { clearOverlayLoadCache, loadOverlayGeoJson } from "../lib/map/overlay-loader.ts"

function heavyFeatureCollection(count: number) {
  return {
    type: "FeatureCollection" as const,
    features: Array.from({ length: count }, (_, index) => ({
      type: "Feature" as const,
      geometry: { type: "Polygon", coordinates: [[[index, index], [index + 0.1, index], [index + 0.1, index + 0.1], [index, index]]] },
      properties: { name: `Lago ${index + 1}` },
    })),
  }
}

test("Lagos-like derived GeoJSON avoids KMZ work and reports a warm-cache hit", async () => {
  clearOverlayLoadCache()
  const geojson = heavyFeatureCollection(5000)
  let requests = 0
  const overlay = {
    id: "lagos",
    file_url: "https://example.test/lagos.kmz",
    file_type: "kmz",
    source_version: "lagos-v9",
    derived_geojson_url: "https://example.test/lagos-v9.geojson",
    derived_source_version: "lagos-v9",
  }
  const options = {
    fetchImpl: async () => {
      requests += 1
      return new Response(JSON.stringify(geojson), { status: 200, headers: { "content-type": "application/geo+json" } })
    },
  }

  const cold = await loadOverlayGeoJson(overlay, options)
  const warm = await loadOverlayGeoJson(overlay, options)

  assert.equal(cold.source, "derived")
  assert.equal(cold.timings.unzipMs, 0)
  assert.equal(cold.timings.featureCount, 5000)
  assert.equal(cold.cacheHit, false)
  assert.equal(warm.cacheHit, true)
  assert.equal(requests, 1)
})

test("Lagos-like KMZ fallback reports bytes, unzip and feature count", async () => {
  clearOverlayLoadCache()
  const zip = new JSZip()
  zip.file("lagos.kml", "<kml><Document><name>Lagos</name></Document></kml>")
  const bytes = await zip.generateAsync({ type: "uint8array" })
  const geojson = heavyFeatureCollection(2500)
  let clock = 0

  const result = await loadOverlayGeoJson({
    id: "lagos-fallback",
    file_url: "https://example.test/lagos.kmz",
    file_type: "kmz",
    source_version: "v1",
  }, {
    fetchImpl: async () => new Response(bytes, { status: 200 }),
    parseKmlText: () => geojson,
    now: () => ++clock,
  })

  assert.equal(result.source, "kmz")
  assert.equal(result.timings.byteSize, bytes.byteLength)
  assert.equal(result.timings.featureCount, 2500)
  assert.ok(result.timings.unzipMs > 0)
  assert.equal(result.cacheHit, false)
})

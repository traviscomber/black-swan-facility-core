import assert from "node:assert/strict"
import test from "node:test"
import JSZip from "jszip"
import { clearOverlayLoadCache, loadOverlayGeoJson } from "../lib/map/overlay-loader.ts"

const emptyCollection = { type: "FeatureCollection" as const, features: [] }

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

test("prefers a version-matched derived GeoJSON URL", async () => {
  clearOverlayLoadCache()
  const requests: string[] = []
  const result = await loadOverlayGeoJson({ id: "overlay-1", file_url: "https://example.test/source.kmz", file_type: "kmz", source_version: "v1", derived_geojson_url: "https://example.test/runtime-v1.geojson", derived_source_version: "v1" }, {
    fetchImpl: async (url) => {
      requests.push(String(url))
      return new Response(JSON.stringify(emptyCollection), { status: 200, headers: { "content-type": "application/geo+json" } })
    },
  })
  assert.equal(result.source, "derived")
  assert.deepEqual(requests, ["https://example.test/runtime-v1.geojson"])
})

test("falls back to KMZ and extracts the first KML entry", async () => {
  clearOverlayLoadCache()
  const zip = new JSZip()
  zip.file("doc.kml", "<kml><Document/></kml>")
  const bytes = await zip.generateAsync({ type: "uint8array" })
  let parsed = ""
  const result = await loadOverlayGeoJson({ id: "overlay-2", file_url: "https://example.test/source.kmz", file_type: "kmz", source_version: "v1" }, {
    fetchImpl: async () => new Response(asArrayBuffer(bytes), { status: 200 }),
    parseKmlText: (text) => { parsed = text; return emptyCollection },
  })
  assert.equal(result.source, "kmz")
  assert.match(parsed, /Document/)
})

test("deduplicates concurrent requests for the same overlay version", async () => {
  clearOverlayLoadCache()
  let requests = 0
  const overlay = { id: "overlay-3", file_url: "https://example.test/source.kml", file_type: "kml", source_version: "v1" }
  const options = {
    fetchImpl: async () => { requests += 1; return new Response("<kml/>", { status: 200 }) },
    parseKmlText: () => emptyCollection,
  }
  await Promise.all([loadOverlayGeoJson(overlay, options), loadOverlayGeoJson(overlay, options)])
  assert.equal(requests, 1)
})

test("source version changes invalidate the in-session cache key", async () => {
  clearOverlayLoadCache()
  let requests = 0
  const options = {
    fetchImpl: async () => { requests += 1; return new Response("<kml/>", { status: 200 }) },
    parseKmlText: () => emptyCollection,
  }
  await loadOverlayGeoJson({ id: "overlay-4", file_url: "https://example.test/a.kml", file_type: "kml", source_version: "v1" }, options)
  await loadOverlayGeoJson({ id: "overlay-4", file_url: "https://example.test/a.kml", file_type: "kml", source_version: "v2" }, options)
  assert.equal(requests, 2)
})

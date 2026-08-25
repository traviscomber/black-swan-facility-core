import assert from "node:assert/strict"
import test from "node:test"
import JSZip from "jszip"
import { deriveOverlay, needsDerivative } from "../lib/map/server/derive-overlay.mjs"

const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Punto</name><Point><coordinates>-73.15,-39.82,0</coordinates></Point></Placemark></Document></kml>`

test("derivative generation skips matching source versions", () => {
  assert.equal(needsDerivative({ sourceVersion: "v1", derivedSourceVersion: "v1" }), false)
  assert.equal(needsDerivative({ sourceVersion: "v2", derivedSourceVersion: "v1" }), true)
  assert.equal(needsDerivative({ sourceVersion: "v1", derivedSourceVersion: null }), true)
})

test("server converter turns KML into GeoJSON", async () => {
  const result = await deriveOverlay({
    sourceUrl: "https://example.test/source.kml",
    fileType: "kml",
    sourceVersion: "v1",
    fetchImpl: async () => new Response(kml, { status: 200 }),
  })
  const geojson = JSON.parse(result.geojsonText)
  assert.equal(geojson.type, "FeatureCollection")
  assert.equal(result.featureCount, 1)
})

test("server converter extracts KML from KMZ", async () => {
  const zip = new JSZip()
  zip.file("doc.kml", kml)
  const bytes = await zip.generateAsync({ type: "uint8array" })
  const result = await deriveOverlay({
    sourceUrl: "https://example.test/source.kmz",
    fileType: "kmz",
    sourceVersion: "v2",
    fetchImpl: async () => new Response(bytes, { status: 200 }),
  })
  assert.equal(result.featureCount, 1)
  assert.equal(result.sourceVersion, "v2")
})

test("server converter rejects KMZ without KML", async () => {
  const zip = new JSZip()
  zip.file("readme.txt", "not kml")
  const bytes = await zip.generateAsync({ type: "uint8array" })
  await assert.rejects(() => deriveOverlay({
    sourceUrl: "https://example.test/broken.kmz",
    fileType: "kmz",
    sourceVersion: "v3",
    fetchImpl: async () => new Response(bytes, { status: 200 }),
  }), /no contiene un archivo KML/)
})

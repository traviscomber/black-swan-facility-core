import assert from "node:assert/strict"
import test from "node:test"
import { farmMapRectToLatLngs, imagePointToLatLng, PROVISIONAL_GEOREF } from "../lib/orchard/farm-map-provisional-georef.ts"

test("provisional Farm Map georeference preserves observed anchor landmarks", () => {
  assert.equal(PROVISIONAL_GEOREF.status, "provisional")
  for (const anchor of PROVISIONAL_GEOREF.anchors) {
    const projected = imagePointToLatLng(anchor.image)
    assert.ok(Math.abs(projected.lat - anchor.geo.lat) < 1e-10)
    assert.ok(Math.abs(projected.lng - anchor.geo.lng) < 1e-10)
  }
})

test("farm-map rectangles become finite geographic polygons without rewriting source percentages", () => {
  const polygon = farmMapRectToLatLngs({ xPct: 50, yPct: 50, widthPct: 9, heightPct: 13, rotationDeg: 12 })
  assert.equal(polygon.length, 4)
  for (const [lat, lng] of polygon) {
    assert.ok(Number.isFinite(lat))
    assert.ok(Number.isFinite(lng))
    assert.ok(lat < -39.69 && lat > -39.71)
    assert.ok(lng < -73.19 && lng > -73.22)
  }
})

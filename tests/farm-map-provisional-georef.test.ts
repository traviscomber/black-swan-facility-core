import assert from "node:assert/strict"
import test from "node:test"
import { farmMapBedPolygons } from "../lib/orchard/farm-map-bed-layout.ts"
import { farmMapRectToLatLngs, imagePointToLatLng, latLngToFarmMapPercent, latLngToImagePoint, PROVISIONAL_GEOREF } from "../lib/orchard/farm-map-provisional-georef.ts"

test("provisional Farm Map georeference preserves observed anchor landmarks", () => {
  assert.equal(PROVISIONAL_GEOREF.status, "provisional")
  for (const anchor of PROVISIONAL_GEOREF.anchors) {
    const projected = imagePointToLatLng(anchor.image)
    assert.ok(Math.abs(projected.lat - anchor.geo.lat) < 1e-10)
    assert.ok(Math.abs(projected.lng - anchor.geo.lng) < 1e-10)
    const inverse = latLngToImagePoint(anchor.geo)
    assert.ok(Math.abs(inverse.x - anchor.image.x) < 1e-8)
    assert.ok(Math.abs(inverse.y - anchor.image.y) < 1e-8)
  }
})

test("provisional georeference round-trips arbitrary Farm Map positions", () => {
  const image = { x: 153.25, y: 241.5 }
  const geo = imagePointToLatLng(image)
  const inverse = latLngToImagePoint(geo)
  assert.ok(Math.abs(inverse.x - image.x) < 1e-8)
  assert.ok(Math.abs(inverse.y - image.y) < 1e-8)
  const pct = latLngToFarmMapPercent(geo)
  assert.ok(Math.abs(pct.xPct - (image.x / PROVISIONAL_GEOREF.imageWidth) * 100) < 1e-8)
  assert.ok(Math.abs(pct.yPct - (image.y / PROVISIONAL_GEOREF.imageHeight) * 100) < 1e-8)
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

test("farm-map bed layout preserves ten canonical beds and their path gaps", () => {
  const field: [number, number][] = [[0, 0], [0, 10], [10, 10], [10, 0]]
  const beds = farmMapBedPolygons(field, { bedCount: 10, bedWidthM: 0.76, pathWidthM: 0.4 })

  assert.equal(beds.length, 10)
  assert.deepEqual(beds[0][0], [0, 0])
  assert.ok(Math.abs(beds[9][1][1] - 10) < 1e-10)
  assert.ok(beds[1][0][1] > beds[0][1][1])
  assert.ok(beds.every((bed) => bed.length === 4 && bed.flat().every(Number.isFinite)))
})

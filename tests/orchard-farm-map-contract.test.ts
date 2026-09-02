import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Orchard Farm Map reuses the existing GIS stack and keeps Crop Map separate", async () => {
  const farmMap = await readFile("app/orchard/farm-map/page.tsx", "utf8")
  const sidebar = await readFile("components/orchard/orchard-sidebar.tsx", "utf8")

  assert.match(farmMap, /loadOverlayGeoJson/)
  assert.match(farmMap, /gis_overlays/)
  assert.match(farmMap, /World_Imagery/)
  assert.match(farmMap, /MAPLIBRE_VERSION/)
  assert.match(farmMap, /\/orchard\/crop-map\/overview/)
  assert.match(farmMap, /geometryNote/)
  assert.match(sidebar, /\/orchard\/farm-map/)
  assert.match(sidebar, /Mapa de la granja/)

  assert.doesNotMatch(farmMap, /google\.maps|maps\.googleapis\.com/i)
  assert.doesNotMatch(farmMap, /planned_bed_m.*latitude|planned_bed_m.*longitude/)
})

test("Farm Map defaults to the real Corcovado GIS layers without inventing bed geometry", async () => {
  const farmMap = await readFile("app/orchard/farm-map/page.tsx", "utf8")
  assert.match(farmMap, /CORCOVADO_CENTER/)
  assert.match(farmMap, /collectCoordinates/)
  assert.match(farmMap, /fitBounds/)
  assert.match(farmMap, /Real GIS overlays|Capas GIS reales/)
  assert.match(farmMap, /until their surveyed geometry is available|hasta contar con su geometría levantada/)
})

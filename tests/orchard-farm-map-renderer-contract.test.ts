import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Orchard Farm Map uses Leaflet raster rendering with real GIS overlays", async () => {
  const source = await readFile("app/orchard/farm-map/page.tsx", "utf8")

  assert.match(source, /leaflet@1\.9\.4\/dist\/leaflet\.css/)
  assert.match(source, /import\(['\"]leaflet['\"]\)/)
  assert.match(source, /World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/)
  assert.match(source, /loadOverlayGeoJson/)
  assert.match(source, /gis_overlays/)
  assert.match(source, /geoJSON/)
  assert.doesNotMatch(source, /maplibre-gl/)
  assert.doesNotMatch(source, /new maplibregl\.Map/)
})

import { createRequire } from "node:module"
import JSZip from "jszip"
import toGeoJSONModule from "@mapbox/togeojson"

const require = createRequire(import.meta.url)
const requireFromToGeoJSON = createRequire(require.resolve("@mapbox/togeojson"))
const { DOMParser } = requireFromToGeoJSON("@xmldom/xmldom")
const kmlToGeoJSON = toGeoJSONModule?.kml ?? toGeoJSONModule?.default?.kml

export function needsDerivative({ sourceVersion, derivedSourceVersion }) {
  return !sourceVersion || sourceVersion !== derivedSourceVersion
}

export async function deriveOverlay({ sourceUrl, fileType, sourceVersion, fetchImpl = fetch }) {
  const response = await fetchImpl(sourceUrl)
  if (!response.ok) throw new Error(`Unable to fetch GIS source: HTTP ${response.status}`)

  const isKmz = String(fileType ?? "").toLowerCase() === "kmz" || sourceUrl.toLowerCase().includes(".kmz")
  let kmlText
  if (isKmz) {
    const archive = await JSZip.loadAsync(await response.arrayBuffer())
    const kmlEntry = Object.values(archive.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"))
    if (!kmlEntry) throw new Error("El KMZ no contiene un archivo KML")
    kmlText = await kmlEntry.async("text")
  } else {
    kmlText = await response.text()
  }

  if (typeof DOMParser !== "function") throw new Error("Parser XML server-side no disponible")
  const document = new DOMParser().parseFromString(kmlText, "text/xml")
  if (!document || document.getElementsByTagName("parsererror").length > 0) throw new Error("KML inválido")
  if (typeof kmlToGeoJSON !== "function") throw new Error("Conversor KML a GeoJSON no disponible")
  const geojson = kmlToGeoJSON(document)
  if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) throw new Error("No fue posible convertir KML a GeoJSON")

  return {
    geojsonText: JSON.stringify(geojson),
    featureCount: geojson.features.length,
    sourceVersion,
  }
}

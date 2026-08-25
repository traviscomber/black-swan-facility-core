import JSZip from "jszip"
import domParserModule from "dom-parser"
import * as toGeoJSON from "@mapbox/togeojson"

const DomParser = domParserModule?.DomParser ?? domParserModule?.default ?? domParserModule

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

  if (typeof DomParser !== "function") throw new Error("Parser XML server-side no disponible")
  const parser = new DomParser()
  const document = parser.parseFromString(kmlText)
  if (!document) throw new Error("KML inválido")
  const geojson = toGeoJSON.kml(document)
  if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) throw new Error("No fue posible convertir KML a GeoJSON")

  return {
    geojsonText: JSON.stringify(geojson),
    featureCount: geojson.features.length,
    sourceVersion,
  }
}

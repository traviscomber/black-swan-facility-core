import JSZip from "jszip"
import * as toGeoJSON from "@mapbox/togeojson"

export type GeoJsonProperties = Record<string, string | number | boolean | null | undefined>
export type GeoJsonFeature = { type: "Feature"; geometry?: { type?: string; coordinates?: unknown }; properties?: GeoJsonProperties | null }
export type GeoJsonFeatureCollection = { type: "FeatureCollection"; features: GeoJsonFeature[] }

export type OverlayDescriptor = {
  id: string
  file_url: string
  file_type: string | null
  source_version: string
  derived_geojson_url?: string | null
  derived_source_version?: string | null
}

export type OverlayLoadTimings = {
  totalMs: number
  networkMs: number
  unzipMs: number
  parseMs: number
  byteSize: number | null
  featureCount: number
}

export type OverlayLoadResult = {
  geojson: GeoJsonFeatureCollection
  source: "derived" | "kmz" | "kml"
  timings: OverlayLoadTimings
}

type LoadOptions = {
  fetchImpl?: typeof fetch
  now?: () => number
  parseKmlText?: (text: string) => GeoJsonFeatureCollection
}

const inflight = new Map<string, Promise<OverlayLoadResult>>()

export function clearOverlayLoadCache(): void {
  inflight.clear()
}

export function defaultParseKmlText(text: string): GeoJsonFeatureCollection {
  if (typeof DOMParser === "undefined") throw new Error("DOMParser no disponible para convertir KML")
  const document = new DOMParser().parseFromString(text, "text/xml")
  if (document.querySelector("parsererror")) throw new Error("KML inválido")
  return toGeoJSON.kml(document) as unknown as GeoJsonFeatureCollection
}

export async function loadOverlayGeoJson(overlay: OverlayDescriptor, options: LoadOptions = {}): Promise<OverlayLoadResult> {
  const key = `${overlay.id}:${overlay.source_version}`
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = loadOverlayGeoJsonUncached(overlay, options).catch((error) => {
    inflight.delete(key)
    throw error
  })
  inflight.set(key, promise)
  return promise
}

async function loadOverlayGeoJsonUncached(overlay: OverlayDescriptor, options: LoadOptions): Promise<OverlayLoadResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => performance.now())
  const parseKmlText = options.parseKmlText ?? defaultParseKmlText
  const totalStart = now()

  if (overlay.derived_geojson_url && overlay.derived_source_version === overlay.source_version) {
    try {
      const networkStart = now()
      const response = await fetchImpl(overlay.derived_geojson_url)
      const networkMs = now() - networkStart
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      const parseStart = now()
      const geojson = JSON.parse(text) as GeoJsonFeatureCollection
      const parseMs = now() - parseStart
      if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) throw new Error("GeoJSON derivado inválido")
      return {
        geojson,
        source: "derived",
        timings: {
          totalMs: now() - totalStart,
          networkMs,
          unzipMs: 0,
          parseMs,
          byteSize: contentLength(response) ?? byteLength(text),
          featureCount: geojson.features.length,
        },
      }
    } catch {
      // Controlled fallback: the original KMZ/KML remains authoritative.
    }
  }

  const networkStart = now()
  const response = await fetchImpl(overlay.file_url)
  const networkMs = now() - networkStart
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const isKmz = (overlay.file_type ?? "").toLowerCase() === "kmz" || overlay.file_url.toLowerCase().includes(".kmz")
  let kmlText: string
  let unzipMs = 0
  let byteSize = contentLength(response)

  if (isKmz) {
    const bytes = await response.arrayBuffer()
    byteSize ??= bytes.byteLength
    const unzipStart = now()
    const archive = await JSZip.loadAsync(bytes)
    const kmlEntry = Object.values(archive.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"))
    if (!kmlEntry) throw new Error("El KMZ no contiene un archivo KML")
    kmlText = await kmlEntry.async("text")
    unzipMs = now() - unzipStart
  } else {
    kmlText = await response.text()
    byteSize ??= byteLength(kmlText)
  }

  const parseStart = now()
  const geojson = parseKmlText(kmlText)
  const parseMs = now() - parseStart
  return {
    geojson,
    source: isKmz ? "kmz" : "kml",
    timings: {
      totalMs: now() - totalStart,
      networkMs,
      unzipMs,
      parseMs,
      byteSize,
      featureCount: geojson.features.length,
    },
  }
}

function contentLength(response: Response): number | null {
  const value = response.headers.get("content-length")
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

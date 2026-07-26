"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import JSZip from "jszip"
import * as toGeoJSON from "@mapbox/togeojson"
import { CheckCircle2, Layers, Loader2, MapPin, Satellite } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

type InfrastructureItem = {
  id: string
  name: string
  category: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  status: string | null
}

type InfrastructureConnection = {
  id: string
  from_infrastructure_id: string
  to_infrastructure_id: string
  connection_type: string | null
}

type GisOverlay = {
  id: string
  name: string
  file_url: string
  file_type: string | null
  is_visible: boolean | null
  opacity: number | string | null
}

type GeoJsonFeatureCollection = {
  type: "FeatureCollection"
  features: Array<Record<string, unknown>>
}

type RuntimeMapLibre = {
  Map: new (options: Record<string, unknown>) => RuntimeMap
  NavigationControl: new (options?: Record<string, unknown>) => unknown
  FullscreenControl: new () => unknown
  Popup: new (options?: Record<string, unknown>) => RuntimePopup
}

type RuntimePopup = {
  setLngLat: (coordinates: [number, number]) => RuntimePopup
  setHTML: (html: string) => RuntimePopup
  addTo: (map: RuntimeMap) => RuntimePopup
}

type RuntimeMap = {
  on: (event: string, layerOrHandler: string | ((event?: RuntimeMapEvent) => void), handler?: (event: RuntimeMapEvent) => void) => void
  addControl: (control: unknown, position?: string) => void
  addSource: (id: string, source: Record<string, unknown>) => void
  addLayer: (layer: Record<string, unknown>) => void
  getLayer: (id: string) => unknown
  setLayoutProperty: (id: string, property: string, value: unknown) => void
  fitBounds: (bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void
  remove: () => void
}

type RuntimeMapEvent = {
  features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }>
}

const MAPLIBRE_VERSION = "6.0.0"
const MAPLIBRE_MODULE = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`
const COLORS = ["#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#4d7c0f"]

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<RuntimeMap | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const [infrastructure, setInfrastructure] = useState<InfrastructureItem[]>([])
  const [connections, setConnections] = useState<InfrastructureConnection[]>([])
  const [overlays, setOverlays] = useState<GisOverlay[]>([])
  const [visibleOverlays, setVisibleOverlays] = useState<Set<string>>(new Set())
  const [featureCounts, setFeatureCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[data-maplibre-map="true"]')
    if (existing) return
    const stylesheet = document.createElement("link")
    stylesheet.rel = "stylesheet"
    stylesheet.href = MAPLIBRE_CSS
    stylesheet.dataset.maplibreMap = "true"
    document.head.appendChild(stylesheet)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadMap() {
      setLoading(true)
      setError(null)
      try {
        const [infrastructureResult, connectionsResult, overlaysResult] = await Promise.all([
          supabase.from("infrastructure_plans").select("id,name,category,description,latitude,longitude,status").order("name"),
          supabase.from("infrastructure_connections").select("id,from_infrastructure_id,to_infrastructure_id,connection_type"),
          supabase.from("gis_overlays").select("id,name,file_url,file_type,is_visible,opacity").order("layer_order").order("created_at"),
        ])

        const firstError = infrastructureResult.error || connectionsResult.error || overlaysResult.error
        if (firstError) throw firstError
        if (cancelled || !mapContainerRef.current) return

        const infrastructureRows = (infrastructureResult.data ?? []) as InfrastructureItem[]
        const connectionRows = (connectionsResult.data ?? []) as InfrastructureConnection[]
        const overlayRows = (overlaysResult.data ?? []) as GisOverlay[]
        setInfrastructure(infrastructureRows)
        setConnections(connectionRows)
        setOverlays(overlayRows)
        setVisibleOverlays(new Set(overlayRows.filter((layer) => layer.is_visible !== false).map((layer) => layer.id)))

        const dynamicImport = new Function("moduleUrl", "return import(moduleUrl)") as (moduleUrl: string) => Promise<RuntimeMapLibre>
        const maplibregl = await dynamicImport(MAPLIBRE_MODULE)
        if (cancelled || !mapContainerRef.current) return

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          center: [-73.15, -39.82],
          zoom: 12,
          pitch: 0,
          maxZoom: 19,
          attributionControl: true,
          style: {
            version: 8,
            sources: {
              satellite: {
                type: "raster",
                tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
                tileSize: 256,
                maxzoom: 19,
                attribution: "Imagery © Esri and contributors",
              },
            },
            layers: [{ id: "satellite", type: "raster", source: "satellite" }],
          },
        })
        mapRef.current = map
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")
        map.addControl(new maplibregl.FullscreenControl(), "top-right")

        map.on("load", async () => {
          const pointFeatures = infrastructureRows
            .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
            .map((item) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [Number(item.longitude), Number(item.latitude)] },
              properties: { id: item.id, name: item.name, category: item.category ?? "Sin categoría", status: item.status ?? "Sin estado" },
            }))

          map.addSource("infrastructure", { type: "geojson", data: { type: "FeatureCollection", features: pointFeatures } })
          map.addLayer({
            id: "infrastructure-points",
            type: "circle",
            source: "infrastructure",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 9],
              "circle-color": "#0f766e",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.95,
            },
          })

          const byId = new Map(infrastructureRows.map((item) => [item.id, item]))
          const connectionFeatures = connectionRows.flatMap((connection) => {
            const from = byId.get(connection.from_infrastructure_id)
            const to = byId.get(connection.to_infrastructure_id)
            if (!from || !to || !Number.isFinite(from.latitude) || !Number.isFinite(from.longitude) || !Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)) return []
            return [{
              type: "Feature",
              geometry: { type: "LineString", coordinates: [[Number(from.longitude), Number(from.latitude)], [Number(to.longitude), Number(to.latitude)]] },
              properties: { type: connection.connection_type ?? "Conexión" },
            }]
          })

          map.addSource("connections", { type: "geojson", data: { type: "FeatureCollection", features: connectionFeatures } })
          map.addLayer({ id: "connections-lines", type: "line", source: "connections", paint: { "line-color": "#f8fafc", "line-width": 2.5, "line-opacity": 0.9, "line-dasharray": [2, 1.5] } })

          map.on("click", "infrastructure-points", (event) => {
            const feature = event.features?.[0]
            const coordinates = feature?.geometry?.coordinates
            if (!coordinates) return
            const properties = feature.properties ?? {}
            new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
              .setLngLat(coordinates)
              .setHTML(`<strong>${escapeHtml(String(properties.name ?? "Punto"))}</strong><br><span>${escapeHtml(String(properties.category ?? ""))}</span><br><small>${escapeHtml(String(properties.status ?? ""))}</small>`)
              .addTo(map)
          })

          const coordinates = pointFeatures.map((feature) => feature.geometry.coordinates as [number, number])
          if (coordinates.length > 0) map.fitBounds(calculateBounds(coordinates), { padding: 45, maxZoom: 15, duration: 0 })

          for (const [index, overlay] of overlayRows.entries()) {
            try {
              const geojson = await loadOverlayGeoJson(overlay)
              if (cancelled) return
              setFeatureCounts((current) => ({ ...current, [overlay.id]: geojson.features.length }))
              map.addSource(`overlay-${overlay.id}`, { type: "geojson", data: geojson })
              const color = COLORS[index % COLORS.length]
              const opacity = Math.max(0.15, Math.min(1, Number(overlay.opacity ?? 0.75)))
              map.addLayer({ id: `overlay-fill-${overlay.id}`, type: "fill", source: `overlay-${overlay.id}`, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": color, "fill-opacity": opacity * 0.28 } })
              map.addLayer({ id: `overlay-line-${overlay.id}`, type: "line", source: `overlay-${overlay.id}`, filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], paint: { "line-color": color, "line-width": 2, "line-opacity": opacity } })
              map.addLayer({ id: `overlay-point-${overlay.id}`, type: "circle", source: `overlay-${overlay.id}`, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": color, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.25, "circle-opacity": opacity } })
              const visibility = overlay.is_visible === false ? "none" : "visible"
              for (const layerType of ["fill", "line", "point"]) map.setLayoutProperty(`overlay-${layerType}-${overlay.id}`, "visibility", visibility)
            } catch (overlayError) {
              console.error(`No fue posible cargar ${overlay.name}`, overlayError)
              setFeatureCounts((current) => ({ ...current, [overlay.id]: 0 }))
            }
          }
        })

        map.on("error", () => setError((current) => current ?? "MapLibre informó un error al renderizar una fuente o capa."))
      } catch (loadError) {
        console.error("No fue posible iniciar el mapa MapLibre", loadError)
        setError(loadError instanceof Error ? loadError.message : "No fue posible iniciar el mapa operativo.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadMap()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [supabase])

  const toggleOverlay = (id: string) => {
    setVisibleOverlays((current) => {
      const next = new Set(current)
      const visible = !next.has(id)
      if (visible) next.add(id)
      else next.delete(id)
      const map = mapRef.current
      if (map) {
        for (const layerType of ["fill", "line", "point"]) {
          const layerId = `overlay-${layerType}-${id}`
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none")
        }
      }
      return next
    })
  }

  return (
    <AppLayout>
      <PageHeader title="Mapa operativo y capas GIS" description="Infraestructura, conexiones técnicas y capas KMZ del Fundo Corcovado sobre imagen satelital." />

      <div className="space-y-5 p-4 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={MapPin} label="Puntos GIS" value={infrastructure.length.toLocaleString("es-CL")} />
          <Metric icon={Layers} label="Conexiones" value={connections.length.toLocaleString("es-CL")} />
          <Metric icon={Satellite} label="Capas KMZ" value={overlays.length.toLocaleString("es-CL")} />
          <Metric icon={CheckCircle2} label="Motor cartográfico" value={`MapLibre ${MAPLIBRE_VERSION}`} />
        </div>

        {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden">
            <CardContent className="relative p-0">
              <div ref={mapContainerRef} className="h-[68vh] min-h-[520px] w-full bg-muted" />
              {loading && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando mapa operativo…</div>}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Capas KMZ</CardTitle><CardDescription>Active u oculte cada capa para revisar su información territorial.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {overlays.length === 0 ? <p className="text-sm text-muted-foreground">No hay capas registradas.</p> : overlays.map((overlay) => {
                  const visible = visibleOverlays.has(overlay.id)
                  return <button key={overlay.id} type="button" onClick={() => toggleOverlay(overlay.id)} className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/40">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{overlay.name}</p><p className="text-xs text-muted-foreground">{featureCounts[overlay.id] == null ? "Procesando…" : `${featureCounts[overlay.id].toLocaleString("es-CL")} elementos`}</p></div>
                    <Badge variant={visible ? "default" : "outline"}>{visible ? "Visible" : "Oculta"}</Badge>
                  </button>
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Uso operativo</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Imagen satelital de alta resolución.</p>
                <p>Puntos administrativos y conexiones técnicas.</p>
                <p>Capas KMZ procesadas como geometrías GIS.</p>
                <p>Controles de zoom, inclinación y pantalla completa.</p>
                <Badge variant="outline">Fuente de datos sin cambios</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div></CardContent></Card>
}

async function loadOverlayGeoJson(overlay: GisOverlay): Promise<GeoJsonFeatureCollection> {
  const response = await fetch(overlay.file_url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  let kmlText: string
  if ((overlay.file_type ?? "").toLowerCase() === "kmz" || overlay.file_url.toLowerCase().includes(".kmz")) {
    const archive = await JSZip.loadAsync(await response.arrayBuffer())
    const kmlEntry = Object.values(archive.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"))
    if (!kmlEntry) throw new Error("El KMZ no contiene un archivo KML")
    kmlText = await kmlEntry.async("text")
  } else kmlText = await response.text()

  const document = new DOMParser().parseFromString(kmlText, "text/xml")
  if (document.querySelector("parsererror")) throw new Error("KML inválido")
  return toGeoJSON.kml(document) as unknown as GeoJsonFeatureCollection
}

function calculateBounds(coordinates: [number, number][]): [[number, number], [number, number]] {
  let minLng = coordinates[0][0]
  let maxLng = coordinates[0][0]
  let minLat = coordinates[0][1]
  let maxLat = coordinates[0][1]
  coordinates.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  })
  return [[minLng, minLat], [maxLng, maxLat]]
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character)
}

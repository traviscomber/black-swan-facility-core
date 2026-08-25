"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Layers, Loader2, LocateFixed, MapPin, Satellite, Search } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loadOverlayGeoJson, type GeoJsonFeatureCollection } from "@/lib/map/overlay-loader"
import { createOverlayLoadQueue, type OverlayRuntimeState } from "@/lib/map/overlay-runtime"
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

type OverlayMetadata = Record<string, unknown> & { display_color?: string }

type GisOverlay = {
  id: string
  name: string
  file_url: string
  file_type: string | null
  is_visible: boolean | null
  opacity: number | string | null
  metadata: OverlayMetadata | null
  updated_at?: string | null
  derived_geojson_url?: string | null
  derived_source_version?: string | null
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
  setPaintProperty: (id: string, property: string, value: unknown) => void
  fitBounds: (bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void
  flyTo: (options: Record<string, unknown>) => void
  remove: () => void
}

type RuntimeMapEvent = { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }> }

const MAPLIBRE_VERSION = "6.0.0"
const MAPLIBRE_MODULE = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`
const FALLBACK_COLORS = ["#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#4d7c0f"]
const CATEGORY_ORDER = ["internet", "water", "electricity", "ports", "cattle", "food_storage", "uncategorized"]

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<RuntimeMap | null>(null)
  const maplibreRef = useRef<RuntimeMapLibre | null>(null)
  const overlayLoadersRef = useRef<Map<string, () => Promise<void>>>(new Map())
  const visibleOverlaysRef = useRef<Set<string>>(new Set())
  const queueRef = useRef(createOverlayLoadQueue({ concurrency: 2 }))
  const supabase = useMemo(() => createClient(), [])
  const [infrastructure, setInfrastructure] = useState<InfrastructureItem[]>([])
  const [connections, setConnections] = useState<InfrastructureConnection[]>([])
  const [overlays, setOverlays] = useState<GisOverlay[]>([])
  const [visibleOverlays, setVisibleOverlays] = useState<Set<string>>(new Set())
  const [overlayStates, setOverlayStates] = useState<Record<string, OverlayRuntimeState>>({})
  const [overlayColors, setOverlayColors] = useState<Record<string, string>>({})
  const [savingColors, setSavingColors] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(() => Array.from(new Set(infrastructure.map((item) => normalizeCategory(item.category)))).sort(compareCategories), [infrastructure])
  const statuses = useMemo(() => Array.from(new Set(infrastructure.map((item) => item.status ?? "unknown"))).sort(), [infrastructure])
  const filteredPoints = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("es")
    return infrastructure
      .filter((item) => {
        const category = normalizeCategory(item.category)
        const matchesSearch = !query || [item.name, item.description, categoryLabel(category), statusLabel(item.status ?? "unknown")].some((value) => value?.toLocaleLowerCase("es").includes(query))
        return matchesSearch && (categoryFilter === "all" || category === categoryFilter) && (statusFilter === "all" || (item.status ?? "unknown") === statusFilter)
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
  }, [infrastructure, searchTerm, categoryFilter, statusFilter])
  const groupedPoints = useMemo(() => {
    const groups = new Map<string, InfrastructureItem[]>()
    filteredPoints.forEach((point) => {
      const category = normalizeCategory(point.category)
      const existing = groups.get(category) ?? []
      existing.push(point)
      groups.set(category, existing)
    })
    return Array.from(groups.entries()).sort(([a], [b]) => compareCategories(a, b))
  }, [filteredPoints])

  useEffect(() => {
    if (document.querySelector('link[data-maplibre-map="true"]')) return
    const stylesheet = document.createElement("link")
    stylesheet.rel = "stylesheet"
    stylesheet.href = MAPLIBRE_CSS
    stylesheet.dataset.maplibreMap = "true"
    document.head.appendChild(stylesheet)
  }, [])

  useEffect(() => {
    let cancelled = false
    overlayLoadersRef.current.clear()

    async function loadMap() {
      setLoading(true)
      setError(null)
      try {
        const [infrastructureResult, connectionsResult, overlayRows] = await Promise.all([
          supabase.from("infrastructure_plans").select("id,name,category,description,latitude,longitude,status").order("name"),
          supabase.from("infrastructure_connections").select("id,from_infrastructure_id,to_infrastructure_id,connection_type"),
          fetchOverlayRows(supabase),
        ])
        const firstError = infrastructureResult.error || connectionsResult.error
        if (firstError) throw firstError
        if (cancelled || !mapContainerRef.current) return

        const infrastructureRows = (infrastructureResult.data ?? []) as InfrastructureItem[]
        const connectionRows = (connectionsResult.data ?? []) as InfrastructureConnection[]
        setInfrastructure(infrastructureRows)
        setConnections(connectionRows)
        setOverlays(overlayRows)
        const initiallyVisible = new Set(overlayRows.filter((layer) => layer.is_visible !== false).map((layer) => layer.id))
        visibleOverlaysRef.current = initiallyVisible
        setVisibleOverlays(initiallyVisible)
        setOverlayStates(Object.fromEntries(overlayRows.map((overlay) => [overlay.id, { status: "idle" } satisfies OverlayRuntimeState])))

        const dynamicImport = new Function("moduleUrl", "return import(moduleUrl)") as (moduleUrl: string) => Promise<RuntimeMapLibre>
        const maplibregl = await dynamicImport(MAPLIBRE_MODULE)
        maplibreRef.current = maplibregl
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
            sources: { satellite: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: "Imagery © Esri and contributors" } },
            layers: [{ id: "satellite", type: "raster", source: "satellite" }],
          },
        })
        mapRef.current = map
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")
        map.addControl(new maplibregl.FullscreenControl(), "top-right")

        map.on("load", async () => {
          const pointFeatures = infrastructureRows.filter(hasCoordinates).map((item) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [Number(item.longitude), Number(item.latitude)] },
            properties: { id: item.id, name: item.name, category: normalizeCategory(item.category), status: item.status ?? "Sin estado" },
          }))
          map.addSource("infrastructure", { type: "geojson", data: { type: "FeatureCollection", features: pointFeatures } })
          map.addLayer({ id: "infrastructure-points", type: "circle", source: "infrastructure", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 9], "circle-color": "#0f766e", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5, "circle-opacity": 0.95 } })

          const byId = new Map(infrastructureRows.map((item) => [item.id, item]))
          const connectionFeatures = connectionRows.flatMap((connection) => {
            const from = byId.get(connection.from_infrastructure_id)
            const to = byId.get(connection.to_infrastructure_id)
            if (!from || !to || !hasCoordinates(from) || !hasCoordinates(to)) return []
            return [{ type: "Feature", geometry: { type: "LineString", coordinates: [[Number(from.longitude), Number(from.latitude)], [Number(to.longitude), Number(to.latitude)]] }, properties: { type: connection.connection_type ?? "Conexión" } }]
          })
          map.addSource("connections", { type: "geojson", data: { type: "FeatureCollection", features: connectionFeatures } })
          map.addLayer({ id: "connections-lines", type: "line", source: "connections", paint: { "line-color": "#f8fafc", "line-width": 2.5, "line-opacity": 0.9, "line-dasharray": [2, 1.5] } })

          map.on("click", "infrastructure-points", (event) => {
            const feature = event.features?.[0]
            const coordinates = feature?.geometry?.coordinates
            if (!coordinates) return
            const properties = feature.properties ?? {}
            setSelectedPointId(String(properties.id ?? ""))
            new maplibregl.Popup({ closeButton: true, maxWidth: "320px" }).setLngLat(coordinates).setHTML(pointPopupHtml(properties)).addTo(map)
          })

          const coordinates = pointFeatures.map((feature) => feature.geometry.coordinates as [number, number])
          if (coordinates.length > 0) map.fitBounds(calculateBounds(coordinates), { padding: 45, maxZoom: 15, duration: 0 })

          if (!cancelled) setLoading(false)

          overlayRows.forEach((overlay, index) => {
            const loader = async () => {
              setOverlayStates((current) => ({ ...current, [overlay.id]: { status: "loading" } }))
              try {
                const result = await queueRef.current.run(() => loadOverlayGeoJson({
                  id: overlay.id,
                  file_url: overlay.file_url,
                  file_type: overlay.file_type,
                  source_version: overlay.updated_at ?? overlay.file_url,
                  derived_geojson_url: overlay.derived_geojson_url,
                  derived_source_version: overlay.derived_source_version,
                }))
                if (cancelled) return
                const fallbackColor = FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                const savedColor = validHexColor(overlay.metadata?.display_color) ? overlay.metadata.display_color : null
                const displayColor = savedColor ?? findNativeColor(result.geojson) ?? fallbackColor
                setOverlayColors((current) => ({ ...current, [overlay.id]: displayColor }))
                registerOverlayLayers(map, overlay, result.geojson, displayColor, visibleOverlaysRef.current.has(overlay.id))
                setOverlayStates((current) => ({ ...current, [overlay.id]: { status: "ready", featureCount: result.timings.featureCount, source: result.source, totalMs: result.timings.totalMs } }))
                if (process.env.NODE_ENV !== "production") console.info("[map-overlay-performance]", { overlayId: overlay.id, source: result.source, ...result.timings })
              } catch (overlayError) {
                console.error(`No fue posible cargar ${overlay.name}`, overlayError)
                setOverlayStates((current) => ({ ...current, [overlay.id]: { status: "error", error: overlayError instanceof Error ? overlayError.message : "Error de capa" } }))
              }
            }
            overlayLoadersRef.current.set(overlay.id, loader)
          })

          overlayRows.filter((overlay) => overlay.is_visible !== false).forEach((overlay) => {
            void overlayLoadersRef.current.get(overlay.id)?.()
          })
        })
        map.on("error", () => setError((current) => current ?? "MapLibre informó un error al renderizar una fuente o capa."))
      } catch (loadError) {
        console.error("No fue posible iniciar el mapa MapLibre", loadError)
        setError(loadError instanceof Error ? loadError.message : "No fue posible iniciar el mapa operativo.")
        if (!cancelled) setLoading(false)
      }
    }
    void loadMap()
    return () => { cancelled = true; overlayLoadersRef.current.clear(); mapRef.current?.remove(); mapRef.current = null }
  }, [supabase])

  const focusPoint = (point: InfrastructureItem) => {
    if (!hasCoordinates(point) || !mapRef.current) return
    setSelectedPointId(point.id)
    const coordinates: [number, number] = [Number(point.longitude), Number(point.latitude)]
    mapRef.current.flyTo({ center: coordinates, zoom: 17, speed: 1.2, essential: true })
    maplibreRef.current && new maplibreRef.current.Popup({ closeButton: true, maxWidth: "320px" }).setLngLat(coordinates).setHTML(pointPopupHtml({ name: point.name, category: normalizeCategory(point.category), status: point.status ?? "Sin estado" })).addTo(mapRef.current)
  }

  const toggleOverlay = async (id: string) => {
    const currentlyVisible = visibleOverlaysRef.current.has(id)
    const next = new Set(visibleOverlaysRef.current)
    currentlyVisible ? next.delete(id) : next.add(id)
    visibleOverlaysRef.current = next
    setVisibleOverlays(new Set(next))

    const state = overlayStates[id]
    if (!currentlyVisible && (state?.status === "idle" || state?.status === "error" || !state)) {
      await overlayLoadersRef.current.get(id)?.()
      return
    }
    for (const layerType of ["fill", "line", "point"]) {
      const layerId = `overlay-${layerType}-${id}`
      if (mapRef.current?.getLayer(layerId)) mapRef.current.setLayoutProperty(layerId, "visibility", currentlyVisible ? "none" : "visible")
    }
  }

  const changeOverlayColor = async (overlay: GisOverlay, color: string) => {
    if (!validHexColor(color)) return
    setOverlayColors((current) => ({ ...current, [overlay.id]: color }))
    const paintSettings = [[`overlay-fill-${overlay.id}`, "fill-color"], [`overlay-line-${overlay.id}`, "line-color"], [`overlay-point-${overlay.id}`, "circle-color"]] as const
    paintSettings.forEach(([layerId, property]) => { if (mapRef.current?.getLayer(layerId)) mapRef.current.setPaintProperty(layerId, property, color) })
    setSavingColors((current) => new Set(current).add(overlay.id))
    const nextMetadata: OverlayMetadata = { ...(overlay.metadata ?? {}), display_color: color }
    const { error: saveError } = await supabase.from("gis_overlays").update({ metadata: nextMetadata }).eq("id", overlay.id)
    setSavingColors((current) => { const next = new Set(current); next.delete(overlay.id); return next })
    if (saveError) return setError(`No fue posible guardar el color de ${overlay.name}: ${saveError.message}`)
    setOverlays((current) => current.map((item) => item.id === overlay.id ? { ...item, metadata: nextMetadata } : item))
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden"><CardContent className="relative p-0"><div ref={mapContainerRef} className="h-[72vh] min-h-[560px] w-full bg-muted" />{loading && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando mapa operativo…</div>}</CardContent></Card>

          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Puntos GIS por grupo</CardTitle><CardDescription>Los puntos están ordenados por categoría operativa. Seleccione uno para centrar el mapa.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre o descripción" className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="all">Todos los grupos</option>{categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="all">Todos los estados</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
                </div>
                <p className="text-xs text-muted-foreground">{filteredPoints.length.toLocaleString("es-CL")} de {infrastructure.length.toLocaleString("es-CL")} puntos</p>
                <div className="max-h-[390px] space-y-4 overflow-y-auto pr-1">
                  {groupedPoints.map(([category, points]) => <section key={category} className="space-y-2"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card py-1.5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{categoryLabel(category)}</p><Badge variant="outline">{points.length}</Badge></div>{points.map((point) => <button key={point.id} type="button" onClick={() => focusPoint(point)} className={`flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${selectedPointId === point.id ? "border-primary bg-muted/60" : ""}`}><div className="min-w-0"><p className="truncate text-sm font-medium">{point.name}</p><p className="mt-1 text-xs text-muted-foreground">{statusLabel(point.status ?? "unknown")}</p></div><LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</section>)}
                  {filteredPoints.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No hay puntos para estos filtros.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Capas KMZ</CardTitle><CardDescription>Las capas visibles cargan progresivamente; las ocultas solo se descargan cuando las activa.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {overlays.map((overlay) => {
                  const visible = visibleOverlays.has(overlay.id)
                  const saving = savingColors.has(overlay.id)
                  const state = overlayStates[overlay.id] ?? { status: "idle" as const }
                  return <div key={overlay.id} className="space-y-3 rounded-md border p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{overlay.name}</p><p className="text-xs text-muted-foreground">{overlayStatusCopy(state)}</p></div><button type="button" onClick={() => void toggleOverlay(overlay.id)} disabled={state.status === "loading"}><Badge variant={visible ? "default" : "outline"}>{state.status === "loading" ? "Cargando" : visible ? "Visible" : state.status === "error" ? "Reintentar" : "Oculta"}</Badge></button></div><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Color de capa</span><div className="flex items-center gap-2">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}<input type="color" value={overlayColors[overlay.id] ?? "#64748b"} onChange={(event) => void changeOverlayColor(overlay, event.target.value)} className="h-8 w-12 cursor-pointer rounded border bg-transparent p-1" /><span className="w-16 font-mono text-xs text-muted-foreground">{overlayColors[overlay.id] ?? "#64748b"}</span></div></div></div>
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

async function fetchOverlayRows(supabase: ReturnType<typeof createClient>): Promise<GisOverlay[]> {
  const extended = await supabase.from("gis_overlays").select("id,name,file_url,file_type,is_visible,opacity,metadata,updated_at,derived_geojson_url,derived_source_version").order("layer_order").order("created_at")
  if (!extended.error) return (extended.data ?? []) as GisOverlay[]
  if (!/derived_|column|schema cache/i.test(extended.error.message)) throw extended.error
  const legacy = await supabase.from("gis_overlays").select("id,name,file_url,file_type,is_visible,opacity,metadata,updated_at").order("layer_order").order("created_at")
  if (legacy.error) throw legacy.error
  return (legacy.data ?? []) as GisOverlay[]
}

function registerOverlayLayers(map: RuntimeMap, overlay: GisOverlay, geojson: GeoJsonFeatureCollection, displayColor: string, visible: boolean) {
  const sourceId = `overlay-${overlay.id}`
  map.addSource(sourceId, { type: "geojson", data: geojson })
  const opacity = Math.max(0.15, Math.min(1, Number(overlay.opacity ?? 0.75)))
  map.addLayer({ id: `overlay-fill-${overlay.id}`, type: "fill", source: sourceId, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": displayColor, "fill-opacity": ["*", opacity, ["coalesce", ["to-number", ["get", "fill-opacity"]], 0.32]] } })
  map.addLayer({ id: `overlay-line-${overlay.id}`, type: "line", source: sourceId, filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], paint: { "line-color": displayColor, "line-width": ["coalesce", ["to-number", ["get", "stroke-width"]], 2], "line-opacity": ["*", opacity, ["coalesce", ["to-number", ["get", "stroke-opacity"]], 1]] } })
  map.addLayer({ id: `overlay-point-${overlay.id}`, type: "circle", source: sourceId, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 8], "circle-color": displayColor, "circle-opacity": ["*", opacity, ["coalesce", ["to-number", ["get", "fill-opacity"]], 1]], "circle-stroke-color": "#ffffff", "circle-stroke-width": ["coalesce", ["to-number", ["get", "stroke-width"]], 1.25] } })
  const visibility = visible ? "visible" : "none"
  for (const layerType of ["fill", "line", "point"]) map.setLayoutProperty(`overlay-${layerType}-${overlay.id}`, "visibility", visibility)
}

function overlayStatusCopy(state: OverlayRuntimeState) {
  if (state.status === "idle") return "Sin cargar"
  if (state.status === "loading") return "Cargando…"
  if (state.status === "error") return `Error${state.error ? ` · ${state.error}` : ""}`
  return `${(state.featureCount ?? 0).toLocaleString("es-CL")} elementos${state.source ? ` · ${state.source}` : ""}`
}

function Metric({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div></CardContent></Card> }
function hasCoordinates(item: InfrastructureItem) { return Number.isFinite(item.latitude) && Number.isFinite(item.longitude) }
function normalizeCategory(value: string | null) { return (value ?? "uncategorized").trim().toLocaleLowerCase("en") }
function compareCategories(a: string, b: string) { const aIndex = CATEGORY_ORDER.indexOf(a); const bIndex = CATEGORY_ORDER.indexOf(b); if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, "es"); if (aIndex === -1) return 1; if (bIndex === -1) return -1; return aIndex - bIndex }
function categoryLabel(value: string) { return ({ internet: "Internet", water: "Agua", electricity: "Electricidad", ports: "Puertos", cattle: "Ganadería", food_storage: "Almacenamiento de alimentos", uncategorized: "Sin categoría" } as Record<string, string>)[value] ?? value }
function statusLabel(value: string) { return ({ active: "Activo", operational: "Operativo", planned: "Planificado", unknown: "Sin estado" } as Record<string, string>)[value] ?? value }
function pointPopupHtml(properties: Record<string, unknown>) { return `<strong>${escapeHtml(String(properties.name ?? "Punto"))}</strong><br><span>${escapeHtml(categoryLabel(String(properties.category ?? "uncategorized")))}</span><br><small>${escapeHtml(statusLabel(String(properties.status ?? "unknown")))}</small>` }
function validHexColor(value: unknown): value is string { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) }
function findNativeColor(geojson: GeoJsonFeatureCollection) { for (const feature of geojson.features) { const color = feature.properties?.fill || feature.properties?.stroke; if (validHexColor(color)) return color } return null }
function calculateBounds(coordinates: [number, number][]): [[number, number], [number, number]] { let minLng = coordinates[0][0], maxLng = coordinates[0][0], minLat = coordinates[0][1], maxLat = coordinates[0][1]; coordinates.forEach(([lng, lat]) => { minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat) }); return [[minLng, minLat], [maxLng, maxLat]] }
function escapeHtml(value: string) { return value.replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[character] ?? character) }

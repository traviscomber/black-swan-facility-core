"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Layers, Loader2, MapPin, RefreshCw, Upload } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import KmzMapView from "@/components/kmz-map-viewer"
import { KmzUploadDialog } from "@/components/kmz-upload-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import type { InfrastructureConnection } from "@/lib/types"

type InfrastructureItem = {
  id: string
  name: string
  category: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  status: string | null
  priority: string | null
}

type GisOverlay = {
  id: string
  name: string
  description: string | null
  file_url: string
  file_path: string
  file_type: string | null
  file_size: number | null
  is_visible: boolean
  opacity: number | string | null
  created_at: string | null
}

const copy = {
  es: {
    title: "Mapa operativo y capas GIS",
    description: "Infraestructura registrada, conexiones técnicas y archivos KMZ/KML del Fundo Corcovado.",
    refresh: "Actualizar",
    upload: "Agregar capa",
    infrastructure: "Infraestructura",
    connections: "Conexiones",
    layers: "Capas GIS",
    mapped: "con coordenadas",
    visible: "visibles",
    layerControl: "Control de capas",
    layerControlDescription: "Active o desactive archivos GIS registrados. La infraestructura y las conexiones provienen directamente de Supabase.",
    noLayers: "No hay capas GIS registradas.",
    loading: "Cargando mapa operativo…",
    errorTitle: "No fue posible cargar el mapa",
    errorBody: "Revise la conexión e inténtelo nuevamente.",
    selected: "Elemento seleccionado",
    category: "Categoría",
    status: "Estado",
    priority: "Prioridad",
    coordinates: "Coordenadas",
    noSelection: "Seleccione un punto del mapa para ver su información básica.",
    visibleLayer: "Visible",
    hiddenLayer: "Oculta",
    unknown: "Sin registro",
    dataNote: "Esta vista no dibuja geometrías de prueba ni elementos temporales. Solo presenta registros persistidos y archivos GIS válidos.",
  },
  en: {
    title: "Operational map and GIS layers",
    description: "Registered infrastructure, technical connections and KMZ/KML files for Fundo Corcovado.",
    refresh: "Refresh",
    upload: "Add layer",
    infrastructure: "Infrastructure",
    connections: "Connections",
    layers: "GIS layers",
    mapped: "with coordinates",
    visible: "visible",
    layerControl: "Layer control",
    layerControlDescription: "Enable or disable registered GIS files. Infrastructure and connections are loaded directly from Supabase.",
    noLayers: "No GIS layers are registered.",
    loading: "Loading operational map…",
    errorTitle: "Unable to load the map",
    errorBody: "Check the connection and try again.",
    selected: "Selected item",
    category: "Category",
    status: "Status",
    priority: "Priority",
    coordinates: "Coordinates",
    noSelection: "Select a point on the map to view its basic information.",
    visibleLayer: "Visible",
    hiddenLayer: "Hidden",
    unknown: "Not recorded",
    dataNote: "This view does not draw test geometry or temporary elements. It only presents persisted records and valid GIS files.",
  },
} as const

export default function MapPage() {
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const [infrastructure, setInfrastructure] = useState<InfrastructureItem[]>([])
  const [connections, setConnections] = useState<InfrastructureConnection[]>([])
  const [layers, setLayers] = useState<GisOverlay[]>([])
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<InfrastructureItem | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const [infrastructureResult, connectionResult, layerResult] = await Promise.all([
      supabase
        .from("infrastructure_plans")
        .select("id,name,category,description,latitude,longitude,status,priority")
        .order("name"),
      supabase
        .from("infrastructure_connections")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("gis_overlays")
        .select("id,name,description,file_url,file_path,file_type,file_size,is_visible,opacity,created_at")
        .order("layer_order", { ascending: true })
        .order("created_at", { ascending: false }),
    ])

    const firstError = infrastructureResult.error || connectionResult.error || layerResult.error
    if (firstError) {
      console.error("Operational map load failed:", firstError)
      setError(firstError.message)
      setLoading(false)
      return
    }

    const nextInfrastructure = (infrastructureResult.data || []) as InfrastructureItem[]
    const nextConnections = (connectionResult.data || []) as InfrastructureConnection[]
    const nextLayers = (layerResult.data || []) as GisOverlay[]
    setInfrastructure(nextInfrastructure)
    setConnections(nextConnections)
    setLayers(nextLayers)
    setVisibleLayers(new Set(nextLayers.filter((layer) => layer.is_visible !== false).map((layer) => layer.id)))
    setSelected((current) => current ? nextInfrastructure.find((item) => item.id === current.id) || null : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const mappedCount = useMemo(
    () => infrastructure.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).length,
    [infrastructure],
  )

  const visibleConnectionTypes = useMemo(
    () => new Set(connections.map((connection) => connection.connection_type || "general")),
    [connections],
  )

  const toggleLayer = (id: string) => {
    setVisibleLayers((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {text.refresh}
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {text.upload}
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardDescription>{text.infrastructure}</CardDescription><CardTitle className="text-3xl">{infrastructure.length}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{mappedCount} {text.mapped}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>{text.connections}</CardDescription><CardTitle className="text-3xl">{connections.length}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{visibleConnectionTypes.size} tipos</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>{text.layers}</CardDescription><CardTitle className="text-3xl">{layers.length}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{visibleLayers.size} {text.visible}</p></CardContent>
          </Card>
        </div>

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="flex gap-3 p-6">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div><p className="font-medium">{text.errorTitle}</p><p className="mt-1 text-sm text-muted-foreground">{error || text.errorBody}</p></div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex min-h-[620px] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{text.loading}</div>
                ) : (
                  <KmzMapView
                    infrastructureData={infrastructure}
                    connections={connections}
                    visibleConnections={visibleConnectionTypes}
                    kmzFiles={layers}
                    visibleLayers={visibleLayers}
                    onMarkerClick={setSelected}
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" />{text.layerControl}</CardTitle><CardDescription>{text.layerControlDescription}</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {layers.length === 0 ? <p className="text-sm text-muted-foreground">{text.noLayers}</p> : layers.map((layer) => {
                    const visible = visibleLayers.has(layer.id)
                    return (
                      <button key={layer.id} type="button" onClick={() => toggleLayer(layer.id)} className="flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/40">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{layer.name}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{layer.description || layer.file_type?.toUpperCase() || "GIS"}</p></div>
                        <Badge variant={visible ? "default" : "outline"}>{visible ? text.visibleLayer : text.hiddenLayer}</Badge>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />{text.selected}</CardTitle></CardHeader>
                <CardContent>
                  {selected ? (
                    <div className="space-y-3 text-sm">
                      <div><p className="font-medium">{selected.name}</p><p className="text-muted-foreground">{selected.description || text.unknown}</p></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-xs text-muted-foreground">{text.category}</p><p>{selected.category || text.unknown}</p></div>
                        <div><p className="text-xs text-muted-foreground">{text.status}</p><p>{selected.status || text.unknown}</p></div>
                        <div><p className="text-xs text-muted-foreground">{text.priority}</p><p>{selected.priority || text.unknown}</p></div>
                        <div><p className="text-xs text-muted-foreground">{text.coordinates}</p><p>{selected.latitude?.toFixed(5)}, {selected.longitude?.toFixed(5)}</p></div>
                      </div>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">{text.noSelection}</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{text.dataNote}</p>
      </div>

      <KmzUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploadSuccess={() => void loadData()} />
    </AppLayout>
  )
}

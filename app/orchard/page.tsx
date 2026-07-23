"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Apple, Carrot, Leaf, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"

interface Plot {
  id: string
  name: string
  plot_type: string
  size_sqm: number | null
  status: string | null
  soil_type: string | null
  ph_level: number | null
  sunlight_hours: number | null
  irrigation_type: string | null
  description: string | null
}

interface Crop {
  id: string
  plot_id: string
  crop_name: string
  scientific_name: string | null
  crop_type: string
  variety: string | null
  planting_date: string
  expected_harvest_date: string | null
  quantity_planted: number | null
  planting_unit: string | null
  status: string | null
  notes: string | null
}

const regionalCatalog = {
  hortalizas: ["Papa", "Cebolla", "Zanahoria", "Betarraga", "Rabanito", "Lechuga", "Espinaca", "Acelga", "Repollo", "Arveja", "Haba", "Zapallo italiano"],
  frutas: ["Frambuesa", "Mora", "Grosella", "Murta", "Rosa mosqueta", "Membrillo", "Ciruela", "Manzana", "Castaña", "Arándano"],
  aromaticas: ["Perejil", "Cilantro", "Orégano", "Menta", "Tomillo", "Romero", "Albahaca bajo protección"],
}

const cropNameEs: Record<string, string> = {
  Tomato: "Tomate",
  Lettuce: "Lechuga",
  "Bell Pepper": "Pimentón",
  Carrot: "Zanahoria",
  Zucchini: "Zapallo italiano",
  Onion: "Cebolla",
  Basil: "Albahaca",
  Parsley: "Perejil",
  Spinach: "Espinaca",
  Arugula: "Rúcula",
  Potato: "Papa",
  Beet: "Betarraga",
  Radish: "Rabanito",
}

const statusEs: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  paused: "Pausado",
  seedling: "Almácigo",
  growing: "En crecimiento",
  mature: "Maduro",
  harvested: "Cosechado",
}

export default function OrchardPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [plots, setPlots] = useState<Plot[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [plotsResult, cropsResult] = await Promise.all([
      supabase.from("orchard_plots").select("id, name, plot_type, size_sqm, status, soil_type, ph_level, sunlight_hours, irrigation_type, description").order("name"),
      supabase.from("orchard_crops").select("id, plot_id, crop_name, scientific_name, crop_type, variety, planting_date, expected_harvest_date, quantity_planted, planting_unit, status, notes").order("planting_date", { ascending: false }),
    ])
    const loadError = plotsResult.error || cropsResult.error
    if (loadError) {
      setError(loadError.message)
      setPlots([])
      setCrops([])
    } else {
      setPlots((plotsResult.data ?? []) as Plot[])
      setCrops((cropsResult.data ?? []) as Crop[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  const plotById = useMemo(() => new Map(plots.map((plot) => [plot.id, plot.name])), [plots])
  const totalArea = plots.reduce((sum, plot) => sum + Number(plot.size_sqm ?? 0), 0)
  const outdated = crops.filter((crop) => crop.expected_harvest_date && new Date(crop.expected_harvest_date) < new Date() && crop.status !== "harvested").length

  return (
    <AppLayout>
      <PageHeader
        title="Huerto y producción vegetal"
        description="Registro operativo del huerto de Fundo Corcovado y catálogo territorial de especies compatibles con Los Ríos."
      />

      <div className="space-y-6 p-4 sm:p-8">
        <Card className="border-amber-300">
          <CardContent className="flex gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">El catálogo territorial no confirma plantación en el Fundo</p>
              <p className="mt-1 text-sm text-muted-foreground">Las especies regionales se muestran como referencia para planificación. Solo los registros de “Cultivos declarados” representan datos actualmente guardados en Supabase y también deben validarse en terreno.</p>
            </div>
          </CardContent>
        </Card>

        {outdated > 0 && (
          <Card className="border-amber-300"><CardContent className="p-5 text-sm"><p className="font-medium">Hay {outdated} cultivos con fecha esperada de cosecha vencida y sin cierre.</p><p className="mt-1 text-muted-foreground">Se conservaron sin cambios para evitar alterar el historial. Requieren actualización por el responsable del huerto.</p></CardContent></Card>
        )}

        {error && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">No fue posible cargar el huerto: {error}</p><Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Sectores registrados" value={plots.length} />
          <Metric title="Superficie declarada" value={`${totalArea.toLocaleString("es-CL")} m²`} />
          <Metric title="Cultivos declarados" value={crops.length} />
          <Metric title="Especies regionales de referencia" value={regionalCatalog.hortalizas.length + regionalCatalog.frutas.length + regionalCatalog.aromaticas.length} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <CatalogCard icon={Carrot} title="Hortalizas y chacra" items={regionalCatalog.hortalizas} note="Incluye especies de clima fresco y cultivos tradicionales del sur. Cebolla cuenta con ensayos recientes de INIA en Los Ríos." />
          <CatalogCard icon={Apple} title="Frutas y frutos del sur" items={regionalCatalog.frutas} note="Frambuesa, mora, grosella, murta, rosa mosqueta, membrillo y ciruela tienen presencia documentada en producción campesina regional." />
          <CatalogCard icon={Leaf} title="Aromáticas y hojas" items={regionalCatalog.aromaticas} note="La albahaca requiere mayor protección térmica; el resto se adapta mejor a condiciones frescas y manejo estacional." />
        </div>

        <Card>
          <CardHeader><CardTitle>Sectores del huerto</CardTitle><CardDescription>Información física registrada; no se estiman rendimientos cuando no existen cosechas confirmadas.</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando sectores…</p> : plots.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No hay sectores registrados.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plots.map((plot) => <Card key={plot.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{plot.name}</CardTitle><Badge variant="outline">{statusEs[plot.status ?? ""] ?? plot.status ?? "Sin estado"}</Badge></div><CardDescription>{plot.description || "Sin descripción operativa."}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">Tipo:</span> {plot.plot_type}</p><p><span className="text-muted-foreground">Superficie:</span> {Number(plot.size_sqm ?? 0).toLocaleString("es-CL")} m²</p><p><span className="text-muted-foreground">Suelo:</span> {plot.soil_type || "Sin registro"}</p><p><span className="text-muted-foreground">pH:</span> {plot.ph_level ?? "Sin registro"}</p><p><span className="text-muted-foreground">Riego:</span> {plot.irrigation_type || "Sin registro"}</p></CardContent></Card>)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cultivos declarados</CardTitle><CardDescription>Registros existentes traducidos al español en la interfaz. No se cambiaron nombres, cantidades ni fechas en la base.</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando cultivos…</p> : crops.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No hay cultivos declarados.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{crops.map((crop) => <div key={crop.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{cropNameEs[crop.crop_name] ?? crop.crop_name}</p><p className="text-xs text-muted-foreground">{crop.variety || crop.scientific_name || "Variedad no informada"}</p></div><Badge variant="outline">{statusEs[crop.status ?? ""] ?? crop.status ?? "Sin estado"}</Badge></div><div className="mt-3 space-y-1 text-sm"><p><span className="text-muted-foreground">Sector:</span> {plotById.get(crop.plot_id) ?? "No identificado"}</p><p><span className="text-muted-foreground">Plantación registrada:</span> {new Date(`${crop.planting_date}T12:00:00`).toLocaleDateString("es-CL")}</p><p><span className="text-muted-foreground">Cantidad:</span> {crop.quantity_planted?.toLocaleString("es-CL") ?? "Sin registro"} {crop.planting_unit ?? ""}</p></div></div>)}</div>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</div></CardContent></Card>
}

function CatalogCard({ icon: Icon, title, items, note }: { icon: typeof Sprout; title: string; items: string[]; note: string }) {
  return <Card><CardHeader><div className="flex items-center gap-2"><Icon className="h-5 w-5" /><CardTitle className="text-base">{title}</CardTitle></div><CardDescription>{note}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</CardContent></Card>
}

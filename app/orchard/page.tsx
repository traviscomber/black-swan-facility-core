"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Plot = {
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

type Crop = {
  id: string
  plot_id: string
  crop_name: string
  crop_type: string
  variety: string | null
  planting_date: string
  expected_harvest_date: string | null
  quantity_planted: number | null
  planting_unit: string | null
  status: string | null
  notes: string | null
}

const copy = {
  es: {
    title: "Huerto",
    description: "Seguimiento operativo de sectores y cultivos registrados en Fundo Corcovado.",
    loadError: "No fue posible cargar el huerto",
    retry: "Reintentar",
    plots: "Sectores registrados",
    area: "Superficie declarada",
    crops: "Cultivos registrados",
    pendingHarvest: "Cosechas pendientes",
    overdueTitle: (count: number) => `${count} cultivo${count === 1 ? "" : "s"} con fecha de cosecha vencida y sin cierre.`,
    overdueBody: "Los registros se mantienen sin cambios y requieren revisión en terreno.",
    plotsTitle: "Sectores del huerto",
    plotsDescription: "Características físicas actualmente registradas.",
    cropsTitle: "Cultivos activos y pendientes",
    cropsDescription: "No se estiman rendimientos porque todavía no existen cosechas registradas.",
    noPlots: "No hay sectores registrados.",
    noCrops: "No hay cultivos registrados.",
    noDescription: "Sin descripción operativa.",
    noRecord: "Sin registro",
    noStatus: "Sin estado",
    type: "Tipo",
    soil: "Suelo",
    irrigation: "Riego",
    planted: "Plantación",
    harvest: "Cosecha esperada",
    quantity: "Cantidad",
    sector: "Sector",
    unknownSector: "No identificado",
  },
  en: {
    title: "Orchard",
    description: "Operational tracking of registered orchard plots and crops at Fundo Corcovado.",
    loadError: "The orchard could not be loaded",
    retry: "Retry",
    plots: "Registered plots",
    area: "Declared area",
    crops: "Registered crops",
    pendingHarvest: "Pending harvests",
    overdueTitle: (count: number) => `${count} crop${count === 1 ? "" : "s"} with an overdue harvest date and no closure.`,
    overdueBody: "Records remain unchanged and require field review.",
    plotsTitle: "Orchard plots",
    plotsDescription: "Currently registered physical characteristics.",
    cropsTitle: "Active and pending crops",
    cropsDescription: "Yield is not estimated because no harvest records exist yet.",
    noPlots: "No plots are registered.",
    noCrops: "No crops are registered.",
    noDescription: "No operational description.",
    noRecord: "Not recorded",
    noStatus: "No status",
    type: "Type",
    soil: "Soil",
    irrigation: "Irrigation",
    planted: "Planting",
    harvest: "Expected harvest",
    quantity: "Quantity",
    sector: "Plot",
    unknownSector: "Unidentified",
  },
} as const

const statuses: Record<"es" | "en", Record<string, string>> = {
  es: { active: "Activo", inactive: "Inactivo", paused: "Pausado", seedling: "Almácigo", growing: "En crecimiento", mature: "Maduro", harvested: "Cosechado" },
  en: { active: "Active", inactive: "Inactive", paused: "Paused", seedling: "Seedling", growing: "Growing", mature: "Mature", harvested: "Harvested" },
}

const cropNames: Record<"es" | "en", Record<string, string>> = {
  es: { Tomato: "Tomate", Lettuce: "Lechuga", "Bell Pepper": "Pimentón", Carrot: "Zanahoria", Zucchini: "Zapallo italiano", Onion: "Cebolla", Basil: "Albahaca", Parsley: "Perejil", Spinach: "Espinaca", Arugula: "Rúcula", Potato: "Papa", Beet: "Betarraga", Radish: "Rabanito" },
  en: {},
}

export default function OrchardPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [plots, setPlots] = useState<Plot[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [plotsResult, cropsResult] = await Promise.all([
      supabase.from("orchard_plots").select("id, name, plot_type, size_sqm, status, soil_type, ph_level, sunlight_hours, irrigation_type, description").order("name"),
      supabase.from("orchard_crops").select("id, plot_id, crop_name, crop_type, variety, planting_date, expected_harvest_date, quantity_planted, planting_unit, status, notes").order("expected_harvest_date"),
    ])
    const loadError = plotsResult.error ?? cropsResult.error
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
  const pending = crops.filter((crop) => crop.status !== "harvested")
  const now = new Date()
  const overdue = pending.filter((crop) => crop.expected_harvest_date && new Date(`${crop.expected_harvest_date}T12:00:00`) < now)

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.retry}</Button>} />
      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{text.loadError}: {error}</CardContent></Card>}
        {overdue.length > 0 && <Card className="border-amber-300"><CardContent className="flex gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-medium">{text.overdueTitle(overdue.length)}</p><p className="mt-1 text-sm text-muted-foreground">{text.overdueBody}</p></div></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title={text.plots} value={plots.length.toLocaleString(locale)} />
          <Metric title={text.area} value={`${totalArea.toLocaleString(locale)} m²`} />
          <Metric title={text.crops} value={crops.length.toLocaleString(locale)} />
          <Metric title={text.pendingHarvest} value={pending.length.toLocaleString(locale)} />
        </div>

        <Card>
          <CardHeader><CardTitle>{text.plotsTitle}</CardTitle><CardDescription>{text.plotsDescription}</CardDescription></CardHeader>
          <CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p> : plots.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{text.noPlots}</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plots.map((plot) => <Card key={plot.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{plot.name}</CardTitle><Badge variant="outline">{statuses[lang][plot.status ?? ""] ?? plot.status ?? text.noStatus}</Badge></div><CardDescription>{plot.description || text.noDescription}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">{text.type}:</span> {plot.plot_type}</p><p><span className="text-muted-foreground">{text.area}:</span> {Number(plot.size_sqm ?? 0).toLocaleString(locale)} m²</p><p><span className="text-muted-foreground">{text.soil}:</span> {plot.soil_type || text.noRecord}</p><p><span className="text-muted-foreground">{text.irrigation}:</span> {plot.irrigation_type || text.noRecord}</p></CardContent></Card>)}</div>}</CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.cropsTitle}</CardTitle><CardDescription>{text.cropsDescription}</CardDescription></CardHeader>
          <CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p> : crops.length === 0 ? <div className="py-10 text-center"><Sprout className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="text-sm text-muted-foreground">{text.noCrops}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-3 pr-4 font-medium">Cultivo</th><th className="pb-3 pr-4 font-medium">{text.sector}</th><th className="pb-3 pr-4 font-medium">Estado</th><th className="pb-3 pr-4 font-medium">{text.planted}</th><th className="pb-3 pr-4 font-medium">{text.harvest}</th><th className="pb-3 font-medium">{text.quantity}</th></tr></thead><tbody>{crops.map((crop) => <tr key={crop.id} className="border-b last:border-0"><td className="py-4 pr-4"><p className="font-medium">{cropNames[lang][crop.crop_name] ?? crop.crop_name}</p><p className="text-xs text-muted-foreground">{crop.variety || text.noRecord}</p></td><td className="py-4 pr-4">{plotById.get(crop.plot_id) ?? text.unknownSector}</td><td className="py-4 pr-4"><Badge variant="outline">{statuses[lang][crop.status ?? ""] ?? crop.status ?? text.noStatus}</Badge></td><td className="py-4 pr-4">{new Date(`${crop.planting_date}T12:00:00`).toLocaleDateString(locale)}</td><td className="py-4 pr-4">{crop.expected_harvest_date ? new Date(`${crop.expected_harvest_date}T12:00:00`).toLocaleDateString(locale) : text.noRecord}</td><td className="py-4">{Number(crop.quantity_planted ?? 0).toLocaleString(locale)} {crop.planting_unit || ""}</td></tr>)}</tbody></table></div>}</CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>
}

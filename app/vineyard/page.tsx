"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Grape, Images, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { AddPlotDialog } from "@/components/vineyard/add-plot-dialog"
import { useLanguage } from "@/lib/hooks/use-language"

type VineyardPlot = {
  id: string
  name: string
  location: string | null
  area_hectares: number | null
  vine_variety: string | null
  planted_year: number | null
  rootstock: string | null
  vine_density_per_hectare: number | null
  trellis_system: string | null
  soil_type: string | null
  ph_level: number | null
  drainage_quality: string | null
  status: string | null
  notes: string | null
}

const copy = {
  es: {
    title: "Viñedo",
    description: "Registro operativo de cuarteles y antecedentes técnicos del Fundo Corcovado.",
    photos: "Fotos",
    loadError: "No fue posible cargar el viñedo",
    loading: "Cargando…",
    retry: "Reintentar",
    plots: "Cuarteles registrados",
    area: "Superficie declarada",
    varieties: "Cepas registradas",
    active: "Cuarteles activos",
    emptyTitle: "No hay cuarteles de viñedo registrados.",
    emptyBody: "El módulo queda preparado para registrar ensayos o plantaciones reales. No se muestran recomendaciones varietales como si fueran producción existente.",
    sectionTitle: "Cuarteles",
    sectionDescription: "Solo se muestran registros existentes en Supabase. Rendimientos y producción aparecerán cuando existan cosechas confirmadas.",
    noLocation: "Ubicación no registrada",
    noStatus: "Sin estado",
    variety: "Cepa",
    plantedYear: "Año de plantación",
    soil: "Suelo",
    drainage: "Drenaje",
    density: "Densidad",
    trellis: "Conducción",
    noRecord: "Sin registro",
    plantsPerHa: "plantas/ha",
  },
  en: {
    title: "Vineyard",
    description: "Operational records for vineyard blocks and technical information at Fundo Corcovado.",
    photos: "Photos",
    loadError: "The vineyard could not be loaded",
    loading: "Loading…",
    retry: "Retry",
    plots: "Registered blocks",
    area: "Declared area",
    varieties: "Registered varieties",
    active: "Active blocks",
    emptyTitle: "No vineyard blocks are registered.",
    emptyBody: "The module is ready for real trials or plantings. Variety recommendations are not presented as existing production.",
    sectionTitle: "Vineyard blocks",
    sectionDescription: "Only existing Supabase records are shown. Yield and production will appear when confirmed harvest records exist.",
    noLocation: "Location not recorded",
    noStatus: "No status",
    variety: "Variety",
    plantedYear: "Planting year",
    soil: "Soil",
    drainage: "Drainage",
    density: "Density",
    trellis: "Trellis",
    noRecord: "Not recorded",
    plantsPerHa: "vines/ha",
  },
  de: {
    title: "Weinberg",
    description: "Betriebsdaten zu Weinbergsblöcken und technischen Angaben auf Fundo Corcovado.",
    photos: "Fotos",
    loadError: "Der Weinberg konnte nicht geladen werden",
    loading: "Wird geladen…",
    retry: "Erneut versuchen",
    plots: "Registrierte Blöcke",
    area: "Erfasste Fläche",
    varieties: "Registrierte Rebsorten",
    active: "Aktive Blöcke",
    emptyTitle: "Es sind keine Weinbergsblöcke registriert.",
    emptyBody: "Das Modul ist für reale Versuche oder Pflanzungen vorbereitet. Sortenempfehlungen werden nicht als bestehende Produktion dargestellt.",
    sectionTitle: "Weinbergsblöcke",
    sectionDescription: "Es werden nur vorhandene Supabase-Datensätze angezeigt. Ertrag und Produktion erscheinen, sobald bestätigte Erntedaten vorliegen.",
    noLocation: "Standort nicht erfasst",
    noStatus: "Kein Status",
    variety: "Rebsorte",
    plantedYear: "Pflanzjahr",
    soil: "Boden",
    drainage: "Drainage",
    density: "Pflanzdichte",
    trellis: "Erziehungssystem",
    noRecord: "Nicht erfasst",
    plantsPerHa: "Reben/ha",
  },
} as const

const statuses: Record<"es" | "en" | "de", Record<string, string>> = {
  es: { active: "Activo", inactive: "Inactivo", planned: "Planificado", establishment: "En establecimiento" },
  en: { active: "Active", inactive: "Inactive", planned: "Planned", establishment: "Establishment" },
  de: { active: "Aktiv", inactive: "Inaktiv", planned: "Geplant", establishment: "In Etablierung" },
}

const locales = { es: "es-CL", en: "en-US", de: "de-DE" } as const

export default function VineyardPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language
  const text = copy[lang]
  const locale = locales[lang]
  const [plots, setPlots] = useState<VineyardPlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlots = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("vineyard_plots")
      .select("id, name, location, area_hectares, vine_variety, planted_year, rootstock, vine_density_per_hectare, trellis_system, soil_type, ph_level, drainage_quality, status, notes")
      .order("name")

    if (loadError) {
      setError(loadError.message)
      setPlots([])
    } else setPlots((data ?? []) as VineyardPlot[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchPlots() }, [fetchPlots])

  const totalArea = plots.reduce((sum, plot) => sum + Number(plot.area_hectares ?? 0), 0)
  const activePlots = plots.filter((plot) => plot.status === "active").length
  const varieties = new Set(plots.map((plot) => plot.vine_variety?.trim()).filter(Boolean)).size

  return (
    <AppLayout>
      <PageHeader
        title={text.title}
        description={text.description}
        actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/vineyard/photos"><Images className="mr-2 h-4 w-4" />{text.photos}</Link></Button><AddPlotDialog onPlotAdded={fetchPlots} /></div>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-4"><p className="text-sm text-destructive">{text.loadError}: {error}</p><Button variant="outline" size="sm" onClick={() => void fetchPlots()}><RefreshCw className="mr-2 h-4 w-4" />{text.retry}</Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title={text.plots} value={plots.length.toLocaleString(locale)} />
          <Metric title={text.area} value={`${totalArea.toLocaleString(locale, { maximumFractionDigits: 2 })} ha`} />
          <Metric title={text.active} value={activePlots.toLocaleString(locale)} />
          <Metric title={text.varieties} value={varieties.toLocaleString(locale)} />
        </div>

        <Card>
          <CardHeader><CardTitle>{text.sectionTitle}</CardTitle><CardDescription>{text.sectionDescription}</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="py-12 text-center text-sm text-muted-foreground">{text.loading}</p> : plots.length === 0 ? <div className="py-12 text-center"><Grape className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">{text.emptyTitle}</p><p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{text.emptyBody}</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plots.map((plot) => <Card key={plot.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{plot.name}</CardTitle><Badge variant="outline">{statuses[lang][plot.status ?? ""] ?? plot.status ?? text.noStatus}</Badge></div><CardDescription>{plot.location || text.noLocation}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">{text.variety}:</span> {plot.vine_variety || text.noRecord}</p><p><span className="text-muted-foreground">{text.area}:</span> {Number(plot.area_hectares ?? 0).toLocaleString(locale, { maximumFractionDigits: 2 })} ha</p><p><span className="text-muted-foreground">{text.plantedYear}:</span> {plot.planted_year ?? text.noRecord}</p><p><span className="text-muted-foreground">{text.soil}:</span> {plot.soil_type || text.noRecord}</p><p><span className="text-muted-foreground">{text.drainage}:</span> {plot.drainage_quality || text.noRecord}</p><p><span className="text-muted-foreground">{text.density}:</span> {plot.vine_density_per_hectare ? `${plot.vine_density_per_hectare.toLocaleString(locale)} ${text.plantsPerHa}` : text.noRecord}</p><p><span className="text-muted-foreground">{text.trellis}:</span> {plot.trellis_system || text.noRecord}</p></CardContent></Card>)}</div>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>
}

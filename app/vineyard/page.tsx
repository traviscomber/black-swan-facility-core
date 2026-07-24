"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Grape, Images, RefreshCw, Sprout } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { AddPlotDialog } from "@/components/vineyard/add-plot-dialog"
import { useLanguage } from "@/lib/hooks/use-language"

interface VineyardPlot {
  id: string
  name: string
  location: string | null
  area_hectares: number | null
  vine_variety: string | null
  planted_year: number | null
  rootstock: string | null
  spacing_meters: number | null
  vine_density_per_hectare: number | null
  trellis_system: string | null
  orientation: string | null
  aspect: string | null
  soil_type: string | null
  ph_level: number | null
  drainage_quality: string | null
  status: string | null
  notes: string | null
}

const copy = {
  es: {
    title: "Viñedo y vinos",
    description: "Registro de cuarteles del Fundo Corcovado y catálogo técnico de cepas para evaluación en viticultura austral.",
    photos: "Fotos",
    warningTitle: "Cepas de referencia, no plantaciones confirmadas",
    warningBody: "El catálogo resume variedades compatibles con viticultura fría y experiencias australes. No afirma que estén plantadas en Fundo Corcovado. Cada cepa requiere evaluación de suelo, drenaje, heladas, exposición, material vegetal y madurez.",
    incompleteTitle: (count: number) => `${count} cuartel${count === 1 ? "" : "es"} con ficha técnica incompleta.`,
    incompleteBody: "Antes de decisiones de plantación deben registrarse al menos cepa, tipo de suelo y calidad de drenaje.",
    loadError: "No fue posible cargar el viñedo",
    retry: "Reintentar",
    registeredPlots: "Cuarteles registrados",
    declaredArea: "Superficie declarada",
    activePlots: "Cuarteles activos",
    declaredVarieties: "Cepas declaradas",
    priorityTitle: "Cepas prioritarias para evaluar",
    priorityDescription: "Variedades de clima frío con mayor respaldo para una evaluación técnica inicial.",
    trialTitle: "Cepas para ensayo controlado",
    trialDescription: "Alternativas que conviene probar primero en microparcelas, sin asumir viabilidad comercial.",
    declaredTitle: "Cuarteles declarados",
    declaredDescription: "Solo esta sección representa registros existentes en Supabase. Actualmente no se generan rendimientos ni producción estimada sin datos de cosecha.",
    loading: "Cargando cuarteles…",
    emptyTitle: "No hay cuarteles de viñedo registrados.",
    emptyBody: "El catálogo superior es únicamente una referencia para diseñar ensayos y futuras plantaciones.",
    noStatus: "Sin estado",
    noLocation: "Ubicación no registrada",
    variety: "Cepa",
    area: "Superficie",
    plantedYear: "Año de plantación",
    soil: "Suelo",
    drainage: "Drenaje",
    density: "Densidad",
    trellis: "Sistema de conducción",
    undefined: "Sin definir",
    noRecord: "Sin registro",
    plantsPerHa: "plantas/ha",
  },
  en: {
    title: "Vineyard and wines",
    description: "Fundo Corcovado vineyard block records and a technical catalog of varieties for evaluation in austral viticulture.",
    photos: "Photos",
    warningTitle: "Reference varieties, not confirmed plantings",
    warningBody: "The catalog summarizes varieties compatible with cool-climate viticulture and austral experience. It does not claim that they are planted at Fundo Corcovado. Each variety requires evaluation of soil, drainage, frost, exposure, plant material and ripening.",
    incompleteTitle: (count: number) => `${count} vineyard block${count === 1 ? "" : "s"} with incomplete technical information.`,
    incompleteBody: "At minimum, variety, soil type and drainage quality must be recorded before planting decisions are made.",
    loadError: "The vineyard could not be loaded",
    retry: "Retry",
    registeredPlots: "Registered blocks",
    declaredArea: "Declared area",
    activePlots: "Active blocks",
    declaredVarieties: "Declared varieties",
    priorityTitle: "Priority varieties for evaluation",
    priorityDescription: "Cool-climate varieties with the strongest basis for an initial technical assessment.",
    trialTitle: "Varieties for controlled trials",
    trialDescription: "Alternatives that should first be tested in microplots without assuming commercial viability.",
    declaredTitle: "Declared vineyard blocks",
    declaredDescription: "Only this section represents existing Supabase records. No yields or production are estimated without harvest data.",
    loading: "Loading vineyard blocks…",
    emptyTitle: "No vineyard blocks are registered.",
    emptyBody: "The catalog above is only a reference for designing trials and future plantings.",
    noStatus: "No status",
    noLocation: "Location not recorded",
    variety: "Variety",
    area: "Area",
    plantedYear: "Planting year",
    soil: "Soil",
    drainage: "Drainage",
    density: "Density",
    trellis: "Trellis system",
    undefined: "Not defined",
    noRecord: "Not recorded",
    plantsPerHa: "vines/ha",
  },
} as const

const australCatalog = {
  es: {
    priority: [
      { variety: "Pinot Noir", profile: "Tinta de ciclo relativamente corto y alta afinidad con climas fríos." },
      { variety: "Chardonnay", profile: "Blanca ampliamente usada en zonas frías y base potencial para vino tranquilo o espumante." },
      { variety: "Sauvignon Blanc", profile: "Blanca aromática con buen desempeño en sectores frescos y ventilados." },
      { variety: "Riesling", profile: "Blanca de clima frío; requiere evaluación de madurez y manejo de humedad." },
    ],
    trials: [
      { variety: "Gewürztraminer", profile: "Alternativa aromática para ensayos pequeños y sitios protegidos." },
      { variety: "Pinot Gris", profile: "Blanca adaptable a clima frío, sujeta a validación de sitio y material vegetal." },
      { variety: "Chasselas", profile: "Cepa temprana observada en experiencias vitícolas australes; apta para evaluación experimental." },
    ],
  },
  en: {
    priority: [
      { variety: "Pinot Noir", profile: "A relatively short-cycle red variety with strong affinity for cool climates." },
      { variety: "Chardonnay", profile: "A white variety widely used in cool regions and a potential base for still or sparkling wine." },
      { variety: "Sauvignon Blanc", profile: "An aromatic white variety with good performance in cool, ventilated sites." },
      { variety: "Riesling", profile: "A cool-climate white variety that requires evaluation of ripening and moisture management." },
    ],
    trials: [
      { variety: "Gewürztraminer", profile: "An aromatic alternative for small trials and protected sites." },
      { variety: "Pinot Gris", profile: "A white variety adaptable to cool climates, subject to site and plant-material validation." },
      { variety: "Chasselas", profile: "An early variety observed in austral viticulture experiences and suitable for experimental evaluation." },
    ],
  },
} as const

const statuses: Record<"es" | "en", Record<string, string>> = {
  es: { active: "Activo", inactive: "Inactivo", planned: "Planificado", establishment: "En establecimiento" },
  en: { active: "Active", inactive: "Inactive", planned: "Planned", establishment: "Establishment" },
}

export default function VineyardPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const catalog = australCatalog[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [plots, setPlots] = useState<VineyardPlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlots = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("vineyard_plots")
      .select("id, name, location, area_hectares, vine_variety, planted_year, rootstock, spacing_meters, vine_density_per_hectare, trellis_system, orientation, aspect, soil_type, ph_level, drainage_quality, status, notes")
      .order("name")

    if (loadError) {
      setError(loadError.message)
      setPlots([])
    } else {
      setPlots((data ?? []) as VineyardPlot[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchPlots() }, [fetchPlots])

  const totalArea = plots.reduce((sum, plot) => sum + Number(plot.area_hectares ?? 0), 0)
  const active = plots.filter((plot) => plot.status === "active").length
  const varieties = new Set(plots.map((plot) => plot.vine_variety?.trim()).filter(Boolean)).size
  const missingTechnicalData = plots.filter((plot) => !plot.vine_variety || !plot.soil_type || !plot.drainage_quality).length

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <PageHeader
        title={text.title}
        description={text.description}
        actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/vineyard/photos"><Images className="mr-2 h-4 w-4" />{text.photos}</Link></Button><AddPlotDialog onPlotAdded={fetchPlots} /></div>}
      />

      <Card className="border-amber-300"><CardContent className="flex gap-3 p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-medium">{text.warningTitle}</p><p className="mt-1 text-sm text-muted-foreground">{text.warningBody}</p></div></CardContent></Card>
      {missingTechnicalData > 0 && <Card className="border-amber-300"><CardContent className="p-5 text-sm"><p className="font-medium">{text.incompleteTitle(missingTechnicalData)}</p><p className="mt-1 text-muted-foreground">{text.incompleteBody}</p></CardContent></Card>}
      {error && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">{text.loadError}: {error}</p><Button variant="outline" size="sm" onClick={() => void fetchPlots()}><RefreshCw className="mr-2 h-4 w-4" />{text.retry}</Button></CardContent></Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title={text.registeredPlots} value={plots.length} locale={locale} />
        <Metric title={text.declaredArea} value={`${totalArea.toLocaleString(locale, { maximumFractionDigits: 2 })} ha`} locale={locale} />
        <Metric title={text.activePlots} value={active} locale={locale} />
        <Metric title={text.declaredVarieties} value={varieties} locale={locale} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <VarietyCard title={text.priorityTitle} description={text.priorityDescription} varieties={catalog.priority} />
        <VarietyCard title={text.trialTitle} description={text.trialDescription} varieties={catalog.trials} />
      </div>

      <Card>
        <CardHeader><CardTitle>{text.declaredTitle}</CardTitle><CardDescription>{text.declaredDescription}</CardDescription></CardHeader>
        <CardContent>
          {loading ? <p className="py-12 text-center text-sm text-muted-foreground">{text.loading}</p> : plots.length === 0 ? <div className="py-12 text-center"><Grape className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">{text.emptyTitle}</p><p className="mt-1 text-sm text-muted-foreground">{text.emptyBody}</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plots.map((plot) => <Card key={plot.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{plot.name}</CardTitle><Badge variant="outline">{statuses[lang][plot.status ?? ""] ?? plot.status ?? text.noStatus}</Badge></div><CardDescription>{plot.location || text.noLocation}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">{text.variety}:</span> {plot.vine_variety || text.undefined}</p><p><span className="text-muted-foreground">{text.area}:</span> {Number(plot.area_hectares ?? 0).toLocaleString(locale, { maximumFractionDigits: 2 })} ha</p><p><span className="text-muted-foreground">{text.plantedYear}:</span> {plot.planted_year ?? text.noRecord}</p><p><span className="text-muted-foreground">{text.soil}:</span> {plot.soil_type || text.noRecord}</p><p><span className="text-muted-foreground">{text.drainage}:</span> {plot.drainage_quality || text.noRecord}</p><p><span className="text-muted-foreground">{text.density}:</span> {plot.vine_density_per_hectare ? `${plot.vine_density_per_hectare.toLocaleString(locale)} ${text.plantsPerHa}` : text.noRecord}</p><p><span className="text-muted-foreground">{text.trellis}:</span> {plot.trellis_system || text.noRecord}</p></CardContent></Card>)}</div>}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ title, value, locale }: { title: string; value: string | number; locale: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString(locale) : value}</div></CardContent></Card>
}

function VarietyCard({ title, description, varieties }: { title: string; description: string; varieties: readonly { variety: string; profile: string }[] }) {
  return <Card><CardHeader><div className="flex items-center gap-2"><Sprout className="h-5 w-5" /><CardTitle className="text-base">{title}</CardTitle></div><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-3">{varieties.map((item) => <div key={item.variety} className="rounded-lg border p-3"><p className="font-medium">{item.variety}</p><p className="mt-1 text-sm text-muted-foreground">{item.profile}</p></div>)}</CardContent></Card>
}

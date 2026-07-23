"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Apple, Carrot, Leaf, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

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

const copy = {
  es: {
    title: "Huerto y producción vegetal",
    description: "Registro operativo del huerto de Fundo Corcovado y catálogo territorial de especies compatibles con Los Ríos.",
    catalogWarningTitle: "El catálogo territorial no confirma plantación en el Fundo",
    catalogWarningBody: "Las especies regionales se muestran como referencia para planificación. Solo los registros de “Cultivos declarados” representan datos actualmente guardados en Supabase y también deben validarse en terreno.",
    overdueTitle: (count: number) => `Hay ${count} cultivos con fecha esperada de cosecha vencida y sin cierre.`,
    overdueBody: "Se conservaron sin cambios para evitar alterar el historial. Requieren actualización por el responsable del huerto.",
    loadError: "No fue posible cargar el huerto",
    retry: "Reintentar",
    registeredPlots: "Sectores registrados",
    declaredArea: "Superficie declarada",
    declaredCrops: "Cultivos declarados",
    regionalSpecies: "Especies regionales de referencia",
    vegetablesTitle: "Hortalizas y chacra",
    vegetablesNote: "Incluye especies de clima fresco y cultivos tradicionales del sur. Cebolla cuenta con ensayos recientes de INIA en Los Ríos.",
    fruitsTitle: "Frutas y frutos del sur",
    fruitsNote: "Frambuesa, mora, grosella, murta, rosa mosqueta, membrillo y ciruela tienen presencia documentada en producción campesina regional.",
    herbsTitle: "Aromáticas y hojas",
    herbsNote: "La albahaca requiere mayor protección térmica; el resto se adapta mejor a condiciones frescas y manejo estacional.",
    plotsTitle: "Sectores del huerto",
    plotsDescription: "Información física registrada; no se estiman rendimientos cuando no existen cosechas confirmadas.",
    loadingPlots: "Cargando sectores…",
    noPlots: "No hay sectores registrados.",
    noDescription: "Sin descripción operativa.",
    type: "Tipo",
    area: "Superficie",
    soil: "Suelo",
    irrigation: "Riego",
    noRecord: "Sin registro",
    noStatus: "Sin estado",
    cropsTitle: "Cultivos declarados",
    cropsDescription: "Registros existentes traducidos en la interfaz. No se cambiaron nombres, cantidades ni fechas en la base.",
    loadingCrops: "Cargando cultivos…",
    noCrops: "No hay cultivos declarados.",
    noVariety: "Variedad no informada",
    plot: "Sector",
    unknownPlot: "No identificado",
    plantedDate: "Plantación registrada",
    quantity: "Cantidad",
  },
  en: {
    title: "Orchard and crop production",
    description: "Operational orchard records for Fundo Corcovado and a regional catalog of species compatible with Los Ríos.",
    catalogWarningTitle: "The regional catalog does not confirm planting at the property",
    catalogWarningBody: "Regional species are shown as planning references. Only records under “Declared crops” represent data currently stored in Supabase, and those records must also be validated in the field.",
    overdueTitle: (count: number) => `${count} crops have an overdue expected harvest date and no closure record.`,
    overdueBody: "They were preserved unchanged to protect the historical record. The orchard manager must review and update them.",
    loadError: "The orchard could not be loaded",
    retry: "Retry",
    registeredPlots: "Registered plots",
    declaredArea: "Declared area",
    declaredCrops: "Declared crops",
    regionalSpecies: "Regional reference species",
    vegetablesTitle: "Vegetables and field crops",
    vegetablesNote: "Includes cool-season species and traditional southern crops. Onion has also been included in recent INIA trials in Los Ríos.",
    fruitsTitle: "Southern fruits and berries",
    fruitsNote: "Raspberry, blackberry, currant, Chilean guava, rosehip, quince and plum are documented in regional small-scale production.",
    herbsTitle: "Herbs and leafy crops",
    herbsNote: "Basil requires greater thermal protection; the remaining species are better suited to cool conditions and seasonal management.",
    plotsTitle: "Orchard plots",
    plotsDescription: "Registered physical information; yields are not estimated when confirmed harvest records do not exist.",
    loadingPlots: "Loading plots…",
    noPlots: "No plots are registered.",
    noDescription: "No operational description.",
    type: "Type",
    area: "Area",
    soil: "Soil",
    irrigation: "Irrigation",
    noRecord: "Not recorded",
    noStatus: "No status",
    cropsTitle: "Declared crops",
    cropsDescription: "Existing records are translated in the interface. Names, quantities and dates were not changed in the database.",
    loadingCrops: "Loading crops…",
    noCrops: "No crops are declared.",
    noVariety: "Variety not recorded",
    plot: "Plot",
    unknownPlot: "Unidentified",
    plantedDate: "Recorded planting date",
    quantity: "Quantity",
  },
} as const

const regionalCatalog = {
  es: {
    vegetables: ["Papa", "Cebolla", "Zanahoria", "Betarraga", "Rabanito", "Lechuga", "Espinaca", "Acelga", "Repollo", "Arveja", "Haba", "Zapallo italiano"],
    fruits: ["Frambuesa", "Mora", "Grosella", "Murta", "Rosa mosqueta", "Membrillo", "Ciruela", "Manzana", "Castaña", "Arándano"],
    herbs: ["Perejil", "Cilantro", "Orégano", "Menta", "Tomillo", "Romero", "Albahaca bajo protección"],
  },
  en: {
    vegetables: ["Potato", "Onion", "Carrot", "Beet", "Radish", "Lettuce", "Spinach", "Swiss chard", "Cabbage", "Pea", "Broad bean", "Zucchini"],
    fruits: ["Raspberry", "Blackberry", "Currant", "Chilean guava", "Rosehip", "Quince", "Plum", "Apple", "Chestnut", "Blueberry"],
    herbs: ["Parsley", "Cilantro", "Oregano", "Mint", "Thyme", "Rosemary", "Protected basil"],
  },
} as const

const cropNames: Record<"es" | "en", Record<string, string>> = {
  es: { Tomato: "Tomate", Lettuce: "Lechuga", "Bell Pepper": "Pimentón", Carrot: "Zanahoria", Zucchini: "Zapallo italiano", Onion: "Cebolla", Basil: "Albahaca", Parsley: "Perejil", Spinach: "Espinaca", Arugula: "Rúcula", Potato: "Papa", Beet: "Betarraga", Radish: "Rabanito" },
  en: {},
}

const statuses: Record<"es" | "en", Record<string, string>> = {
  es: { active: "Activo", inactive: "Inactivo", paused: "Pausado", seedling: "Almácigo", growing: "En crecimiento", mature: "Maduro", harvested: "Cosechado" },
  en: { active: "Active", inactive: "Inactive", paused: "Paused", seedling: "Seedling", growing: "Growing", mature: "Mature", harvested: "Harvested" },
}

export default function OrchardPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const catalog = regionalCatalog[lang]
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
  const catalogCount = catalog.vegetables.length + catalog.fruits.length + catalog.herbs.length

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <div className="space-y-6 p-4 sm:p-8">
        <Card className="border-amber-300"><CardContent className="flex gap-3 p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-medium">{text.catalogWarningTitle}</p><p className="mt-1 text-sm text-muted-foreground">{text.catalogWarningBody}</p></div></CardContent></Card>
        {outdated > 0 && <Card className="border-amber-300"><CardContent className="p-5 text-sm"><p className="font-medium">{text.overdueTitle(outdated)}</p><p className="mt-1 text-muted-foreground">{text.overdueBody}</p></CardContent></Card>}
        {error && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">{text.loadError}: {error}</p><Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="mr-2 h-4 w-4" />{text.retry}</Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title={text.registeredPlots} value={plots.length} locale={locale} />
          <Metric title={text.declaredArea} value={`${totalArea.toLocaleString(locale)} m²`} locale={locale} />
          <Metric title={text.declaredCrops} value={crops.length} locale={locale} />
          <Metric title={text.regionalSpecies} value={catalogCount} locale={locale} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <CatalogCard icon={Carrot} title={text.vegetablesTitle} items={catalog.vegetables} note={text.vegetablesNote} />
          <CatalogCard icon={Apple} title={text.fruitsTitle} items={catalog.fruits} note={text.fruitsNote} />
          <CatalogCard icon={Leaf} title={text.herbsTitle} items={catalog.herbs} note={text.herbsNote} />
        </div>

        <Card>
          <CardHeader><CardTitle>{text.plotsTitle}</CardTitle><CardDescription>{text.plotsDescription}</CardDescription></CardHeader>
          <CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">{text.loadingPlots}</p> : plots.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{text.noPlots}</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plots.map((plot) => <Card key={plot.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{plot.name}</CardTitle><Badge variant="outline">{statuses[lang][plot.status ?? ""] ?? plot.status ?? text.noStatus}</Badge></div><CardDescription>{plot.description || text.noDescription}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">{text.type}:</span> {plot.plot_type}</p><p><span className="text-muted-foreground">{text.area}:</span> {Number(plot.size_sqm ?? 0).toLocaleString(locale)} m²</p><p><span className="text-muted-foreground">{text.soil}:</span> {plot.soil_type || text.noRecord}</p><p><span className="text-muted-foreground">pH:</span> {plot.ph_level ?? text.noRecord}</p><p><span className="text-muted-foreground">{text.irrigation}:</span> {plot.irrigation_type || text.noRecord}</p></CardContent></Card>)}</div>}</CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.cropsTitle}</CardTitle><CardDescription>{text.cropsDescription}</CardDescription></CardHeader>
          <CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">{text.loadingCrops}</p> : crops.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{text.noCrops}</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{crops.map((crop) => <div key={crop.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{cropNames[lang][crop.crop_name] ?? crop.crop_name}</p><p className="text-xs text-muted-foreground">{crop.variety || crop.scientific_name || text.noVariety}</p></div><Badge variant="outline">{statuses[lang][crop.status ?? ""] ?? crop.status ?? text.noStatus}</Badge></div><div className="mt-3 space-y-1 text-sm"><p><span className="text-muted-foreground">{text.plot}:</span> {plotById.get(crop.plot_id) ?? text.unknownPlot}</p><p><span className="text-muted-foreground">{text.plantedDate}:</span> {new Date(`${crop.planting_date}T12:00:00`).toLocaleDateString(locale)}</p><p><span className="text-muted-foreground">{text.quantity}:</span> {crop.quantity_planted?.toLocaleString(locale) ?? text.noRecord} {crop.planting_unit ?? ""}</p></div></div>)}</div>}</CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, locale }: { title: string; value: string | number; locale: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString(locale) : value}</div></CardContent></Card>
}

function CatalogCard({ icon: Icon, title, items, note }: { icon: typeof Sprout; title: string; items: readonly string[]; note: string }) {
  return <Card><CardHeader><div className="flex items-center gap-2"><Icon className="h-5 w-5" /><CardTitle className="text-base">{title}</CardTitle></div><CardDescription>{note}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</CardContent></Card>
}

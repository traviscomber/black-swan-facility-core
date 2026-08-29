"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, Map as MapIcon, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
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
}

type CropPhoto = {
  src: string
  alt: string
}

const unsplash = (id: string, width = 1200) => `https://unsplash.com/photos/${id}/download?force=true&w=${width}`

const PHOTOS = {
  hero: {
    src: unsplash("WHHbA0kU8Qg", 1800),
    alt: "Rows of tomato plants growing inside a greenhouse",
  },
  seedling: {
    src: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80&w=1200",
    alt: "Young seedlings growing in a garden",
  },
} as const

const CROP_PHOTOS: Record<string, CropPhoto> = {
  Tomato: { src: unsplash("WHHbA0kU8Qg"), alt: "Tomato plants growing inside a greenhouse" },
  Lettuce: { src: unsplash("SXztF2mpCTA"), alt: "Fresh green lettuce growing in a raised garden bed" },
  "Bell Pepper": { src: unsplash("ba4VaE46_7w"), alt: "Green bell pepper growing on the plant" },
  Carrot: { src: unsplash("4yK8iDaWnm8"), alt: "Freshly harvested carrots held above a garden bed" },
  Zucchini: { src: unsplash("n7x4UkfnJm4"), alt: "Zucchini plant flowering in a vegetable garden" },
  Onion: { src: unsplash("e3F37BvB5Vg"), alt: "Onions growing in soil with green leaves" },
  Basil: { src: unsplash("T4uyB67uZ40"), alt: "Fresh green basil plant" },
  Parsley: { src: unsplash("WGZv8R05LSo"), alt: "Close view of fresh parsley leaves" },
  Spinach: { src: unsplash("_38-XCxjXZ8"), alt: "Spinach growing in a home garden" },
  Arugula: { src: unsplash("vlQ0g2jCgA4"), alt: "Arugula growing in a planter" },
  Potato: { src: unsplash("R6jzDKIM-0c"), alt: "Fresh red potatoes after harvest" },
  Beet: { src: unsplash("e2TZ2eUCURw"), alt: "Fresh beetroot harvest with leafy tops" },
  Radish: { src: unsplash("jU2Vv-it18c"), alt: "Red radish growing in soil" },
}

const copy = {
  en: {
    eyebrow: "Fundo Corcovado · Orchard",
    title: "What is growing now",
    description: "A calm view of the field: what is planted, what needs attention, and what is coming next.",
    refresh: "Refresh",
    loadError: "The orchard could not be loaded",
    plots: "Plots",
    area: "Area",
    crops: "Crops",
    pending: "Pending harvests",
    fieldStatus: "Today in the field",
    overdue: "Overdue harvests",
    overdueDetail: "Records that need a field check before they can be closed.",
    upcoming: "Coming up",
    upcomingDetail: "Crops expected to reach harvest within 14 days.",
    map: "Crop map",
    mapDetail: "See where current crops and planned successions sit.",
    open: "Open",
    growing: "Growing now",
    growingDescription: "Current crop records, shown as field objects instead of a spreadsheet.",
    noCrops: "No crops are registered yet.",
    plotsTitle: "Plots",
    plotsDescription: "Physical growing areas currently registered in Orchard.",
    noPlots: "No plots are registered yet.",
    noRecord: "Not recorded",
    noStatus: "No status",
    expected: "Expected",
    planted: "Planted",
    quantity: "Quantity",
    soil: "Soil",
    irrigation: "Irrigation",
  },
  es: {
    eyebrow: "Fundo Corcovado · Huerto",
    title: "Qué está creciendo ahora",
    description: "Una vista tranquila del campo: qué está plantado, qué necesita atención y qué viene después.",
    refresh: "Actualizar",
    loadError: "No fue posible cargar el huerto",
    plots: "Sectores",
    area: "Superficie",
    crops: "Cultivos",
    pending: "Cosechas pendientes",
    fieldStatus: "Hoy en terreno",
    overdue: "Cosechas vencidas",
    overdueDetail: "Registros que necesitan revisión en terreno antes de cerrarse.",
    upcoming: "Próximamente",
    upcomingDetail: "Cultivos con cosecha prevista dentro de 14 días.",
    map: "Mapa de cultivos",
    mapDetail: "Revisa dónde están los cultivos actuales y las sucesiones planificadas.",
    open: "Abrir",
    growing: "En crecimiento",
    growingDescription: "Cultivos actuales mostrados como objetos de campo, no como planilla.",
    noCrops: "Todavía no hay cultivos registrados.",
    plotsTitle: "Sectores",
    plotsDescription: "Áreas físicas de cultivo actualmente registradas en Orchard.",
    noPlots: "Todavía no hay sectores registrados.",
    noRecord: "Sin registro",
    noStatus: "Sin estado",
    expected: "Esperada",
    planted: "Plantado",
    quantity: "Cantidad",
    soil: "Suelo",
    irrigation: "Riego",
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

function cropPhoto(name: string): CropPhoto | null {
  return CROP_PHOTOS[name] ?? null
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
      supabase.from("orchard_plots").select("id, name, plot_type, size_sqm, status, soil_type, irrigation_type, description").order("name"),
      supabase.from("orchard_crops").select("id, plot_id, crop_name, crop_type, variety, planting_date, expected_harvest_date, quantity_planted, planting_unit, status").order("expected_harvest_date"),
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
  const fourteenDaysFromNow = new Date(now)
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14)
  const upcoming = pending.filter((crop) => {
    if (!crop.expected_harvest_date) return false
    const date = new Date(`${crop.expected_harvest_date}T12:00:00`)
    return date >= now && date <= fourteenDaysFromNow
  })
  const href = (path: string) => `/${language}${path}`

  return (
    <AppLayout>
      <OrchardNavigation />
      <main className="mx-auto w-full max-w-[1560px] px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <section className="relative isolate min-h-[440px] overflow-hidden rounded-[28px] bg-neutral-950 sm:min-h-[500px]">
          <img src={PHOTOS.hero.src} alt={PHOTOS.hero.alt} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
          <div className="relative flex min-h-[440px] max-w-3xl flex-col justify-end p-6 text-white sm:min-h-[500px] sm:p-10 lg:p-14">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-white/65">{text.eyebrow}</p>
            <h1 className="max-w-2xl text-4xl font-medium tracking-[-0.04em] sm:text-6xl lg:text-7xl">{text.title}</h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/75 sm:text-base">{text.description}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild className="bg-white text-black hover:bg-white/90"><Link href={href("/orchard/field")}>{lang === "es" ? "Abrir terreno" : "Open field mode"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading} className="border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>
            </div>
          </div>
          <div className="absolute bottom-6 right-6 hidden rounded-2xl border border-white/15 bg-black/30 px-5 py-4 text-white backdrop-blur-md md:block">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <HeroMetric label={text.plots} value={plots.length.toLocaleString(locale)} />
              <HeroMetric label={text.area} value={`${totalArea.toLocaleString(locale)} m²`} />
              <HeroMetric label={text.crops} value={crops.length.toLocaleString(locale)} />
              <HeroMetric label={text.pending} value={pending.length.toLocaleString(locale)} />
            </div>
          </div>
        </section>

        {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{text.loadError}: {error}</div>}

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">01</p><h2 className="mt-2 text-2xl font-medium tracking-tight">{text.fieldStatus}</h2></div></div>
          <div className="grid gap-3 lg:grid-cols-3">
            <ActionCard href={href("/orchard/harvest")} icon={AlertTriangle} title={text.overdue} value={overdue.length} detail={text.overdueDetail} warning={overdue.length > 0} />
            <ActionCard href={href("/orchard/harvest")} icon={CalendarClock} title={text.upcoming} value={upcoming.length} detail={text.upcomingDetail} />
            <ActionCard href={href("/orchard/crop-map")} icon={MapIcon} title={text.map} value={plots.length} detail={text.mapDetail} />
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">02</p><h2 className="mt-2 text-2xl font-medium tracking-tight">{text.growing}</h2><p className="mt-1 text-sm text-muted-foreground">{text.growingDescription}</p></div><Link href={href("/orchard/crops")} className="hidden items-center gap-1 text-sm font-medium sm:inline-flex">{text.open}<ArrowRight className="h-4 w-4" /></Link></div>
          {loading ? <div className="h-72 animate-pulse rounded-3xl bg-muted" /> : crops.length === 0 ? <div className="rounded-3xl border border-dashed py-16 text-center"><Sprout className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{text.noCrops}</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{crops.slice(0, 6).map((crop) => <CropCard key={crop.id} crop={crop} lang={lang} locale={locale} plotName={plotById.get(crop.plot_id) ?? text.noRecord} text={text} />)}</div>}
        </section>

        <section className="mt-14 border-t pt-10">
          <div className="mb-5"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">03</p><h2 className="mt-2 text-2xl font-medium tracking-tight">{text.plotsTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{text.plotsDescription}</p></div>
          {plots.length === 0 ? <p className="py-8 text-sm text-muted-foreground">{text.noPlots}</p> : <div className="divide-y">{plots.map((plot) => <div key={plot.id} className="grid gap-4 py-5 sm:grid-cols-[1.3fr_.7fr_.7fr_.7fr] sm:items-center"><div><div className="flex items-center gap-2"><p className="font-medium">{plot.name}</p><Badge variant="outline" className="rounded-full">{statuses[lang][plot.status ?? ""] ?? plot.status ?? text.noStatus}</Badge></div><p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{plot.description || plot.plot_type}</p></div><SmallMeta label={text.area} value={`${Number(plot.size_sqm ?? 0).toLocaleString(locale)} m²`} /><SmallMeta label={text.soil} value={plot.soil_type || text.noRecord} /><SmallMeta label={text.irrigation} value={plot.irrigation_type || text.noRecord} /></div>)}</div>}
        </section>

        <p className="mt-10 text-[11px] text-muted-foreground">Reference photography used under the Unsplash License. Crop images are mapped by crop identity; unknown crops intentionally show a neutral botanical fallback instead of a misleading crop photo. Field evidence will replace reference imagery as Orchard photo records are added.</p>
      </main>
    </AppLayout>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-[0.16em] text-white/55">{label}</p><p className="mt-1 text-lg font-medium tabular-nums">{value}</p></div>
}

function ActionCard({ href, icon: Icon, title, value, detail, warning = false }: { href: string; icon: typeof AlertTriangle; title: string; value: number; detail: string; warning?: boolean }) {
  return <Link href={href} className={`group rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${warning ? "border-amber-400/40 bg-amber-500/5" : "bg-background"}`}><div className="flex items-start justify-between gap-5"><div><div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-muted"><Icon className="h-4 w-4" /></div><h3 className="font-medium">{title}</h3><p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{detail}</p></div><span className="text-3xl font-medium tabular-nums">{value}</span></div><span className="mt-5 inline-flex items-center gap-1 text-xs font-medium">Open<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span></Link>
}

function CropCard({ crop, lang, locale, plotName, text }: { crop: Crop; lang: "en" | "es"; locale: string; plotName: string; text: (typeof copy)["en"] | (typeof copy)["es"] }) {
  const photo = cropPhoto(crop.crop_name)

  return <article className="group overflow-hidden rounded-3xl border bg-background"><div className="relative aspect-[4/3] overflow-hidden bg-muted">{photo ? <img src={photo.src} alt={photo.alt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-950/30 via-muted to-background"><Sprout className="h-12 w-12 text-muted-foreground/60" aria-hidden="true" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" /><div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white"><div><p className="text-xl font-medium tracking-tight">{cropNames[lang][crop.crop_name] ?? crop.crop_name}</p><p className="mt-0.5 text-xs text-white/70">{crop.variety || plotName}</p></div><Badge className="border-white/20 bg-black/35 text-white backdrop-blur">{statuses[lang][crop.status ?? ""] ?? crop.status ?? text.noStatus}</Badge></div></div><div className="grid grid-cols-3 divide-x border-t"><SmallMeta className="p-4" label={text.planted} value={new Date(`${crop.planting_date}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short" })} /><SmallMeta className="p-4" label={text.expected} value={crop.expected_harvest_date ? new Date(`${crop.expected_harvest_date}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : text.noRecord} /><SmallMeta className="p-4" label={text.quantity} value={`${Number(crop.quantity_planted ?? 0).toLocaleString(locale)} ${crop.planting_unit || ""}`} /></div></article>
}

function SmallMeta({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={className}><p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-medium">{value}</p></div>
}

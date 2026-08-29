"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, GitBranch, History, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Lifecycle = {
  crop_succession_id: string
  crop_cycle_id: string
  sequence_no: number
  persisted_status: string
  effective_status: string
  lifecycle_source: string
  lifecycle_updated_at: string
  planned_sow_date: string
  planned_transplant_date: string | null
  planned_first_harvest_date: string | null
  planned_last_harvest_date: string | null
  seeds_sown: number
  transplanted_count: number
  first_planting_date: string | null
  first_harvest_date: string | null
  harvest_passes: number
}

type Cycle = { id: string; crop_name: string; variety: string | null }
type HistoryRow = { id: string; crop_succession_id: string; from_status: string | null; to_status: string; source: string; reason: string | null; changed_at: string }

const stages = ["planned", "nursery", "hardening", "transplanted", "growing", "harvest_ready", "harvesting", "completed"] as const
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=92`
const cropPhoto = (name: string) => {
  const key = name.toLowerCase()
  if (key.includes("tomato")) return photo("photo-1592924357228-91a4daadcfea")
  if (key.includes("lettuce")) return photo("photo-1622206151226-18ca2c9ab4a1")
  if (key.includes("radish")) return photo("photo-1582284540020-8acbe03f4924")
  if (key.includes("onion")) return photo("photo-1508747703725-719777637510")
  if (key.includes("carrot")) return photo("photo-1447175008436-054170c2e979")
  if (key.includes("arugula") || key.includes("rocket")) return photo("photo-1501004318641-b39e6451bec6")
  if (key.includes("spinach")) return photo("photo-1576045057995-568f588f82fb")
  if (key.includes("basil")) return photo("photo-1618375569909-3c8616cf7733")
  return photo("photo-1416879595882-3373a0480b5b")
}

const copy = {
  en: {
    title: "Crop Lifecycle",
    description: "Follow each succession from planning through nursery, field growth and harvest with automatic operational state.",
    refresh: "Refresh",
    noRows: "No planned successions yet.",
    lifecycle: "Crop journeys",
    source: "Automated source",
    sow: "Sow",
    transplant: "Field entry",
    firstHarvest: "First harvest",
    seeds: "Seeds sown",
    transplanted: "Transplanted",
    passes: "Harvest passes",
    history: "Lifecycle history",
    historyHelp: "Every automatic transition is retained as operational evidence.",
    noHistory: "No automatic transitions recorded yet.",
    loadError: "Could not load lifecycle data",
    persisted: "Persisted",
    effective: "Effective",
    drift: "State drift",
    journey: "Live crop journey",
    journeyHelp: "See what stage every succession is in, what evidence moved it there, and what milestone comes next.",
    active: "Active successions",
    completed: "Completed",
    driftCount: "State drifts",
    harvestReady: "Harvest ready",
    openCrop: "Open crops",
    care: "Care",
    health: "Health",
    currentStage: "Current stage",
    nextMilestone: "Next milestone",
    evidence: "Operational evidence",
  },
  es: {
    title: "Ciclo del Cultivo",
    description: "Sigue cada sucesión desde planificación y vivero hasta crecimiento y cosecha con estado operacional automático.",
    refresh: "Actualizar",
    noRows: "Aún no hay sucesiones planificadas.",
    lifecycle: "Recorridos de cultivo",
    source: "Fuente automática",
    sow: "Siembra",
    transplant: "Entrada a terreno",
    firstHarvest: "Primera cosecha",
    seeds: "Semillas sembradas",
    transplanted: "Trasplantadas",
    passes: "Pasadas de cosecha",
    history: "Historial del ciclo",
    historyHelp: "Cada transición automática queda registrada como evidencia operacional.",
    noHistory: "Aún no hay transiciones automáticas registradas.",
    loadError: "No fue posible cargar el ciclo",
    persisted: "Persistido",
    effective: "Efectivo",
    drift: "Desviación de estado",
    journey: "Recorrido vivo del cultivo",
    journeyHelp: "Ve en qué etapa está cada sucesión, qué evidencia la movió y cuál es el próximo hito.",
    active: "Sucesiones activas",
    completed: "Completadas",
    driftCount: "Desviaciones",
    harvestReady: "Listas para cosecha",
    openCrop: "Abrir cultivos",
    care: "Cuidados",
    health: "Sanidad",
    currentStage: "Etapa actual",
    nextMilestone: "Próximo hito",
    evidence: "Evidencia operacional",
  },
} as const

const dateLabel = (value: string | null, locale: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—"
const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())

function nextMilestone(row: Lifecycle, text: (typeof copy)["en"], locale: string) {
  if (["planned", "nursery", "hardening"].includes(row.effective_status) && row.planned_transplant_date) return `${text.transplant} · ${dateLabel(row.planned_transplant_date, locale)}`
  if (["transplanted", "growing"].includes(row.effective_status) && row.planned_first_harvest_date) return `${text.firstHarvest} · ${dateLabel(row.planned_first_harvest_date, locale)}`
  if (row.effective_status === "harvest_ready") return titleize("harvesting")
  if (row.effective_status === "harvesting" && row.planned_last_harvest_date) return `${titleize("completed")} · ${dateLabel(row.planned_last_harvest_date, locale)}`
  return titleize(row.effective_status === "completed" ? "completed" : "in progress")
}

export default function OrchardLifecyclePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [rows, setRows] = useState<Lifecycle[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [lifecycle, cycleRows, historyRows] = await Promise.all([
      supabase.from("orchard_succession_lifecycle").select("crop_succession_id,crop_cycle_id,sequence_no,persisted_status,effective_status,lifecycle_source,lifecycle_updated_at,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,seeds_sown,transplanted_count,first_planting_date,first_harvest_date,harvest_passes").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id,crop_name,variety"),
      supabase.from("orchard_succession_lifecycle_history").select("id,crop_succession_id,from_status,to_status,source,reason,changed_at").order("changed_at", { ascending: false }).limit(100),
    ])
    const queryError = lifecycle.error ?? cycleRows.error ?? historyRows.error
    if (queryError) setError(`${text.loadError}: ${queryError.message}`)
    else {
      setRows((lifecycle.data ?? []) as Lifecycle[])
      setCycles((cycleRows.data ?? []) as Cycle[])
      setHistory((historyRows.data ?? []) as HistoryRow[])
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const cycleById = useMemo(() => new Map(cycles.map((cycle) => [cycle.id, cycle])), [cycles])
  const successionLabel = (row: Lifecycle) => {
    const cycle = cycleById.get(row.crop_cycle_id)
    return cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${row.sequence_no}` : `#${row.sequence_no}`
  }
  const rowById = useMemo(() => new Map(rows.map((row) => [row.crop_succession_id, row])), [rows])
  const stageCounts = stages.map((stage) => ({ stage, count: rows.filter((row) => row.effective_status === stage).length }))
  const active = rows.filter((row) => row.effective_status !== "completed").length
  const completed = rows.filter((row) => row.effective_status === "completed").length
  const driftCount = rows.filter((row) => row.persisted_status !== row.effective_status).length
  const harvestReady = rows.filter((row) => row.effective_status === "harvest_ready" || row.effective_status === "harvesting").length

  return (
    <AppLayout>
      <OrchardNavigation />
      <main className="mx-auto w-full max-w-[1560px] space-y-8 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <section className="relative isolate min-h-[360px] overflow-hidden bg-neutral-950 sm:min-h-[420px]">
          <img src={photo("photo-1500595046743-cd271d694d30")} alt="Healthy crop rows progressing through the season" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.86)_0%,rgba(0,0,0,.48)_58%,rgba(0,0,0,.16)_100%)]" />
          <div className="relative flex min-h-[360px] max-w-3xl flex-col justify-end p-6 text-white sm:min-h-[420px] sm:p-10">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Orchard · Operations</p>
            <h1 className="mt-3 text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{text.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/75">{text.journeyHelp}</p>
            <div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => void load()} disabled={loading} className="bg-white text-black hover:bg-white/90"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button><Button asChild variant="outline" className="border-white/25 bg-black/25 text-white hover:bg-white/10 hover:text-white"><Link href={`/${language}/orchard/crops`}><Sprout className="mr-2 h-4 w-4" />{text.openCrop}</Link></Button></div>
          </div>
          <div className="absolute bottom-6 right-6 hidden grid-cols-2 gap-px bg-white/10 lg:grid"><HeroMetric label={text.active} value={active} /><HeroMetric label={text.harvestReady} value={harvestReady} /><HeroMetric label={text.driftCount} value={driftCount} /><HeroMetric label={text.completed} value={completed} /></div>
        </section>

        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <section>
          <div className="mb-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">01</p><h2 className="mt-2">{text.currentStage}</h2><p className="mt-1 text-sm text-muted-foreground">{text.description}</p></div>
          <div className="grid gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {stageCounts.map(({ stage, count }, index) => <div key={stage} className="relative min-h-28 bg-background p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><span className="text-2xl font-medium tabular-nums">{count}</span></div><p className="mt-5 text-sm font-medium">{titleize(stage)}</p>{index < stages.length - 1 && <ArrowRight className="absolute right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/50 xl:block" />}</div>)}
          </div>
        </section>

        <section>
          <div className="mb-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">02</p><h2 className="mt-2 flex items-center gap-2"><GitBranch className="h-5 w-5" />{text.lifecycle}</h2><p className="mt-1 text-sm text-muted-foreground">{text.journeyHelp}</p></div>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <div className="border border-dashed p-6 text-sm text-muted-foreground">{text.noRows}</div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => {
            const cycle = cycleById.get(row.crop_cycle_id)
            const drift = row.persisted_status !== row.effective_status
            const currentIndex = Math.max(0, stages.indexOf(row.effective_status as (typeof stages)[number]))
            return <article key={row.crop_succession_id} className="overflow-hidden border bg-background"><div className="relative h-44 overflow-hidden"><img src={cropPhoto(cycle?.crop_name ?? "crop")} alt={cycle?.crop_name ?? "Crop"} className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.08)_76%)]" /><div className="absolute inset-x-4 bottom-4 text-white"><div className="mb-2 flex flex-wrap gap-2"><Badge className="border-white/20 bg-black/35 text-white">{titleize(row.effective_status)}</Badge>{drift && <Badge variant="destructive">{text.drift}</Badge>}</div><h3 className="text-xl text-white!">{successionLabel(row)}</h3><p className="mt-1 text-xs text-white/70">{text.source}: {titleize(row.lifecycle_source)}</p></div></div><div className="space-y-4 p-4">
              <div><div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{text.currentStage}</span><span>{currentIndex + 1}/{stages.length}</span></div><div className="grid grid-cols-8 gap-1">{stages.map((stage, index) => <div key={stage} title={titleize(stage)} className={`h-1.5 ${index <= currentIndex ? "bg-foreground" : "bg-muted"}`} />)}</div></div>
              <div className="grid grid-cols-2 gap-px bg-border"><Datum label={text.sow} value={dateLabel(row.planned_sow_date, locale)} /><Datum label={text.transplant} value={dateLabel(row.first_planting_date ?? row.planned_transplant_date, locale)} /><Datum label={text.firstHarvest} value={dateLabel(row.first_harvest_date ?? row.planned_first_harvest_date, locale)} /><Datum label={text.passes} value={String(row.harvest_passes)} /></div>
              <div className="border-t pt-3"><p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{text.nextMilestone}</p><p className="mt-1 text-sm font-medium">{nextMilestone(row, text as (typeof copy)["en"], locale)}</p></div>
              <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/${language}/orchard/care`}>{text.care}</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/${language}/orchard/pests`}>{text.health}</Link></Button><Badge variant="secondary" className="ml-auto">{row.seeds_sown} {text.seeds.toLowerCase()}</Badge></div>
            </div></article>
          })}</div>}
        </section>

        <section>
          <div className="mb-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">03</p><h2 className="mt-2 flex items-center gap-2"><History className="h-5 w-5" />{text.history}</h2><p className="mt-1 text-sm text-muted-foreground">{text.historyHelp}</p></div>
          {history.length === 0 ? <div className="border border-dashed p-6 text-sm text-muted-foreground">{text.noHistory}</div> : <div className="grid gap-3 lg:grid-cols-2">{history.map((event) => { const row = rowById.get(event.crop_succession_id); const cycle = row ? cycleById.get(row.crop_cycle_id) : null; return <article key={event.id} className="grid grid-cols-[72px_1fr] overflow-hidden border bg-background"><div className="relative min-h-28"><img src={cropPhoto(cycle?.crop_name ?? "crop")} alt={cycle?.crop_name ?? "Crop"} className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-black/35" /></div><div className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium">{row ? successionLabel(row) : event.crop_succession_id}</p><p className="mt-1 text-xs text-muted-foreground">{event.source}{event.reason ? ` · ${event.reason}` : ""}</p></div><span className="text-xs text-muted-foreground">{new Date(event.changed_at).toLocaleString(locale)}</span></div><div className="mt-4 flex items-center gap-2"><Badge variant="outline">{event.from_status ? titleize(event.from_status) : "—"}</Badge><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /><Badge>{titleize(event.to_status)}</Badge></div></div></article> })}</div>}
        </section>
      </main>
    </AppLayout>
  )
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="bg-background p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
function HeroMetric({ label, value }: { label: string; value: number }) { return <div className="min-w-32 bg-black/45 px-5 py-4 text-white"><p className="text-[10px] uppercase tracking-[0.14em] text-white/55">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{value}</p></div> }

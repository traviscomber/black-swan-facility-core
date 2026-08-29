"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { GitBranch, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
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
type History = { id: string; crop_succession_id: string; from_status: string | null; to_status: string; source: string; reason: string | null; changed_at: string }

const stages = ["planned", "nursery", "hardening", "transplanted", "growing", "harvest_ready", "harvesting", "completed"] as const
const copy = {
  en: {
    title: "Crop Lifecycle",
    description: "Automatic operational state derived from Nursery, live crops, planned dates and harvest events.",
    refresh: "Refresh",
    noRows: "No planned successions yet.",
    lifecycle: "Lifecycle state",
    source: "Last automated source",
    sow: "Sow",
    transplant: "Transplant",
    firstHarvest: "First harvest",
    seeds: "Seeds sown",
    transplanted: "Transplanted",
    passes: "Harvest passes",
    history: "Lifecycle history",
    historyHelp: "Every automatic state transition is retained as operational evidence.",
    noHistory: "No automatic transitions recorded yet.",
    loadError: "Could not load lifecycle data",
    persisted: "Persisted",
    effective: "Effective",
    drift: "Date-derived state is ahead of persisted state",
  },
  es: {
    title: "Ciclo del Cultivo",
    description: "Estado operacional automático derivado de Nursery, cultivos vivos, fechas planificadas y eventos de cosecha.",
    refresh: "Actualizar",
    noRows: "Aún no hay sucesiones planificadas.",
    lifecycle: "Estado del ciclo",
    source: "Última fuente automática",
    sow: "Siembra",
    transplant: "Trasplante",
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
    drift: "El estado derivado por fecha está adelantado al persistido",
  },
} as const

const dateLabel = (value: string | null, locale: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale) : "—"
const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function OrchardLifecyclePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [rows, setRows] = useState<Lifecycle[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [history, setHistory] = useState<History[]>([])
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
      setHistory((historyRows.data ?? []) as History[])
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

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>} />
      <OrchardNavigation />
      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {stageCounts.map(({ stage, count }) => <Card key={stage}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{titleize(stage)}</p><p className="mt-1 text-2xl font-semibold">{count}</p></CardContent></Card>)}
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5" />{text.lifecycle}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">{text.noRows}</p> : <div className="space-y-3">{rows.map((row) => {
              const drift = row.persisted_status !== row.effective_status
              return <div key={row.crop_succession_id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{successionLabel(row)}</p><div className="mt-2 flex flex-wrap gap-2"><Badge>{titleize(row.effective_status)}</Badge>{drift && <Badge variant="outline">{text.drift}</Badge>}<Badge variant="secondary">{row.lifecycle_source}</Badge></div></div><div className="text-right text-xs text-muted-foreground"><div>{text.persisted}: {titleize(row.persisted_status)}</div><div>{text.effective}: {titleize(row.effective_status)}</div></div></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-6"><Datum label={text.sow} value={dateLabel(row.planned_sow_date, locale)} /><Datum label={text.transplant} value={dateLabel(row.first_planting_date ?? row.planned_transplant_date, locale)} /><Datum label={text.firstHarvest} value={dateLabel(row.first_harvest_date ?? row.planned_first_harvest_date, locale)} /><Datum label={text.seeds} value={String(row.seeds_sown)} /><Datum label={text.transplanted} value={String(row.transplanted_count)} /><Datum label={text.passes} value={String(row.harvest_passes)} /></div></div>
            })}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.history}</CardTitle><CardDescription>{text.historyHelp}</CardDescription></CardHeader>
          <CardContent>{history.length === 0 ? <p className="text-sm text-muted-foreground">{text.noHistory}</p> : <div className="space-y-2">{history.map((event) => { const row = rowById.get(event.crop_succession_id); return <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{row ? successionLabel(row) : event.crop_succession_id}</p><p className="text-xs text-muted-foreground">{event.source}{event.reason ? ` · ${event.reason}` : ""}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{event.from_status ? titleize(event.from_status) : "—"}</Badge><span className="text-muted-foreground">→</span><Badge>{titleize(event.to_status)}</Badge><span className="text-xs text-muted-foreground">{new Date(event.changed_at).toLocaleString(locale)}</span></div></div> })}</div>}</CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div> }

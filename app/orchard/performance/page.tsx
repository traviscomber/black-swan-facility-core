"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, CalendarClock, Leaf, RefreshCw, Sprout, Target } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Succession = {
  id: string
  crop_cycle_id: string
  sequence_no: number
  planned_sow_date: string
  planned_transplant_date: string | null
  planned_first_harvest_date: string | null
  planned_last_harvest_date: string | null
  planned_plants: number | null
  planned_area_sqm: number | null
  status: string
}

type Cycle = { id: string; crop_name: string; variety: string | null }
type Nursery = { crop_succession_id: string; sow_date: string; transplant_date: string | null; transplanted_count: number | null; ready_count: number | null; loss_count: number; status: string }
type Crop = { id: string; crop_succession_id: string | null; planting_date: string | null; actual_harvest_date: string | null; quantity_planted: number | null; estimated_yield: number | null; actual_yield: number | null; yield_unit: string | null; status: string }
type Harvest = { crop_succession_id: string | null; crop_id: string; harvest_date: string; quantity_harvested: number | null; harvest_unit: string | null }

type Row = {
  succession: Succession
  label: string
  actualSow: string | null
  actualTransplant: string | null
  actualFirstHarvest: string | null
  actualLastHarvest: string | null
  actualPlants: number | null
  nurseryLosses: number
  harvestQuantity: number | null
  harvestUnit: string | null
  cropYield: number | null
  cropYieldUnit: string | null
}

const copy = {
  en: {
    title: "Plan vs Actual",
    description: "Compare planned crop timing and volume with real nursery, planting and harvest execution.",
    refresh: "Refresh",
    successions: "Planned successions",
    started: "Started",
    onTime: "On-time starts",
    harvested: "Harvested",
    timing: "Timing variance",
    timingHelp: "Actual nursery sow, field planting and first harvest compared with the planned succession dates.",
    volume: "Volume variance",
    volumeHelp: "Planned plants compared with recorded transplanted or planted quantities. Harvest quantities stay separated by unit.",
    succession: "Succession",
    sow: "Sow",
    transplant: "Transplant",
    firstHarvest: "First harvest",
    plants: "Plants",
    losses: "Nursery losses",
    harvest: "Harvest",
    planned: "Planned",
    actual: "Actual",
    variance: "Variance",
    noActual: "No actual yet",
    noData: "No crop successions available yet.",
    loadError: "Could not load plan-vs-actual data",
    daysEarly: "days early",
    daysLate: "days late",
    onPlan: "on plan",
    notPlanned: "not planned",
    coverage: "Execution coverage",
  },
  es: {
    title: "Plan vs Real",
    description: "Compara fechas y volúmenes planificados con la ejecución real de almácigo, plantación y cosecha.",
    refresh: "Actualizar",
    successions: "Sucesiones planificadas",
    started: "Iniciadas",
    onTime: "Inicios a tiempo",
    harvested: "Cosechadas",
    timing: "Variación de fechas",
    timingHelp: "Siembra real en almácigo, plantación en terreno y primera cosecha comparadas con las fechas planificadas.",
    volume: "Variación de volumen",
    volumeHelp: "Plantas planificadas comparadas con trasplantes o plantaciones registradas. Las cosechas se mantienen separadas por unidad.",
    succession: "Sucesión",
    sow: "Siembra",
    transplant: "Trasplante",
    firstHarvest: "Primera cosecha",
    plants: "Plantas",
    losses: "Pérdidas de almácigo",
    harvest: "Cosecha",
    planned: "Plan",
    actual: "Real",
    variance: "Variación",
    noActual: "Sin real aún",
    noData: "Aún no hay sucesiones de cultivo.",
    loadError: "No fue posible cargar plan vs real",
    daysEarly: "días antes",
    daysLate: "días tarde",
    onPlan: "en fecha",
    notPlanned: "sin plan",
    coverage: "Cobertura de ejecución",
  },
} as const

const daysBetween = (planned: string | null, actual: string | null) => {
  if (!planned || !actual) return null
  const a = new Date(`${planned}T12:00:00`).getTime()
  const b = new Date(`${actual}T12:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

const firstDate = (values: Array<string | null | undefined>) => values.filter(Boolean).sort()[0] ?? null
const lastDate = (values: Array<string | null | undefined>) => values.filter(Boolean).sort().at(-1) ?? null

export default function OrchardPerformancePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [nursery, setNursery] = useState<Nursery[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [harvests, setHarvests] = useState<Harvest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [s, cy, n, c, h] = await Promise.all([
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_sow_date, planned_transplant_date, planned_first_harvest_date, planned_last_harvest_date, planned_plants, planned_area_sqm, status").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id, crop_name, variety"),
      supabase.from("orchard_nursery_batches").select("crop_succession_id, sow_date, transplant_date, transplanted_count, ready_count, loss_count, status"),
      supabase.from("orchard_crops").select("id, crop_succession_id, planting_date, actual_harvest_date, quantity_planted, estimated_yield, actual_yield, yield_unit, status"),
      supabase.from("orchard_harvest_records").select("crop_succession_id, crop_id, harvest_date, quantity_harvested, harvest_unit"),
    ])
    const queryError = s.error ?? cy.error ?? n.error ?? c.error ?? h.error
    if (queryError) setError(`${text.loadError}: ${queryError.message}`)
    else {
      setSuccessions((s.data ?? []) as Succession[])
      setCycles((cy.data ?? []) as Cycle[])
      setNursery((n.data ?? []) as Nursery[])
      setCrops((c.data ?? []) as Crop[])
      setHarvests((h.data ?? []) as Harvest[])
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const rows = useMemo<Row[]>(() => successions.map((succession) => {
    const cycle = cycleById.get(succession.crop_cycle_id)
    const nurseryRows = nursery.filter((item) => item.crop_succession_id === succession.id)
    const cropRows = crops.filter((item) => item.crop_succession_id === succession.id)
    const cropIds = new Set(cropRows.map((item) => item.id))
    const harvestRows = harvests.filter((item) => item.crop_succession_id === succession.id || cropIds.has(item.crop_id))
    const harvestUnits = [...new Set(harvestRows.map((item) => item.harvest_unit).filter(Boolean))]
    const harvestQuantity = harvestUnits.length === 1 ? harvestRows.reduce((sum, item) => sum + (item.quantity_harvested ?? 0), 0) : null
    const transplanted = nurseryRows.reduce((sum, item) => sum + (item.transplanted_count ?? 0), 0)
    const planted = cropRows.reduce((sum, item) => sum + (item.quantity_planted ?? 0), 0)
    const yields = cropRows.filter((item) => item.actual_yield != null)
    const yieldUnits = [...new Set(yields.map((item) => item.yield_unit).filter(Boolean))]
    return {
      succession,
      label: `${cycle?.crop_name ?? "Crop"}${cycle?.variety ? ` · ${cycle.variety}` : ""} #${succession.sequence_no}`,
      actualSow: firstDate(nurseryRows.map((item) => item.sow_date)),
      actualTransplant: firstDate([...nurseryRows.map((item) => item.transplant_date), ...cropRows.map((item) => item.planting_date)]),
      actualFirstHarvest: firstDate([...harvestRows.map((item) => item.harvest_date), ...cropRows.map((item) => item.actual_harvest_date)]),
      actualLastHarvest: lastDate(harvestRows.map((item) => item.harvest_date)),
      actualPlants: transplanted > 0 ? transplanted : planted > 0 ? planted : null,
      nurseryLosses: nurseryRows.reduce((sum, item) => sum + (item.loss_count ?? 0), 0),
      harvestQuantity,
      harvestUnit: harvestUnits.length === 1 ? harvestUnits[0] as string : null,
      cropYield: yieldUnits.length === 1 ? yields.reduce((sum, item) => sum + (item.actual_yield ?? 0), 0) : null,
      cropYieldUnit: yieldUnits.length === 1 ? yieldUnits[0] as string : null,
    }
  }), [successions, cycleById, nursery, crops, harvests])

  const started = rows.filter((row) => row.actualSow || row.actualTransplant).length
  const onTime = rows.filter((row) => {
    const delta = daysBetween(row.succession.planned_sow_date, row.actualSow)
    return delta != null && Math.abs(delta) <= 3
  }).length
  const harvested = rows.filter((row) => row.actualFirstHarvest).length
  const coverage = rows.length ? Math.round((started / rows.length) * 100) : 0

  const varianceLabel = (planned: string | null, actual: string | null) => {
    if (!actual) return text.noActual
    if (!planned) return text.notPlanned
    const delta = daysBetween(planned, actual)
    if (delta === 0) return text.onPlan
    if (delta == null) return text.noActual
    return delta < 0 ? `${Math.abs(delta)} ${text.daysEarly}` : `${delta} ${text.daysLate}`
  }

  const dateLabel = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale) : "—"

  return <AppLayout>
    <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>} />
    <OrchardNavigation />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Target} label={text.successions} value={rows.length.toString()} />
        <Metric icon={Sprout} label={text.started} value={started.toString()} />
        <Metric icon={CalendarClock} label={text.onTime} value={onTime.toString()} />
        <Metric icon={Leaf} label={text.harvested} value={harvested.toString()} />
        <Metric icon={Activity} label={text.coverage} value={`${coverage}%`} />
      </div>

      <Card>
        <CardHeader><CardTitle>{text.timing}</CardTitle><CardDescription>{text.timingHelp}</CardDescription></CardHeader>
        <CardContent>{rows.length === 0 ? <p className="py-8 text-sm text-muted-foreground">{text.noData}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-3 pr-4">{text.succession}</th><th className="px-3 py-3">{text.sow}</th><th className="px-3 py-3">{text.transplant}</th><th className="px-3 py-3">{text.firstHarvest}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.succession.id} className="border-b last:border-0"><td className="py-4 pr-4 align-top"><p className="font-medium">{row.label}</p><Badge className="mt-2" variant="outline">{row.succession.status}</Badge></td><TimingCell planned={row.succession.planned_sow_date} actual={row.actualSow} variance={varianceLabel(row.succession.planned_sow_date, row.actualSow)} dateLabel={dateLabel} text={text} /><TimingCell planned={row.succession.planned_transplant_date} actual={row.actualTransplant} variance={varianceLabel(row.succession.planned_transplant_date, row.actualTransplant)} dateLabel={dateLabel} text={text} /><TimingCell planned={row.succession.planned_first_harvest_date} actual={row.actualFirstHarvest} variance={varianceLabel(row.succession.planned_first_harvest_date, row.actualFirstHarvest)} dateLabel={dateLabel} text={text} /></tr>)}</tbody></table></div>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{text.volume}</CardTitle><CardDescription>{text.volumeHelp}</CardDescription></CardHeader>
        <CardContent>{rows.length === 0 ? <p className="py-8 text-sm text-muted-foreground">{text.noData}</p> : <div className="grid gap-3 lg:grid-cols-2">{rows.map((row) => { const plan = row.succession.planned_plants ?? 0; const actual = row.actualPlants; const pct = plan > 0 && actual != null ? Math.round((actual / plan) * 100) : null; return <div key={row.succession.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.label}</p><p className="mt-1 text-xs text-muted-foreground">{text.plants}: {plan.toLocaleString(locale)} {text.planned.toLowerCase()} · {actual == null ? text.noActual : `${actual.toLocaleString(locale)} ${text.actual.toLowerCase()}`}</p></div>{pct != null && <Badge variant={pct >= 90 ? "secondary" : "outline"}>{pct}%</Badge>}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground" style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">{text.losses}</p><p className="mt-1 font-medium">{row.nurseryLosses.toLocaleString(locale)}</p></div><div><p className="text-muted-foreground">{text.harvest}</p><p className="mt-1 font-medium">{row.harvestQuantity != null && row.harvestUnit ? `${row.harvestQuantity.toLocaleString(locale)} ${row.harvestUnit}` : row.cropYield != null && row.cropYieldUnit ? `${row.cropYield.toLocaleString(locale)} ${row.cropYieldUnit}` : "—"}</p></div></div></div> })}</div>}</CardContent>
      </Card>
    </div>
  </AppLayout>
}

function TimingCell({ planned, actual, variance, dateLabel, text }: { planned: string | null; actual: string | null; variance: string; dateLabel: (value: string | null) => string; text: typeof copy.en | typeof copy.es }) {
  const delta = daysBetween(planned, actual)
  const variant = delta == null ? "outline" : Math.abs(delta) <= 3 ? "secondary" : "destructive"
  return <td className="px-3 py-4 align-top"><div className="space-y-1"><p><span className="text-muted-foreground">{text.planned}:</span> {dateLabel(planned)}</p><p><span className="text-muted-foreground">{text.actual}:</span> {dateLabel(actual)}</p><Badge variant={variant}>{variance}</Badge></div></td>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-2xl font-semibold">{value}</p></div></CardContent></Card>
}

"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Lifecycle = { crop_succession_id: string; crop_cycle_id: string; sequence_no: number; persisted_status: string; effective_status: string; planned_sow_date: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null; planned_last_harvest_date: string | null; transplanted_count: number; first_planting_date: string | null; first_harvest_date: string | null; harvest_passes: number }
type Succession = { id: string; crop_cycle_id: string; planned_plants: number | null; germination_rate_pct: number | null; seeds_per_plant: number | null; status: string }
type Cycle = { id: string; crop_name: string; variety: string | null }
type SeedLot = { id: string; crop_name: string; variety: string | null; lot_code: string | null; quantity_seeds: number; expiry_date: string | null }
type Allocation = { id: string; bed_id: string; crop_succession_id: string; planned_start_date: string; planned_end_date: string; allocated_area_sqm: number | null }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string }
type Pest = { id: string; crop_id: string; observation_date: string; pest_type: string | null; disease_name: string | null; severity_level: string | null; affected_percentage: number | null; treatment_applied: string | null; treatment_effectiveness: string | null }
type Crop = { id: string; crop_succession_id: string | null; crop_name: string; variety: string | null; status: string; estimated_yield: number | null; actual_yield: number | null; yield_unit: string | null }
type Task = { id: string; title: string; priority: string | null; status: string; due_date: string | null; estimated_minutes: number | null; source_id: string | null; source_type: string | null }
type Assignment = { task_id: string; employee_id: string | null }

type Decision = { id: string; severity: "critical" | "attention" | "ready" | "watch"; category: string; title: string; detail: string; rule: string; href: string }

const copy = {
  en: {
    title: "Decision Engine",
    description: "Deterministic operational exceptions from canonical Orchard data. Every alert shows the rule that produced it; no AI judgment is used here.",
    refresh: "Refresh",
    critical: "Critical",
    attention: "Attention",
    ready: "Ready",
    watch: "Watch",
    total: "Open decisions",
    noDecisions: "No current rule-based exceptions.",
    rules: "Rules in force",
    rulesHelp: "These thresholds are explicit and reproducible, so operators can trust why an item appears.",
    loadError: "Could not load Orchard decision data",
    open: "Open",
  },
  es: {
    title: "Motor de Decisiones",
    description: "Excepciones operativas determinísticas desde datos canónicos de Orchard. Cada alerta muestra la regla que la generó; aquí no se usa juicio de IA.",
    refresh: "Actualizar",
    critical: "Crítico",
    attention: "Atención",
    ready: "Listo",
    watch: "Vigilar",
    total: "Decisiones abiertas",
    noDecisions: "No hay excepciones actuales basadas en reglas.",
    rules: "Reglas activas",
    rulesHelp: "Los umbrales son explícitos y reproducibles para que el operador entienda por qué aparece cada alerta.",
    loadError: "No fue posible cargar los datos de decisiones",
    open: "Abrir",
  },
} as const

const dayMs = 86400000
const isoToday = () => new Date().toISOString().slice(0, 10)
const addDays = (value: string, days: number) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
const daysFromToday = (value: string, today: string) => Math.round((new Date(`${value}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / dayMs)
const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase()
const cropKey = (crop: string, variety: string | null) => `${normalize(crop)}::${normalize(variety)}`
const labelCrop = (crop: string, variety: string | null) => `${crop}${variety ? ` · ${variety}` : ""}`
const seedsNeeded = (s: Succession) => s.planned_plants && s.germination_rate_pct && s.seeds_per_plant ? Math.ceil((s.planned_plants * s.seeds_per_plant) / (s.germination_rate_pct / 100)) : 0

export default function OrchardDecisionEnginePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lifecycle, setLifecycle] = useState<Lifecycle[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [seedLots, setSeedLots] = useState<SeedLot[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [pests, setPests] = useState<Pest[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [lc, s, cy, seed, a, b, p, pe, c, t, ta] = await Promise.all([
      supabase.from("orchard_succession_lifecycle").select("crop_succession_id,crop_cycle_id,sequence_no,persisted_status,effective_status,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,transplanted_count,first_planting_date,first_harvest_date,harvest_passes"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,planned_plants,germination_rate_pct,seeds_per_plant,status"),
      supabase.from("orchard_crop_cycles").select("id,crop_name,variety"),
      supabase.from("orchard_seed_lots").select("id,crop_name,variety,lot_code,quantity_seeds,expiry_date"),
      supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm"),
      supabase.from("orchard_beds").select("id,plot_id,name"),
      supabase.from("orchard_plots").select("id,name"),
      supabase.from("orchard_pest_logs").select("id,crop_id,observation_date,pest_type,disease_name,severity_level,affected_percentage,treatment_applied,treatment_effectiveness"),
      supabase.from("orchard_crops").select("id,crop_succession_id,crop_name,variety,status,estimated_yield,actual_yield,yield_unit"),
      supabase.from("tasks").select("id,title,priority,status,due_date,estimated_minutes,source_id,source_type").eq("operational_area", "huerto_vinedo"),
      supabase.from("task_assignments").select("task_id,employee_id"),
    ])
    const queryError = lc.error ?? s.error ?? cy.error ?? seed.error ?? a.error ?? b.error ?? p.error ?? pe.error ?? c.error ?? t.error ?? ta.error
    if (queryError) setError(`${text.loadError}: ${queryError.message}`)
    else {
      setLifecycle((lc.data ?? []) as Lifecycle[])
      setSuccessions((s.data ?? []) as Succession[])
      setCycles((cy.data ?? []) as Cycle[])
      setSeedLots((seed.data ?? []) as SeedLot[])
      setAllocations((a.data ?? []) as Allocation[])
      setBeds((b.data ?? []) as Bed[])
      setPlots((p.data ?? []) as Plot[])
      setPests((pe.data ?? []) as Pest[])
      setCrops((c.data ?? []) as Crop[])
      setTasks((t.data ?? []) as Task[])
      setAssignments((ta.data ?? []) as Assignment[])
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const decisions = useMemo<Decision[]>(() => {
    const today = isoToday()
    const next7 = addDays(today, 7)
    const next14 = addDays(today, 14)
    const cycleById = new Map(cycles.map((item) => [item.id, item]))
    const successionById = new Map(successions.map((item) => [item.id, item]))
    const lifecycleById = new Map(lifecycle.map((item) => [item.crop_succession_id, item]))
    const bedById = new Map(beds.map((item) => [item.id, item]))
    const plotById = new Map(plots.map((item) => [item.id, item]))
    const cropById = new Map(crops.map((item) => [item.id, item]))
    const assigned = new Set(assignments.filter((item) => item.employee_id).map((item) => item.task_id))
    const result: Decision[] = []

    const successionLabel = (id: string) => {
      const succession = successionById.get(id)
      const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null
      return succession && cycle ? `${labelCrop(cycle.crop_name, cycle.variety)} #${lifecycleById.get(id)?.sequence_no ?? ""}` : id
    }

    lifecycle.forEach((item) => {
      const label = successionLabel(item.crop_succession_id)
      if (item.effective_status === "planned" && item.planned_sow_date < today) {
        result.push({ id: `late-sow-${item.crop_succession_id}`, severity: "critical", category: "Lifecycle", title: `${label}: sowing overdue`, detail: `${Math.abs(daysFromToday(item.planned_sow_date, today))} day(s) past planned sow date.`, rule: "Planned sow date is before today and lifecycle is still planned.", href: "/orchard/lifecycle" })
      }
      if (["nursery", "hardening", "sown"].includes(item.effective_status) && item.planned_transplant_date && item.planned_transplant_date < today && !item.first_planting_date) {
        result.push({ id: `late-transplant-${item.crop_succession_id}`, severity: "attention", category: "Lifecycle", title: `${label}: transplant overdue`, detail: `${Math.abs(daysFromToday(item.planned_transplant_date, today))} day(s) past planned transplant date.`, rule: "Planned transplant date is before today and no field planting has been recorded.", href: "/orchard/nursery" })
      }
      if (item.effective_status === "harvest_ready") {
        result.push({ id: `ready-harvest-${item.crop_succession_id}`, severity: "ready", category: "Harvest", title: `${label}: harvest window is open`, detail: item.planned_first_harvest_date ? `Planned first harvest: ${item.planned_first_harvest_date}.` : "Lifecycle indicates harvest readiness.", rule: "Effective lifecycle is harvest_ready and no harvest pass has advanced it to harvesting.", href: "/orchard/harvest" })
      } else if (item.planned_first_harvest_date && item.planned_first_harvest_date >= today && item.planned_first_harvest_date <= next7 && item.harvest_passes === 0) {
        result.push({ id: `harvest-soon-${item.crop_succession_id}`, severity: "watch", category: "Harvest", title: `${label}: harvest approaching`, detail: `${daysFromToday(item.planned_first_harvest_date, today)} day(s) until planned first harvest.`, rule: "First harvest is within the next 7 days and no harvest pass exists yet.", href: "/orchard/harvest" })
      }
    })

    const requiredByCrop = new Map<string, { crop: string; variety: string | null; needed: number }>()
    successions.filter((item) => !["completed", "cancelled", "harvesting"].includes(item.status)).forEach((item) => {
      const cycle = cycleById.get(item.crop_cycle_id)
      if (!cycle) return
      const needed = seedsNeeded(item)
      if (!needed) return
      const key = cropKey(cycle.crop_name, cycle.variety)
      const current = requiredByCrop.get(key)
      requiredByCrop.set(key, { crop: cycle.crop_name, variety: cycle.variety, needed: (current?.needed ?? 0) + needed })
    })
    const stockByCrop = new Map<string, number>()
    seedLots.forEach((lot) => {
      if (lot.expiry_date && lot.expiry_date < today) return
      const key = cropKey(lot.crop_name, lot.variety)
      stockByCrop.set(key, (stockByCrop.get(key) ?? 0) + Math.max(0, lot.quantity_seeds ?? 0))
    })
    requiredByCrop.forEach((req, key) => {
      const stock = stockByCrop.get(key) ?? 0
      if (stock < req.needed) result.push({ id: `seed-${key}`, severity: stock === 0 ? "critical" : "attention", category: "Seeds", title: `${labelCrop(req.crop, req.variety)}: seed shortage`, detail: `${stock.toLocaleString()} available vs ${req.needed.toLocaleString()} estimated seeds required.`, rule: "Non-expired seed stock is below estimated requirement for active planned successions.", href: "/orchard/nursery" })
    })

    const allocationsByBed = new Map<string, Allocation[]>()
    allocations.forEach((item) => allocationsByBed.set(item.bed_id, [...(allocationsByBed.get(item.bed_id) ?? []), item]))
    allocationsByBed.forEach((items, bedId) => {
      const ordered = [...items].sort((a, b) => a.planned_start_date.localeCompare(b.planned_start_date))
      const bed = bedById.get(bedId)
      const plot = bed ? plotById.get(bed.plot_id) : null
      const bedLabel = bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : bedId
      ordered.forEach((item, index) => {
        if (item.planned_end_date >= today && item.planned_end_date <= next14) {
          result.push({ id: `bed-free-${item.id}`, severity: "watch", category: "Beds", title: `${bedLabel}: bed becoming available`, detail: `Current allocation ends ${item.planned_end_date}.`, rule: "Allocation end date falls within the next 14 days.", href: "/orchard/crop-map" })
        }
        const next = ordered[index + 1]
        if (!next) return
        const currentSuccession = successionById.get(item.crop_succession_id)
        const nextSuccession = successionById.get(next.crop_succession_id)
        const currentCycle = currentSuccession ? cycleById.get(currentSuccession.crop_cycle_id) : null
        const nextCycle = nextSuccession ? cycleById.get(nextSuccession.crop_cycle_id) : null
        if (currentCycle && nextCycle && normalize(currentCycle.crop_name) === normalize(nextCycle.crop_name)) {
          result.push({ id: `rotation-${item.id}-${next.id}`, severity: "attention", category: "Rotation", title: `${bedLabel}: repeated crop sequence`, detail: `${labelCrop(currentCycle.crop_name, currentCycle.variety)} is followed by ${labelCrop(nextCycle.crop_name, nextCycle.variety)}.`, rule: "Two consecutive allocations on the same bed use the same crop name. This is a rotation warning, not an agronomic disease-risk diagnosis.", href: "/orchard/crop-map" })
        }
      })
    })

    pests.forEach((item) => {
      const severe = ["high", "critical"].includes(normalize(item.severity_level))
      const effective = ["effective", "very_effective"].includes(normalize(item.treatment_effectiveness))
      if (!severe || effective) return
      const crop = cropById.get(item.crop_id)
      result.push({ id: `health-${item.id}`, severity: normalize(item.severity_level) === "critical" ? "critical" : "attention", category: "Health", title: `${crop ? labelCrop(crop.crop_name, crop.variety) : "Crop"}: severe health issue`, detail: `${item.pest_type || item.disease_name || "Health observation"}${item.affected_percentage != null ? ` · ${item.affected_percentage}% affected` : ""}.`, rule: "Severity is high/critical and treatment effectiveness is not recorded as effective/very effective.", href: "/orchard/pests" })
    })

    const openTasks = tasks.filter((task) => !["done", "completed", "cancelled"].includes(normalize(task.status)))
    openTasks.filter((task) => task.due_date && task.due_date < today).forEach((task) => {
      result.push({ id: `task-overdue-${task.id}`, severity: ["urgent", "critical", "high"].includes(normalize(task.priority)) ? "critical" : "attention", category: "Work", title: `Overdue: ${task.title}`, detail: `Due ${task.due_date}${assigned.has(task.id) ? "" : " · unassigned"}.`, rule: "Open Orchard task has a due date before today.", href: "/orchard/work" })
    })
    openTasks.filter((task) => task.due_date && task.due_date >= today && task.due_date <= next7 && !assigned.has(task.id)).forEach((task) => {
      result.push({ id: `task-unassigned-${task.id}`, severity: "attention", category: "Work", title: `Unassigned: ${task.title}`, detail: `Due ${task.due_date}.`, rule: "Open Orchard task is due within 7 days and has no employee assignment.", href: "/orchard/work" })
    })
    const workload = new Map<string, number>()
    openTasks.filter((task) => task.due_date && task.due_date >= today && task.due_date <= next7).forEach((task) => workload.set(task.due_date!, (workload.get(task.due_date!) ?? 0) + (task.estimated_minutes ?? 0)))
    workload.forEach((minutes, date) => {
      if (minutes > 480) result.push({ id: `workload-${date}`, severity: "attention", category: "Work", title: `${date}: workload exceeds one person-day`, detail: `${Math.round(minutes / 60 * 10) / 10} estimated hours scheduled.`, rule: "Open Orchard tasks due on the same day total more than 480 estimated minutes.", href: "/orchard/work" })
    })

    crops.forEach((crop) => {
      if (crop.estimated_yield == null || crop.actual_yield == null || crop.estimated_yield <= 0 || !crop.yield_unit) return
      const ratio = crop.actual_yield / crop.estimated_yield
      if (ratio < 0.8) result.push({ id: `yield-${crop.id}`, severity: ratio < 0.5 ? "critical" : "attention", category: "Performance", title: `${labelCrop(crop.crop_name, crop.variety)}: yield under target`, detail: `${crop.actual_yield} / ${crop.estimated_yield} ${crop.yield_unit} (${Math.round(ratio * 100)}%).`, rule: "Recorded actual yield is below 80% of estimated yield in the same crop yield unit.", href: "/orchard/harvest" })
    })

    const rank = { critical: 0, attention: 1, ready: 2, watch: 3 }
    return result.sort((a, b) => rank[a.severity] - rank[b.severity] || a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
  }, [allocations, assignments, beds, crops, cycles, lifecycle, pests, plots, seedLots, successions, tasks])

  const counts = decisions.reduce<Record<Decision["severity"], number>>((acc, item) => ({ ...acc, [item.severity]: acc[item.severity] + 1 }), { critical: 0, attention: 0, ready: 0, watch: 0 })
  const rules = [
    "Overdue sowing: planned sow date is before today while lifecycle remains planned.",
    "Overdue transplant: planned transplant date is before today with no recorded field planting.",
    "Harvest ready/soon: effective harvest readiness, or planned first harvest within 7 days with no harvest pass.",
    "Seed shortage: non-expired lot stock is below calculated seed requirement for active successions.",
    "Bed turnover: an allocation ends within 14 days; repeated crop names on consecutive allocations trigger a rotation warning.",
    "Health: high/critical observation without effective/very effective treatment result.",
    "Workload: overdue work, unassigned work due within 7 days, or more than 480 estimated minutes due on one day.",
    "Yield: recorded actual yield is below 80% of estimated yield for the same crop record.",
  ]

  return <AppLayout>
    <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>} />
    <OrchardNavigation />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label={text.total} value={decisions.length} icon={<ShieldAlert className="h-4 w-4" />} />
        <Metric label={text.critical} value={counts.critical} icon={<AlertTriangle className="h-4 w-4" />} />
        <Metric label={text.attention} value={counts.attention} icon={<Clock3 className="h-4 w-4" />} />
        <Metric label={text.ready} value={counts.ready} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric label={text.watch} value={counts.watch} icon={<Sprout className="h-4 w-4" />} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>{text.total}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader>
          <CardContent>{loading ? <p className="text-sm text-muted-foreground">Loading…</p> : decisions.length === 0 ? <p className="text-sm text-muted-foreground">{text.noDecisions}</p> : <div className="space-y-3">{decisions.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={item.severity === "critical" ? "destructive" : "outline"}>{item.severity}</Badge><Badge variant="secondary">{item.category}</Badge><h3 className="font-semibold">{item.title}</h3></div><p className="mt-2 text-sm">{item.detail}</p><p className="mt-2 text-xs text-muted-foreground"><span className="font-medium">Rule:</span> {item.rule}</p></div><Button asChild size="sm" variant="outline"><Link href={`/${language}${item.href}`}>{text.open}</Link></Button></div></div>)}</div>}</CardContent>
        </Card>
        <Card><CardHeader><CardTitle>{text.rules}</CardTitle><CardDescription>{text.rulesHelp}</CardDescription></CardHeader><CardContent><ol className="space-y-3 text-sm text-muted-foreground">{rules.map((rule, index) => <li key={rule} className="flex gap-3"><span className="font-mono text-xs text-foreground">{String(index + 1).padStart(2, "0")}</span><span>{rule}</span></li>)}</ol></CardContent></Card>
      </div>
    </div>
  </AppLayout>
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><div className="rounded-lg border p-2 text-muted-foreground">{icon}</div></CardContent></Card>
}

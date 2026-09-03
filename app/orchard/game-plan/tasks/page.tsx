"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Search, ShieldAlert, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { PlannedWorkloadChart } from "@/components/orchard/orchard-season-graphics"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import {
  ORCHARD_CROP_CHART_TASK_PROFILES,
  ORCHARD_CROP_CHART_TASK_SOURCE,
  cropChartTaskReferenceFor,
} from "@/lib/orchard/crop-chart-task-reference"
import { ORCHARD_CROP_TASK_REFERENCE_SOURCE } from "@/lib/orchard/crop-task-reference"

type Locale = "en" | "es" | "de"
type View = "follow_up" | "implantation" | "conditional" | "all"
type Plan = { id: string; season: string | null; status: string; start_date: string; end_date: string }
type Cycle = { id: string; game_plan_id: string; crop_name: string }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null }
type Allocation = { crop_succession_id: string }
type ExistingTask = { id: string; due_date: string | null; source_type: string | null; source_id: string | null; source_path: string | null; status: string; estimated_minutes: number | null }
type PlannedReference = {
  successionId: string
  crop: string
  sequence: number
  activity: string
  date: string | null
  anchor: string
  offsetDays: number | null
  sourceRow: number
  sourceColumn: string
  sourcePath: string
  kind: "implantation" | "follow_up" | "conditional"
  taskId: string | null
  taskStatus: string | null
}
type WorkloadRow = { label:string; weekStart:string; implantation:number; followUp:number }

const copy = {
  en: {
    eyebrow: "Dietrich · Calendar & Tasks",
    title: "Operational crop-work calendar",
    description: "Crop Chart is the primary planning recipe for the reconciled field season. Black Swan keeps implantation anchors, dated follow-up work and undated conditional work separate so references never masquerade as completed tasks.",
    anchors: "Implantation anchors", followUps: "Dated follow-ups", conditional: "Conditional", converted: "Operational tasks created",
    all: "All", followUp: "Follow-up work", implantation: "Implantation", conditionalView: "Conditional",
    search: "Search crop or action", calendar: "Planning references", date: "Date", crop: "Crop / succession", action: "Action", relative: "Relative timing", source: "Source", status: "Operational state",
    day0: "day 0", before: "d before", after: "d after", noDate: "No source date", plannedOnly: "Planning reference", taskCreated: "Task created", createTask: "Assign as operational task", existingTask: "Open task", noRows: "No references match this filter.",
    warning: "Nothing on this page is marked executed automatically. A follow-up becomes an operational task only after a responsible person is selected in Task Management.",
    conditionalHelp: "Undated source actions remain conditional until an operator confirms the execution date. Black Swan does not invent that date.",
    sourcePrimary: "Primary schedule source", sourceSecondary: "Context source",
    work: "Open accountable task management", loadError: "Could not load the reconciled work calendar.", sequence: "succession",
    workload: "Planned workload by week", workloadHelp: "Season shape using source-backed action counts and real calendar dates.", peakWeek: "Peak week", activeWeeks: "Active weeks", actions:"actions",
  },
  es: {
    eyebrow: "Dietrich · Calendario y Tareas",
    title: "Calendario operativo de labores",
    description: "Crop Chart es la receta principal de planificación para la temporada de campo reconciliada. Black Swan separa hitos de implantación, labores posteriores con fecha y labores condicionales sin fecha para que una referencia nunca parezca trabajo ejecutado.",
    anchors: "Hitos de implantación", followUps: "Labores posteriores", conditional: "Condicionales", converted: "Tareas operativas creadas",
    all: "Todo", followUp: "Labores posteriores", implantation: "Implantación", conditionalView: "Condicionales",
    search: "Buscar cultivo o labor", calendar: "Referencias de planificación", date: "Fecha", crop: "Cultivo / sucesión", action: "Labor", relative: "Momento relativo", source: "Fuente", status: "Estado operativo",
    day0: "día 0", before: "d antes", after: "d después", noDate: "Sin fecha fuente", plannedOnly: "Referencia de planificación", taskCreated: "Tarea creada", createTask: "Asignar como tarea operativa", existingTask: "Abrir tarea", noRows: "No hay referencias que coincidan con este filtro.",
    warning: "Nada en esta página se marca ejecutado automáticamente. Una labor posterior se convierte en tarea operativa sólo cuando se selecciona un responsable en Gestión de tareas.",
    conditionalHelp: "Las acciones sin fecha en la fuente siguen siendo condicionales hasta que un operador confirme cuándo ejecutarlas. Black Swan no inventa esa fecha.",
    sourcePrimary: "Fuente principal del calendario", sourceSecondary: "Fuente contextual",
    work: "Abrir gestión de tareas responsables", loadError: "No fue posible cargar el calendario reconciliado de labores.", sequence: "sucesión",
    workload: "Carga planificada por semana", workloadHelp: "Forma de temporada usando conteos de acciones respaldados por fuente y fechas reales de calendario.", peakWeek: "Semana peak", activeWeeks: "Semanas activas", actions:"acciones",
  },
  de: {
    eyebrow: "Dietrich · Kalender & Aufgaben",
    title: "Operativer Arbeitskalender",
    description: "Crop Chart ist die primäre Planungsquelle für die abgeglichene Feldsaison. Black Swan trennt Pflanzanker, datierte Folgearbeiten und undatierte bedingte Arbeiten, damit Referenzen nie als ausgeführte Arbeit erscheinen.",
    anchors: "Pflanzanker", followUps: "Datierte Folgearbeiten", conditional: "Bedingt", converted: "Operative Aufgaben erstellt",
    all: "Alle", followUp: "Folgearbeiten", implantation: "Pflanzung", conditionalView: "Bedingt",
    search: "Kultur oder Arbeit suchen", calendar: "Planungsreferenzen", date: "Datum", crop: "Kultur / Folge", action: "Arbeit", relative: "Relativer Zeitpunkt", source: "Quelle", status: "Operativer Status",
    day0: "Tag 0", before: "T vorher", after: "T danach", noDate: "Kein Quelldatum", plannedOnly: "Planungsreferenz", taskCreated: "Aufgabe erstellt", createTask: "Als operative Aufgabe zuweisen", existingTask: "Aufgabe öffnen", noRows: "Keine Referenzen entsprechen diesem Filter.",
    warning: "Auf dieser Seite wird nichts automatisch als ausgeführt markiert. Eine Folgearbeit wird erst dann zur operativen Aufgabe, wenn in der Aufgabenverwaltung eine verantwortliche Person gewählt wurde.",
    conditionalHelp: "Undatierte Quellaktionen bleiben bedingt, bis ein Operator das Ausführungsdatum bestätigt. Black Swan erfindet dieses Datum nicht.",
    sourcePrimary: "Primäre Kalenderquelle", sourceSecondary: "Kontextquelle",
    work: "Verbindliche Aufgabenverwaltung öffnen", loadError: "Der abgeglichene Arbeitskalender konnte nicht geladen werden.", sequence: "Folge",
    workload: "Geplante Arbeitslast pro Woche", workloadHelp: "Saisonverlauf auf Basis belegter Aktionsanzahlen und realer Kalenderdaten.", peakWeek: "Spitzenwoche", activeWeeks: "Aktive Wochen", actions:"Arbeiten",
  },
} as const

const locales: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const dateKey = (value: string, days: number) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const dateLabel = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
const compactDate = (value:string, locale:string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short"})
const dayMs = 86_400_000

export default function DietrichTaskCalendarPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang: Locale = language
  const text = copy[lang]
  const locale = locales[lang]
  const [plans, setPlans] = useState<Plan[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [existingTasks, setExistingTasks] = useState<ExistingTask[]>([])
  const [view, setView] = useState<View>("follow_up")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    void Promise.all([
      supabase.from("orchard_game_plans").select("id,season,status,start_date,end_date").order("start_date", { ascending: false }),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date").order("planned_sow_date"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id"),
      supabase.from("tasks").select("id,due_date,source_type,source_id,source_path,status,estimated_minutes").in("operational_area", ["orchard", "huerto_vinedo"]),
    ]).then(([p, c, s, a, t]) => {
      if (!live) return
      const first = p.error ?? c.error ?? s.error ?? a.error ?? t.error
      if (first) { setError(`${text.loadError} ${first.message}`); setLoading(false); return }
      setPlans((p.data ?? []) as Plan[])
      setCycles((c.data ?? []) as Cycle[])
      setSuccessions((s.data ?? []) as Succession[])
      setAllocations((a.data ?? []) as Allocation[])
      setExistingTasks((t.data ?? []) as ExistingTask[])
      setLoading(false)
    })
    return () => { live = false }
  }, [supabase, text.loadError])

  const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game_plan") : null
  const plan = plans.find((p) => p.id === requested) ?? plans.find((p) => p.status === "active") ?? plans.find((p) => p.status === "draft") ?? plans[0] ?? null
  const scopedCycles = plan ? cycles.filter((c) => c.game_plan_id === plan.id) : []
  const cycleById = new Map(scopedCycles.map((c) => [c.id, c]))
  const allocatedSuccessionIds = new Set(allocations.map((a) => a.crop_succession_id))
  const scopedSuccessions = successions.filter((s) => cycleById.has(s.crop_cycle_id) && allocatedSuccessionIds.has(s.id))

  const references = useMemo<PlannedReference[]>(() => {
    const rows: PlannedReference[] = []
    for (const succession of scopedSuccessions) {
      const cycle = cycleById.get(succession.crop_cycle_id)
      if (!cycle) continue
      const profile = cropChartTaskReferenceFor(cycle.crop_name)
      if (!profile) continue
      const anchor = succession.planned_transplant_date ?? succession.planned_sow_date
      for (const action of profile.actions) {
        const date = action.offsetDays === null ? null : dateKey(anchor, action.offsetDays)
        const sourcePath = `${ORCHARD_CROP_CHART_TASK_SOURCE.sheet}!${action.sourceColumn}`
        const task = date ? existingTasks.find((candidate) => candidate.source_type === "orchard_succession" && candidate.source_id === succession.id && candidate.due_date === date && candidate.source_path === sourcePath) ?? null : null
        rows.push({ successionId: succession.id, crop: cycle.crop_name, sequence: succession.sequence_no, activity: action.activity, date, anchor, offsetDays: action.offsetDays, sourceRow: profile.sourceRow, sourceColumn: action.sourceColumn, sourcePath, kind: action.kind, taskId: task?.id ?? null, taskStatus: task?.status ?? null })
      }
    }
    return rows.sort((a, b) => (a.date ?? "9999-12-31").localeCompare(b.date ?? "9999-12-31") || a.crop.localeCompare(b.crop) || a.sequence - b.sequence)
  }, [scopedSuccessions, cycleById, existingTasks])

  const counts = { implantation: references.filter((item) => item.kind === "implantation").length, followUp: references.filter((item) => item.kind === "follow_up" && item.date).length, conditional: references.filter((item) => item.kind === "conditional").length, converted: references.filter((item) => item.taskId).length }
  const tasksWithEstimatedMinutes = existingTasks.filter((task) => task.estimated_minutes !== null).length
  const coverageText = lang === "es"
    ? `${scopedSuccessions.length} plantaciones físicamente reconciliadas resuelven ${counts.implantation + counts.followUp} acciones fechadas de Crop Chart: ${counts.implantation} hitos de implantación + ${counts.followUp} labores posteriores, más ${counts.conditional} acciones condicionales sin fecha.`
    : lang === "de"
      ? `${scopedSuccessions.length} physisch abgeglichene Pflanzungen ergeben ${counts.implantation + counts.followUp} datierte Crop-Chart-Aktionen: ${counts.implantation} Pflanzanker + ${counts.followUp} Folgearbeiten sowie ${counts.conditional} undatierte bedingte Aktionen.`
      : `${scopedSuccessions.length} physically reconciled plantings resolve to ${counts.implantation + counts.followUp} dated Crop Chart actions: ${counts.implantation} implantation anchors + ${counts.followUp} follow-ups, plus ${counts.conditional} undated conditional actions.`
  const workloadHelpText = lang === "es"
    ? `${text.workloadHelp} La capa operativa actual contiene ${tasksWithEstimatedMinutes}/${existingTasks.length} tareas Orchard con estimated_minutes; este gráfico sigue mostrando conteos de acciones, no horas.`
    : lang === "de"
      ? `${text.workloadHelp} Die aktuelle operative Ebene enthält ${tasksWithEstimatedMinutes}/${existingTasks.length} Orchard-Aufgaben mit estimated_minutes; dieses Diagramm zeigt weiterhin Aktionsanzahlen, nicht Stunden.`
      : `${text.workloadHelp} The current operational layer contains ${tasksWithEstimatedMinutes}/${existingTasks.length} Orchard tasks with estimated_minutes; this chart intentionally remains action-count based, not hours.`
  const workloadData = useMemo<WorkloadRow[]>(() => {
    if (!plan) return []
    const start = new Date(`${plan.start_date}T12:00:00`).getTime()
    const end = new Date(`${plan.end_date}T12:00:00`).getTime()
    const weeks = Math.max(1, Math.ceil((end - start) / (7 * dayMs)) + 1)
    const rows = Array.from({ length: weeks }, (_, index) => { const d=new Date(start+index*7*dayMs);const weekStart=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;return { label:compactDate(weekStart,locale), weekStart, implantation: 0, followUp: 0 } })
    for (const item of references) {
      if (!item.date || item.kind === "conditional") continue
      const when = new Date(`${item.date}T12:00:00`).getTime()
      const index = Math.floor((when - start) / (7 * dayMs))
      if (index < 0 || index >= rows.length) continue
      if (item.kind === "implantation") rows[index].implantation += 1
      if (item.kind === "follow_up") rows[index].followUp += 1
    }
    return rows
  }, [plan, references, locale])
  const peakRow = workloadData.reduce<WorkloadRow|null>((best,row)=>!best||row.implantation+row.followUp>best.implantation+best.followUp?row:best,null)
  const peakWork = peakRow ? peakRow.implantation + peakRow.followUp : 0
  const activeWeeks = workloadData.filter((row) => row.implantation + row.followUp > 0).length
  const normalizedQuery = query.trim().toLocaleLowerCase(locale)
  const filtered = references.filter((item) => { if (view !== "all" && item.kind !== view) return false; if (!normalizedQuery) return true; return `${item.crop} ${item.activity} ${item.sequence}`.toLocaleLowerCase(locale).includes(normalizedQuery) })
  const relativeLabel = (item: PlannedReference) => { if (item.offsetDays === null) return text.noDate; if (item.offsetDays === 0) return text.day0; return item.offsetDays < 0 ? `${Math.abs(item.offsetDays)} ${text.before}` : `+${item.offsetDays} ${text.after}` }

  const workHref = (item: PlannedReference) => {
    if (!plan || !item.date) return `/${language}/orchard/work`
    const params = new URLSearchParams({ game_plan: plan.id, succession: item.successionId, due: item.date, title: `${item.activity}: ${item.crop} #${item.sequence}`, category: item.activity, source_path: item.sourcePath })
    return `/${language}/orchard/work/from-plan?${params.toString()}`
  }
  const workRoot = `/${language}/orchard/work${plan ? `?game_plan=${encodeURIComponent(plan.id)}` : ""}`

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-7 max-w-5xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season ? <Badge variant="secondary">{plan.season}</Badge> : null}</div><p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
    {loading ? <div className="py-12 text-sm text-muted-foreground">…</div> : error ? <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div> : <>
      <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Sprout} label={text.anchors} value={counts.implantation}/><Metric icon={CalendarClock} label={text.followUps} value={counts.followUp}/><Metric icon={ShieldAlert} label={text.conditional} value={counts.conditional}/><Metric icon={CheckCircle2} label={text.converted} value={counts.converted}/></section>
      <section className="mb-6 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] p-5 sm:p-6"><div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end"><div><h2 className="text-xl font-normal">{text.workload}</h2><p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">{workloadHelpText}</p></div><SummaryCell label={text.peakWeek} value={peakRow?`${peakRow.label} · ${peakWork} ${text.actions}`:"—"}/><SummaryCell label={text.activeWeeks} value={String(activeWeeks)}/></div><PlannedWorkloadChart data={workloadData} language={lang}/></section>
      <div className="mb-6 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.warning}</div>
      <section className="mb-4 flex flex-col gap-3 border-y border-[var(--bs-divider-subtle)] py-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2"><FilterButton active={view === "follow_up"} onClick={() => setView("follow_up")}>{text.followUp} · {counts.followUp}</FilterButton><FilterButton active={view === "implantation"} onClick={() => setView("implantation")}>{text.implantation} · {counts.implantation}</FilterButton><FilterButton active={view === "conditional"} onClick={() => setView("conditional")}>{text.conditionalView} · {counts.conditional}</FilterButton><FilterButton active={view === "all"} onClick={() => setView("all")}>{text.all} · {references.length}</FilterButton></div><label className="relative block w-full lg:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input aria-label={text.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} className="pl-9"/></label></section>
      <section><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{text.calendar}</p><h2 className="mt-1 text-2xl font-normal">{plan?.season ?? "—"}</h2></div><Link href={workRoot} className="inline-flex items-center gap-2 text-sm text-foreground">{text.work}<ArrowRight className="h-4 w-4"/></Link></div><div className="overflow-x-auto border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]"><div className="min-w-[1040px]"><div className="grid grid-cols-[170px_260px_1fr_130px_135px_190px] border-b border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-secondary)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><span>{text.date}</span><span>{text.crop}</span><span>{text.action}</span><span>{text.relative}</span><span>{text.source}</span><span>{text.status}</span></div>{filtered.length === 0 ? <div className="p-8 text-sm text-muted-foreground">{text.noRows}</div> : filtered.map((item) => <div key={`${item.successionId}-${item.sourcePath}-${item.date ?? "conditional"}`} className="grid grid-cols-[170px_260px_1fr_130px_135px_190px] items-center border-b border-[var(--bs-divider-subtle)] px-3 py-3 text-sm last:border-b-0"><div className="tabular-nums">{item.date ? dateLabel(item.date, locale) : <span className="text-muted-foreground">{text.noDate}</span>}</div><div><p className="font-medium">{item.crop}</p><p className="mt-1 text-xs text-muted-foreground">{text.sequence} {item.sequence}</p></div><div><p>{item.activity}</p>{item.kind === "conditional" ? <p className="mt-1 text-xs text-muted-foreground">{text.conditionalHelp}</p> : null}</div><div className="tabular-nums text-muted-foreground">{relativeLabel(item)}</div><div className="font-mono text-xs text-muted-foreground">{ORCHARD_CROP_CHART_TASK_SOURCE.sheet}!{item.sourceColumn}</div><div>{item.taskId ? <Link href={`/${language}/tasks?entity=${encodeURIComponent(item.taskId)}`} className="inline-flex items-center gap-1.5 text-sm"><CheckCircle2 className="h-4 w-4"/>{text.taskCreated}</Link> : item.kind === "follow_up" && item.date ? <Link href={workHref(item)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--orchard-green)]">{text.createTask}<ArrowRight className="h-4 w-4"/></Link> : <span className="text-xs text-muted-foreground">{text.plannedOnly}</span>}</div></div>)}</div></div></section>
      <footer className="mt-6 grid gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs leading-5 text-muted-foreground lg:grid-cols-2"><div><strong className="font-medium text-foreground">{text.sourcePrimary}:</strong> {ORCHARD_CROP_CHART_TASK_SOURCE.sheet} · SHA-256 {ORCHARD_CROP_CHART_TASK_SOURCE.workbookSha256.slice(0, 12)}… · {ORCHARD_CROP_CHART_TASK_PROFILES.length} crop profiles.<br/>{coverageText}</div><div><strong className="font-medium text-foreground">{text.sourceSecondary}:</strong> {ORCHARD_CROP_TASK_REFERENCE_SOURCE.sheet} · same immutable workbook hash. It remains a contextual reference and is not double-counted into the operational schedule.</div></footer>
    </>}
  </main></AppLayout>
}

function Metric({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: number }) { return <div className="bg-[var(--bs-surface-primary)] p-5"><Icon className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div> }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`min-h-9 border px-3 text-sm ${active ? "border-[var(--orchard-green)] bg-[var(--orchard-green-soft)] text-[var(--orchard-green)]" : "border-[var(--bs-divider-subtle)] bg-transparent text-muted-foreground"}`}>{children}</button> }
function SummaryCell({label,value}:{label:string;value:string}){return <div className="min-w-[150px] border-l border-[var(--bs-divider-subtle)] pl-4"><p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>}

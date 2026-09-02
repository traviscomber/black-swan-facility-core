"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { CalendarRange, ChartNoAxesCombined, Leaf, Target } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id: string; name: string; season: string | null; start_date: string; end_date: string; status: string }
type Cycle = { id: string; game_plan_id: string; crop_name: string; variety: string | null; target_quantity: number | null; target_unit: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_bed_m: number | null; planned_first_harvest_date: string | null; planned_last_harvest_date: string | null }
type Allocation = { crop_succession_id: string }
type RevenueTarget = { crop_succession_id: string; planned_revenue: number | null }
type Window = { id: string; crop: string; variety: string | null; sequence: number; bedMeters: number; first: string; last: string; cycleTargetQuantity: number | null; cycleTargetUnit: string | null; hasRevenueTarget: boolean }

const copy = {
  en: {
    eyebrow: "Production Forecast", title: "Planned availability by harvest window", description: "Operational availability forecast for the 32 physically reconciled Crop Map plantings. Canonical harvest dates are shown without inventing weekly volume, yield or revenue.",
    windows: "Reconciled windows", months: "Months covered", crops: "Crops available", financial: "Revenue targets", coverage: "Availability coverage", upcoming: "Planned harvest windows", cycleTarget: "Cycle target", cycleTargetHelp: "cycle-level, not per succession", noTarget: "No cycle target", bedMeters: "Bed m", financialMissing: "Not recorded", financialRecorded: "Recorded", empty: "No physically reconciled harvest windows exist for this Game Plan.",
    method: "Method: a succession enters this forecast only when it has a physical Crop Map allocation and both canonical harvest dates. Monthly coverage means availability exists; it does not imply an evenly distributed weekly volume.", financialNotice: "No CLP revenue target is recorded for these reconciled plantings, so the forecast does not infer sales values.", scope: "Crop Map allocation is the reconciliation boundary.", succession: "Succession",
  },
  es: {
    eyebrow: "Forecast de Producción", title: "Disponibilidad planificada por ventana de cosecha", description: "Forecast operacional de disponibilidad para las 32 plantaciones físicamente reconciliadas con Crop Map. Se muestran fechas canónicas sin inventar volumen semanal, rendimiento ni ingresos.",
    windows: "Ventanas reconciliadas", months: "Meses cubiertos", crops: "Cultivos disponibles", financial: "Metas de ingreso", coverage: "Cobertura de disponibilidad", upcoming: "Ventanas de cosecha planificadas", cycleTarget: "Objetivo del ciclo", cycleTargetHelp: "a nivel de ciclo, no por sucesión", noTarget: "Sin objetivo de ciclo", bedMeters: "m de cama", financialMissing: "No registrada", financialRecorded: "Registrada", empty: "No hay ventanas de cosecha físicamente reconciliadas para este Game Plan.",
    method: "Método: una sucesión entra al forecast sólo si tiene asignación física en Crop Map y ambas fechas canónicas de cosecha. La cobertura mensual significa que existe disponibilidad; no implica volumen semanal uniforme.", financialNotice: "No hay metas de ingreso CLP registradas para estas plantaciones reconciliadas, por lo que el forecast no infiere ventas.", scope: "La asignación de Crop Map es la frontera de reconciliación.", succession: "Sucesión",
  },
  de: {
    eyebrow: "Produktionsprognose", title: "Geplante Verfügbarkeit nach Erntefenster", description: "Operative Verfügbarkeitsprognose für die 32 physisch mit Crop Map abgeglichenen Pflanzungen. Kanonische Erntedaten werden ohne erfundene Wochenmengen, Erträge oder Umsätze gezeigt.",
    windows: "Abgeglichene Fenster", months: "Abgedeckte Monate", crops: "Verfügbare Kulturen", financial: "Umsatzziele", coverage: "Verfügbarkeitsabdeckung", upcoming: "Geplante Erntefenster", cycleTarget: "Zyklusziel", cycleTargetHelp: "Zyklusebene, nicht je Folge", noTarget: "Kein Zyklusziel", bedMeters: "Beetmeter", financialMissing: "Nicht erfasst", financialRecorded: "Erfasst", empty: "Keine physisch abgeglichenen Erntefenster für diesen Game Plan.",
    method: "Methode: Eine Folge wird nur aufgenommen, wenn sie physisch in Crop Map zugeordnet ist und beide kanonischen Erntedaten besitzt. Monatliche Abdeckung bedeutet Verfügbarkeit, nicht gleichmäßiges Wochenvolumen.", financialNotice: "Für diese abgeglichenen Pflanzungen sind keine CLP-Umsatzziele erfasst; daher werden keine Verkäufe abgeleitet.", scope: "Crop-Map-Zuordnung ist die Abgleichsgrenze.", succession: "Folge",
  },
} as const

const locales: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const dateLabel = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
const monthLabel = (key: string, locale: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString(locale, { month: "short", year: "2-digit" })
function coveredMonths(first: string, last: string) { const out: string[] = []; const start = new Date(`${first}T12:00:00`); const end = new Date(`${last}T12:00:00`); const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12); while (cursor <= end) { out.push(monthKey(cursor)); cursor.setMonth(cursor.getMonth() + 1) } return out }

export default function OrchardForecastPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const lang: Locale = language; const text = copy[lang]; const locale = locales[lang]
  const [plans, setPlans] = useState<Plan[]>([]), [cycles, setCycles] = useState<Cycle[]>([]), [successions, setSuccessions] = useState<Succession[]>([]), [allocations, setAllocations] = useState<Allocation[]>([]), [revenueTargets, setRevenueTargets] = useState<RevenueTarget[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  useEffect(() => { let live = true; setLoading(true); setError(null); void Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date", { ascending: false }),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,target_quantity,target_unit"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_bed_m,planned_first_harvest_date,planned_last_harvest_date").neq("status", "cancelled"),
    supabase.from("orchard_bed_allocations").select("crop_succession_id"),
    supabase.from("orchard_revenue_targets").select("crop_succession_id,planned_revenue"),
  ]).then(([p, c, s, a, r]) => { if (!live) return; const first = p.error ?? c.error ?? s.error ?? a.error ?? r.error; if (first) { setError(first.message); setLoading(false); return } setPlans((p.data ?? []) as Plan[]); setCycles((c.data ?? []) as Cycle[]); setSuccessions((s.data ?? []) as Succession[]); setAllocations((a.data ?? []) as Allocation[]); setRevenueTargets((r.data ?? []) as RevenueTarget[]); setLoading(false) }); return () => { live = false } }, [supabase])

  const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game_plan") : null
  const plan = plans.find((p) => p.id === requested) ?? plans.find((p) => p.season === "2026/27") ?? plans.find((p) => p.status === "active") ?? plans.find((p) => p.status === "draft") ?? plans[0] ?? null
  const scopedCycles = plan ? cycles.filter((cycle) => cycle.game_plan_id === plan.id) : []
  const cycleById = new Map(scopedCycles.map((cycle) => [cycle.id, cycle]))
  const allocatedSuccessionIds = new Set(allocations.map((allocation) => allocation.crop_succession_id))
  const revenueIds = new Set(revenueTargets.filter((target) => Number(target.planned_revenue ?? 0) > 0).map((target) => target.crop_succession_id))
  const scoped = successions.filter((succession) => cycleById.has(succession.crop_cycle_id) && allocatedSuccessionIds.has(succession.id) && Number(succession.planned_bed_m) > 0 && succession.planned_first_harvest_date && succession.planned_last_harvest_date)
  const windows: Window[] = scoped.map((succession) => { const cycle = cycleById.get(succession.crop_cycle_id)!; return { id: succession.id, crop: cycle.crop_name, variety: cycle.variety, sequence: succession.sequence_no, bedMeters: Number(succession.planned_bed_m), first: succession.planned_first_harvest_date!, last: succession.planned_last_harvest_date!, cycleTargetQuantity: cycle.target_quantity, cycleTargetUnit: cycle.target_unit, hasRevenueTarget: revenueIds.has(succession.id) } }).sort((a, b) => a.first.localeCompare(b.first))
  const monthMap = new Map<string, Set<string>>(); for (const window of windows) { for (const month of coveredMonths(window.first, window.last)) { const crops = monthMap.get(month) ?? new Set<string>(); crops.add(window.crop); monthMap.set(month, crops) } }
  const months = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)); const cropsWithWindows = new Set(windows.map((window) => window.crop)).size; const financialTargets = windows.filter((window) => window.hasRevenueTarget).length

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season ? <Badge variant="secondary">{plan.season}</Badge> : null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
    {loading ? <div className="py-12 text-sm text-muted-foreground">…</div> : error ? <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div> : windows.length === 0 ? <div className="py-12 text-sm text-muted-foreground">{text.empty}</div> : <>
      <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-4"><Metric icon={<CalendarRange className="h-4 w-4"/>} label={text.windows} value={String(windows.length)}/><Metric icon={<ChartNoAxesCombined className="h-4 w-4"/>} label={text.months} value={String(months.length)}/><Metric icon={<Leaf className="h-4 w-4"/>} label={text.crops} value={String(cropsWithWindows)}/><Metric icon={<Target className="h-4 w-4"/>} label={text.financial} value={`${financialTargets}/${windows.length}`}/></section>
      <div className="mb-6 border-l-2 border-[var(--orchard-green)] pl-4 text-sm leading-6 text-muted-foreground">{text.scope}</div>
      {financialTargets === 0 ? <div className="mb-8 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.financialNotice}</div> : null}
      <section className="mb-8 bg-[var(--bs-surface-primary)] p-5 sm:p-6"><h2 className="text-xl font-normal">{text.coverage}</h2><div className="mt-5 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3 lg:grid-cols-6">{months.map(([month, crops]) => <div key={month} className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-sm font-medium">{monthLabel(month, locale)}</p><p className="mt-1 text-2xl tabular-nums">{crops.size}</p><p className="text-xs text-muted-foreground">{text.crops.toLowerCase()}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">{text.method}</p></section>
      <section><h2 className="mb-4 text-xl font-normal">{text.upcoming}</h2><div className="space-y-2">{windows.map((window) => <article key={window.id} className="grid gap-3 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] p-4 md:grid-cols-[1.25fr_.55fr_1fr_.7fr_.85fr_.85fr]"><div><strong className="font-medium">{window.crop}</strong>{window.variety ? <span className="ml-2 text-sm text-muted-foreground">{window.variety}</span> : null}<p className="mt-1 text-xs text-muted-foreground">{text.succession} {window.sequence}</p></div><Cell label={text.bedMeters} value={`${window.bedMeters} m`}/><Cell label={text.cycleTarget} value={window.cycleTargetQuantity != null ? `${window.cycleTargetQuantity.toLocaleString(locale)} ${window.cycleTargetUnit ?? ""} · ${text.cycleTargetHelp}` : text.noTarget}/><Cell label={text.financial} value={window.hasRevenueTarget ? text.financialRecorded : text.financialMissing}/><Cell label="Start" value={dateLabel(window.first, locale)}/><Cell label="End" value={dateLabel(window.last, locale)}/></article>)}</div></section>
    </>}
  </main></AppLayout>
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="bg-[var(--bs-surface-primary)] p-5">{icon}<p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div> }
function Cell({ label, value }: { label: string; value: string }) { return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm leading-5">{value}</p></div> }

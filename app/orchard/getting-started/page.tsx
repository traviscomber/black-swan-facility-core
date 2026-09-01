"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, MapPinned, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import {
  HEIRLOOM_ONBOARDING_STEPS,
  HEIRLOOM_REFERENCE_PEAK_BED_METERS,
  HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS,
  HEIRLOOM_REFERENCE_PLANTINGS,
  HEIRLOOM_REFERENCE_SETUP,
} from "@/lib/orchard/heirloom-parity"

type Locale = "en" | "es" | "de"
type Plan = { id: string; name: string; season: string | null; start_date: string; end_date: string; status: string }
type Cycle = { id: string; game_plan_id: string }
type Succession = { id: string; crop_cycle_id: string; status: string }
type Bed = { id: string; plot_id: string; length_m: number | null; status: string }
type Allocation = { crop_succession_id: string }
type RevenueTarget = { crop_succession_id: string }

type LiveSnapshot = {
  plans: Plan[]
  cycles: Cycle[]
  successions: Succession[]
  beds: Bed[]
  allocations: Allocation[]
  revenueTargets: RevenueTarget[]
  chartDefinitions: number
  seedLots: number
  tasks: number
}

const copy = {
  en: {
    eyebrow: "Orchard · Getting Started",
    title: "One operating journey from farm map to workload",
    description: "The eight-step Heirloom workflow is now codified as a Core journey. Completion is calculated from live Core records; reference observations never overwrite production data.",
    gamePlan: "Game Plan",
    loading: "Loading Orchard state…",
    loadError: "Could not load the Orchard onboarding state.",
    complete: "complete",
    completed: "Completed",
    pending: "Pending",
    openStep: "Open step",
    reference: "Heirloom reference",
    coreLive: "Core live",
    referenceHelp: "Observed authenticated behavior on 01 Sep 2026. Reference only.",
    coreHelp: "Current authorized Supabase state for the selected Game Plan.",
    physicalBeds: "Physical beds",
    plantings: "Plantings",
    capacity: "Bed-meter capacity",
    assigned: "Assigned plantings",
    peak: "Reference peak demand",
    mismatchTitle: "Reference and Core are not synchronized yet",
    mismatchBody: "Do not bulk-import allocations until the physical block and the 32-vs-Core planting set are reconciled. The app will show the difference instead of inventing a match.",
    truth: "Completion criteria are intentionally strict and data-backed.",
  },
  es: {
    eyebrow: "Orchard · Primeros pasos",
    title: "Un solo recorrido operativo desde el mapa hasta la carga de trabajo",
    description: "El flujo de ocho pasos observado en Heirloom queda codificado como journey de Core. El avance se calcula desde datos Core en vivo; la referencia nunca sobreescribe producción.",
    gamePlan: "Plan de Cultivo",
    loading: "Cargando estado de Orchard…",
    loadError: "No fue posible cargar el estado de onboarding de Orchard.",
    complete: "completado",
    completed: "Completado",
    pending: "Pendiente",
    openStep: "Abrir paso",
    reference: "Referencia Heirloom",
    coreLive: "Core en vivo",
    referenceHelp: "Comportamiento autenticado observado el 01 sep 2026. Sólo referencia.",
    coreHelp: "Estado autorizado actual de Supabase para el Plan seleccionado.",
    physicalBeds: "Camas físicas",
    plantings: "Plantaciones",
    capacity: "Capacidad bed-meter",
    assigned: "Plantaciones asignadas",
    peak: "Demanda peak de referencia",
    mismatchTitle: "Heirloom y Core todavía no están sincronizados",
    mismatchBody: "No importaremos asignaciones masivamente hasta reconciliar el bloque físico y el set de 32 plantaciones frente al Plan de Core. La app mostrará la diferencia en vez de inventar una equivalencia.",
    truth: "Los criterios de avance son estrictos y respaldados por datos.",
  },
  de: {
    eyebrow: "Orchard · Erste Schritte",
    title: "Ein Betriebsablauf von der Farmkarte bis zur Arbeitslast",
    description: "Der beobachtete Heirloom-Acht-Schritte-Ablauf ist als Core-Journey kodifiziert. Der Fortschritt wird aus Live-Core-Daten berechnet; Referenzbeobachtungen überschreiben niemals Produktionsdaten.",
    gamePlan: "Game Plan",
    loading: "Orchard-Status wird geladen…",
    loadError: "Der Orchard-Onboarding-Status konnte nicht geladen werden.",
    complete: "abgeschlossen",
    completed: "Abgeschlossen",
    pending: "Offen",
    openStep: "Schritt öffnen",
    reference: "Heirloom-Referenz",
    coreLive: "Core live",
    referenceHelp: "Authentifiziert beobachtetes Verhalten vom 01. Sep. 2026. Nur Referenz.",
    coreHelp: "Aktueller autorisierter Supabase-Status für den gewählten Game Plan.",
    physicalBeds: "Physische Beete",
    plantings: "Pflanzungen",
    capacity: "Beetmeter-Kapazität",
    assigned: "Zugeordnete Pflanzungen",
    peak: "Referenz-Spitzenbedarf",
    mismatchTitle: "Heirloom und Core sind noch nicht synchronisiert",
    mismatchBody: "Keine Massenübernahme von Zuordnungen, bevor der physische Block und die 32 Referenzpflanzungen mit dem Core-Plan abgeglichen sind. Die App zeigt die Differenz statt eine Übereinstimmung zu erfinden.",
    truth: "Abschlusskriterien sind bewusst streng und datenbasiert.",
  },
} as const

const initialSnapshot: LiveSnapshot = { plans: [], cycles: [], successions: [], beds: [], allocations: [], revenueTargets: [], chartDefinitions: 0, seedLots: 0, tasks: 0 }

export default function OrchardGettingStartedPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const locale: Locale = language
  const text = copy[locale]
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(initialSnapshot)
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [plans, cycles, successions, beds, allocations, revenueTargets, charts, seeds, tasks] = await Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date", { ascending: false }),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,status").neq("status", "cancelled"),
      supabase.from("orchard_beds").select("id,plot_id,length_m,status").eq("status", "active"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id"),
      supabase.from("orchard_revenue_targets").select("crop_succession_id"),
      supabase.from("orchard_chart_definitions").select("id", { count: "exact", head: true }),
      supabase.from("orchard_seed_lots").select("id", { count: "exact", head: true }),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("operational_area", "huerto_vinedo"),
    ])
    const firstError = plans.error ?? cycles.error ?? successions.error ?? beds.error ?? allocations.error ?? revenueTargets.error ?? charts.error ?? seeds.error ?? tasks.error
    if (firstError) {
      setError(`${text.loadError} ${firstError.message}`)
      setLoading(false)
      return
    }
    const next: LiveSnapshot = {
      plans: (plans.data ?? []) as Plan[],
      cycles: (cycles.data ?? []) as Cycle[],
      successions: (successions.data ?? []) as Succession[],
      beds: (beds.data ?? []) as Bed[],
      allocations: (allocations.data ?? []) as Allocation[],
      revenueTargets: (revenueTargets.data ?? []) as RevenueTarget[],
      chartDefinitions: charts.count ?? 0,
      seedLots: seeds.count ?? 0,
      tasks: tasks.count ?? 0,
    }
    setSnapshot(next)
    setSelectedPlanId((current) => {
      if (current && next.plans.some((plan) => plan.id === current)) return current
      const requested = new URLSearchParams(window.location.search).get("game_plan")
      return next.plans.find((plan) => plan.id === requested)?.id ?? next.plans.find((plan) => plan.status === "active")?.id ?? next.plans.find((plan) => plan.status === "draft")?.id ?? next.plans[0]?.id ?? ""
    })
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const selectedPlan = snapshot.plans.find((plan) => plan.id === selectedPlanId) ?? null
  const scopedCycles = snapshot.cycles.filter((cycle) => cycle.game_plan_id === selectedPlanId)
  const cycleIds = new Set(scopedCycles.map((cycle) => cycle.id))
  const scopedSuccessions = snapshot.successions.filter((succession) => cycleIds.has(succession.crop_cycle_id))
  const successionIds = new Set(scopedSuccessions.map((succession) => succession.id))
  const scopedAllocations = snapshot.allocations.filter((allocation) => successionIds.has(allocation.crop_succession_id))
  const allocatedSuccessionIds = new Set(scopedAllocations.map((allocation) => allocation.crop_succession_id))
  const unallocatedCount = scopedSuccessions.filter((succession) => !allocatedSuccessionIds.has(succession.id)).length
  const scopedRevenueTargets = snapshot.revenueTargets.filter((target) => successionIds.has(target.crop_succession_id))
  const liveBedMeters = snapshot.beds.reduce((sum, bed) => sum + Number(bed.length_m ?? 0), 0)

  const completion = [
    snapshot.beds.length > 0,
    scopedCycles.length > 0,
    scopedSuccessions.length > 0,
    scopedAllocations.length > 0,
    scopedRevenueTargets.length > 0,
    snapshot.chartDefinitions > 0,
    snapshot.seedLots > 0,
    snapshot.tasks > 0,
  ]
  const completedCount = completion.filter(Boolean).length
  const scopedHref = (path: string) => `/${language}${path}${selectedPlanId ? `?game_plan=${encodeURIComponent(selectedPlanId)}` : ""}`
  const referenceMismatch = snapshot.beds.length !== HEIRLOOM_REFERENCE_SETUP.fieldBlockBeds || scopedSuccessions.length !== HEIRLOOM_REFERENCE_PLANTINGS.length

  return <AppLayout>
    <OrchardNavigation />
    <main className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="grid gap-6 border-b border-[var(--orchard-line)] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--orchard-green)]">{text.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-normal sm:text-4xl">{text.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p>
        </div>
        <div className="min-w-[260px]">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{text.gamePlan}</p>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={loading || snapshot.plans.length === 0}>
            <SelectTrigger aria-label={text.gamePlan}><SelectValue placeholder={text.gamePlan} /></SelectTrigger>
            <SelectContent>{snapshot.plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.season ?? plan.name} · {plan.status}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </header>

      {loading ? <div className="py-16 text-sm text-muted-foreground">{text.loading}</div> : error ? <div className="my-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : <>
        <section className="my-8 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{selectedPlan?.season ?? selectedPlan?.name ?? text.gamePlan}</p><Badge variant="secondary">{completedCount}/8</Badge></div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf1ed]"><div className="h-full bg-[var(--orchard-green)] transition-all" style={{ width: `${(completedCount / 8) * 100}%` }} /></div>
            <p className="mt-3 text-xs text-muted-foreground">{completedCount} / 8 {text.complete}. {text.truth}</p>
          </div>
          {referenceMismatch && <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="font-medium">{text.mismatchTitle}</p><p className="mt-1 text-sm leading-6 text-amber-900/80">{text.mismatchBody}</p></div></div>}
        </section>

        <section className="grid gap-px overflow-hidden rounded-xl border bg-[var(--orchard-line)] md:grid-cols-2 xl:grid-cols-4">
          {HEIRLOOM_ONBOARDING_STEPS.map((step, index) => {
            const done = completion[index]
            return <Link key={step.id} href={scopedHref(step.coreHref)} className="group min-h-52 bg-white p-5 transition-colors hover:bg-[#f7faf7]">
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium tabular-nums text-muted-foreground">0{step.order}</span>{done ? <CheckCircle2 className="h-5 w-5 text-[var(--orchard-green)]"/> : <Circle className="h-5 w-5 text-[#b9c1ba]"/>}</div>
              <h2 className="mt-8 text-lg font-normal">{step.label}</h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{step.description}</p>
              <div className="mt-5 flex items-center justify-between gap-2"><Badge variant={done ? "secondary" : "outline"}>{done ? text.completed : text.pending}</Badge><span className="flex items-center gap-1 text-xs font-medium text-[var(--orchard-green)]">{text.openStep}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"/></span></div>
            </Link>
          })}
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-2">
          <article className="rounded-xl border bg-white p-5">
            <div className="flex items-start gap-3"><MapPinned className="mt-0.5 h-5 w-5 text-[var(--orchard-green)]"/><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">{text.reference}</p><h2 className="mt-2 text-xl font-normal">{HEIRLOOM_REFERENCE_SETUP.fieldBlockName}</h2><p className="mt-1 text-sm text-muted-foreground">{text.referenceHelp}</p></div></div>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[var(--orchard-line)] sm:grid-cols-4">
              <Metric label={text.physicalBeds} value={`${HEIRLOOM_REFERENCE_SETUP.fieldBlockBeds}`} />
              <Metric label={text.plantings} value={`${HEIRLOOM_REFERENCE_PLANTINGS.length}`} />
              <Metric label={text.capacity} value={`${HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS} m`} />
              <Metric label={text.peak} value={`${HEIRLOOM_REFERENCE_PEAK_BED_METERS} m`} />
            </div>
          </article>
          <article className="rounded-xl border bg-white p-5">
            <div className="flex items-start gap-3"><Sprout className="mt-0.5 h-5 w-5 text-[var(--orchard-green)]"/><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">{text.coreLive}</p><h2 className="mt-2 text-xl font-normal">{selectedPlan?.name ?? text.gamePlan}</h2><p className="mt-1 text-sm text-muted-foreground">{text.coreHelp}</p></div></div>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[var(--orchard-line)] sm:grid-cols-4">
              <Metric label={text.physicalBeds} value={`${snapshot.beds.length}`} />
              <Metric label={text.plantings} value={`${scopedSuccessions.length}`} />
              <Metric label={text.capacity} value={`${liveBedMeters.toFixed(0)} m`} />
              <Metric label={text.assigned} value={`${scopedSuccessions.length - unallocatedCount}/${scopedSuccessions.length}`} />
            </div>
          </article>
        </section>

        <div className="mt-6 flex justify-end"><Button variant="outline" onClick={() => void load()}>{text.coreLive}</Button></div>
      </>}
    </main>
  </AppLayout>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#fafbf9] p-4"><p className="text-[11px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl tabular-nums">{value}</p></div>
}

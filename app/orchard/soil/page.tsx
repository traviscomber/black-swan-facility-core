"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Droplets, FlaskConical, Layers3, Leaf, Map as MapIcon, Scale } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { ALL_GAME_PLANS, gamePlanScopeLabel, resolveRequestedGamePlanId, resolveSelectedGamePlan, scopeGamePlanGraph, withGamePlanQuery } from "@/lib/orchard/game-plan-scope"

interface SoilAmendment {
  id: string
  plot_id: string
  amendment_type: string
  product_name: string
  quantity_kg: number
  application_date: string
  npk_ratio: string
  application_method: string
  description: string
}

interface Plot { id: string; name: string }
type GamePlan = { id: string; name: string; season: string | null }
type Cycle = { id: string; game_plan_id: string }
type Succession = { id: string; crop_cycle_id: string }
type Allocation = { bed_id: string; crop_succession_id: string }
type Bed = { id: string; plot_id: string }

const hero = "https://images.unsplash.com/photo-1779760346345-669a477fa233?auto=format&fit=crop&w=2200&q=92"
const soilPhoto = "https://images.unsplash.com/photo-1774261711014-e69d611c6b9a?auto=format&fit=crop&w=1800&q=92"
const compostPhoto = "https://images.unsplash.com/photo-1716903282677-3a1b5c936b41?auto=format&fit=crop&w=1800&q=92"

export default function OrchardSoilPage() {
  const [amendments, setAmendments] = useState<SoilAmendment[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [plans, setPlans] = useState<GamePlan[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ALL_GAME_PLANS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { t, language } = useLanguage()

  useEffect(() => { void fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [amendmentResult, plotResult, planResult, cycleResult, successionResult, allocationResult, bedResult] = await Promise.all([
        supabase.from("orchard_soil_amendments").select("*").order("application_date", { ascending: false }),
        supabase.from("orchard_plots").select("id,name").order("name"),
        supabase.from("orchard_game_plans").select("id,name,season").order("start_date", { ascending: false }),
        supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
        supabase.from("orchard_crop_successions").select("id,crop_cycle_id"),
        supabase.from("orchard_bed_allocations").select("bed_id,crop_succession_id"),
        supabase.from("orchard_beds").select("id,plot_id"),
      ])
      const firstError = amendmentResult.error ?? plotResult.error ?? planResult.error ?? cycleResult.error ?? successionResult.error ?? allocationResult.error ?? bedResult.error
      if (firstError) {
        setError(firstError.message)
        return
      }
      const planRows = (planResult.data || []) as GamePlan[]
      setAmendments((amendmentResult.data || []) as SoilAmendment[])
      setPlots((plotResult.data || []) as Plot[])
      setPlans(planRows)
      setCycles((cycleResult.data || []) as Cycle[])
      setSuccessions((successionResult.data || []) as Succession[])
      setAllocations((allocationResult.data || []) as Allocation[])
      setBeds((bedResult.data || []) as Bed[])
      setSelectedPlanId(resolveRequestedGamePlanId(planRows, typeof window === "undefined" ? "" : window.location.search))
    } finally { setLoading(false) }
  }

  const selectedPlan = resolveSelectedGamePlan(plans, selectedPlanId)
  const { successionIds } = scopeGamePlanGraph(cycles, successions, selectedPlanId)
  const bedById = useMemo(() => new Map(beds.map((bed) => [bed.id, bed])), [beds])
  const planPlotIds = useMemo(() => {
    if (selectedPlanId === ALL_GAME_PLANS) return new Set<string>()
    return new Set(allocations.filter((allocation) => successionIds.has(allocation.crop_succession_id)).map((allocation) => bedById.get(allocation.bed_id)?.plot_id).filter((id): id is string => Boolean(id)))
  }, [allocations, bedById, selectedPlanId, successionIds])

  const plotName = (id: string) => plots.find((p) => p.id === id)?.name || t("orchard.unknown")
  const totalKg = amendments.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0)
  const typeCount = new Set(amendments.map((item) => item.amendment_type)).size
  const plotsTouched = new Set(amendments.map((item) => item.plot_id)).size
  const latest = amendments[0] ?? null
  const byPlot = plots.map((plot) => {
    const rows = amendments.filter((item) => item.plot_id === plot.id)
    return { plot, rows, kg: rows.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0), last: rows[0]?.application_date ?? null }
  }).filter((item) => item.rows.length > 0).sort((a, b) => b.kg - a.kg)

  if (loading) return <AppLayout><OrchardNavigation /><div className="flex min-h-[60vh] items-center justify-center"><p className="text-muted-foreground">{t("orchard.loading")}</p></div></AppLayout>

  return <AppLayout><OrchardNavigation /><main className="mx-auto w-full max-w-[1560px] space-y-10 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
    <section className="relative min-h-[380px] overflow-hidden bg-neutral-950">
      <img src={hero} alt="Hands working rich agricultural soil in a raised bed" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(5,7,6,.92),rgba(5,7,6,.60) 56%,rgba(5,7,6,.16)),linear-gradient(0deg,rgba(5,7,6,.74),transparent 62%)" }} />
      <div className="relative flex min-h-[380px] max-w-3xl flex-col justify-end p-6 text-white sm:p-10">
        <p className="text-xs uppercase tracking-[.2em] text-emerald-200">Orchard · Soil intelligence</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-.035em] text-white! sm:text-5xl">{t("orchard.soil_amendments")}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">{t("orchard.soil_description")}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Badge className="border-white/15 bg-black/30 px-3 py-2 text-white">{amendments.length} applications</Badge><Badge className="border-white/15 bg-black/30 px-3 py-2 text-white">{totalKg.toFixed(1)} kg applied</Badge><Badge className="border-white/15 bg-black/30 px-3 py-2 text-white">{plotsTouched} plots touched</Badge></div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-white/25 bg-black/25 text-white">Game Plan context: {gamePlanScopeLabel(selectedPlan, "All Orchard")}</Badge>{selectedPlan && <Badge variant="outline" className="border-white/25 bg-black/25 text-white">{planPlotIds.size} physical plots in plan footprint</Badge>}</div>
      </div>
      <div className="absolute bottom-6 right-6 hidden grid-cols-2 gap-px bg-white/10 lg:grid"><HeroMetric icon={<Layers3 className="h-4 w-4" />} label="Types" value={String(typeCount)} /><HeroMetric icon={<Scale className="h-4 w-4" />} label="Applied" value={`${totalKg.toFixed(0)} kg`} /><HeroMetric icon={<Leaf className="h-4 w-4" />} label="Plots" value={String(plotsTouched)} /><HeroMetric icon={<FlaskConical className="h-4 w-4" />} label="Latest NPK" value={latest?.npk_ratio || "—"} /></div>
    </section>

    {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    {selectedPlan && <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Soil history stays global</p><p className="mt-1 text-xs text-muted-foreground">Amendments are recorded against shared physical plots, not crop successions. The active Game Plan therefore highlights its physical plot footprint without hiding soil history from other seasons.</p></div><Button asChild variant="outline" size="sm"><Link href={withGamePlanQuery(`/${language}/orchard/crop-map`, selectedPlanId)}><MapIcon className="mr-2 h-4 w-4" />Open scoped crop map</Link></Button></CardContent></Card>}

    <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">01</p><h2 className="mt-2">Amendment history</h2><p className="mt-1 text-sm text-muted-foreground">Every application stays tied to a plot, quantity, product and nutrient profile.</p></div>
        {amendments.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">{t("orchard.no_amendments")}</div> : <div className="grid gap-4 md:grid-cols-2">{amendments.map((item, index) => <article key={item.id} className={`overflow-hidden border bg-background ${selectedPlan && planPlotIds.has(item.plot_id) ? "ring-1 ring-primary/35" : ""}`}><div className="relative h-44 overflow-hidden"><img src={index % 2 ? compostPhoto : soilPhoto} alt={index % 2 ? "Compost and organic matter used as a soil amendment" : "Healthy garden soil and plant growth"} className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.76),rgba(0,0,0,.08)_70%)]" /><div className="absolute inset-x-4 bottom-4 text-white"><div className="flex flex-wrap gap-2"><Badge className="border-white/15 bg-black/35 text-white">{item.amendment_type}</Badge>{item.npk_ratio && <Badge variant="outline" className="border-white/20 bg-black/25 text-white">NPK {item.npk_ratio}</Badge>}{selectedPlan && planPlotIds.has(item.plot_id) && <Badge className="border-white/15 bg-white/15 text-white">In plan footprint</Badge>}</div><h3 className="mt-2 text-xl text-white!">{item.product_name}</h3><p className="mt-1 text-xs text-white/70">{plotName(item.plot_id)} · {new Date(`${item.application_date}T12:00:00`).toLocaleDateString()}</p></div></div><div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"><Datum label="Quantity" value={`${item.quantity_kg} kg`} /><Datum label="Method" value={item.application_method || "—"} /><Datum label="Plot" value={plotName(item.plot_id)} /><Datum label="NPK" value={item.npk_ratio || "—"} /></div>{item.description && <p className="p-4 text-sm leading-6 text-muted-foreground">{item.description}</p>}</article>)}</div>}
      </div>

      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Plot amendment load</CardTitle><CardDescription>Where recorded soil inputs have been applied across the shared physical orchard.</CardDescription></CardHeader><CardContent className="space-y-4">{byPlot.length === 0 ? <p className="text-sm text-muted-foreground">No plot activity yet.</p> : byPlot.map((item) => { const share = totalKg > 0 ? Math.round((item.kg / totalKg) * 100) : 0; return <div key={item.plot.id}><div className="flex items-end justify-between gap-3"><div><p className="font-medium">{item.plot.name}{selectedPlan && planPlotIds.has(item.plot.id) ? " · plan footprint" : ""}</p><p className="text-xs text-muted-foreground">{item.rows.length} applications · {item.last ? new Date(`${item.last}T12:00:00`).toLocaleDateString() : "—"}</p></div><p className="text-sm font-medium">{item.kg.toFixed(1)} kg</p></div><div className="mt-2 h-2 bg-muted"><div className="h-full bg-foreground" style={{ width: `${share}%` }} /></div></div> })}</CardContent></Card>
        <Card className="overflow-hidden"><div className="relative h-48"><img src={compostPhoto} alt="Three-bin compost system with decomposing organic matter" className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-black/35" /><div className="absolute bottom-4 left-4 right-4 text-white"><Droplets className="mb-2 h-5 w-5" /><p className="font-medium">Soil record, not decoration</p><p className="mt-1 text-xs text-white/70">The value here is traceability by plot and amendment event; no synthetic soil scores are invented.</p></div></div></Card>
      </div>
    </section>
  </main></AppLayout>
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="bg-background p-3"><p className="text-[10px] uppercase tracking-[.13em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
function HeroMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="min-w-36 bg-black/45 px-5 py-4 text-white"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-white/55">{icon}{label}</div><p className="mt-1 text-2xl font-medium text-white">{value}</p></div> }

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, Gauge, Map as MapIcon, Rows3 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id:string; season:string|null; status:string }
type Plot = { id:string; name:string }
type Bed = { id:string; plot_id:string; name:string; length_m:number|null }
type Cycle = { id:string; game_plan_id:string }
type Succession = { id:string; crop_cycle_id:string }
type Allocation = { id:string; bed_id:string; crop_succession_id:string; planned_start_date:string|null; planned_end_date:string|null; allocated_length_m:number|null }
type Peak = { meters:number; date:string|null }

const PHYSICAL_BLOCK = /^(Current 0[1-5]|Expansion 0[1-3])$/
const copy = {
  en:{eyebrow:"Dietrich · Beds & Capacity",title:"Verified field capacity",description:"Capacity comes from the canonical Black Swan physical model. Seasonal allocated meters and simultaneous occupancy stay separate so temporal bed reuse is visible.",blocks:"Physical blocks",beds:"Canonical beds",capacity:"Physical capacity",peak:"Peak simultaneous",headroom:"Peak headroom",plantings:"Reconciled plantings",seasonal:"Season allocation",usedBeds:"Beds touched",verified:"The production model is physically reconciled: 5 Current blocks + 3 Expansion blocks. Each bed contributes its recorded length; spreadsheet containers are not treated as physical beds.",block:"Block",bedCount:"Beds",blockCapacity:"Capacity",touched:"Touched by plan",peakDate:"Peak date",occupancy:"Peak occupancy",advanced:"Open Crop Map workspace",source:"Physical ownership: Supabase orchard_plots + orchard_beds + orchard_bed_allocations. Workbook capacity sheets remain reference evidence only.",loadError:"Could not load canonical capacity."},
  es:{eyebrow:"Dietrich · Camas y Capacidad",title:"Capacidad física verificada",description:"La capacidad viene del modelo físico canónico de Black Swan. Los metros asignados durante la temporada y la ocupación simultánea se mantienen separados para mostrar la reutilización temporal de camas.",blocks:"Bloques físicos",beds:"Camas canónicas",capacity:"Capacidad física",peak:"Peak simultáneo",headroom:"Holgura en peak",plantings:"Plantaciones reconciliadas",seasonal:"Asignación temporada",usedBeds:"Camas utilizadas",verified:"El modelo productivo está físicamente reconciliado: 5 bloques Current + 3 bloques Expansion. Cada cama aporta su longitud registrada; los contenedores históricos del Excel no se tratan como camas físicas.",block:"Bloque",bedCount:"Camas",blockCapacity:"Capacidad",touched:"Usadas por el plan",peakDate:"Fecha peak",occupancy:"Ocupación peak",advanced:"Abrir workspace de Crop Map",source:"Ownership físico: Supabase orchard_plots + orchard_beds + orchard_bed_allocations. Las hojas de capacidad del workbook quedan sólo como evidencia de referencia.",loadError:"No fue posible cargar la capacidad canónica."},
  de:{eyebrow:"Dietrich · Beete & Kapazität",title:"Verifizierte Feldkapazität",description:"Die Kapazität stammt aus dem kanonischen physischen Black-Swan-Modell. Saisonale Zuweisungsmeter und gleichzeitige Belegung bleiben getrennt.",blocks:"Physische Blöcke",beds:"Kanonische Beete",capacity:"Physische Kapazität",peak:"Gleichzeitiger Peak",headroom:"Reserve am Peak",plantings:"Abgeglichene Pflanzungen",seasonal:"Saisonzuweisung",usedBeds:"Genutzte Beete",verified:"Das Produktionsmodell ist physisch abgeglichen: 5 Current-Blöcke + 3 Expansion-Blöcke. Jedes Beet trägt seine erfasste Länge bei; Spreadsheet-Container gelten nicht als physische Beete.",block:"Block",bedCount:"Beete",blockCapacity:"Kapazität",touched:"Vom Plan genutzt",peakDate:"Peak-Datum",occupancy:"Peak-Belegung",advanced:"Crop-Map-Arbeitsbereich öffnen",source:"Physischer Owner: Supabase orchard_plots + orchard_beds + orchard_bed_allocations. Workbook-Kapazitätsblätter bleiben Referenznachweise.",loadError:"Kanonische Kapazität konnte nicht geladen werden."},
} as const

function peakUsage(allocations:Allocation[]):Peak {
  const events = new globalThis.Map<string, number>()
  for (const allocation of allocations) {
    if (!allocation.planned_start_date || !allocation.planned_end_date) continue
    const meters = Number(allocation.allocated_length_m ?? 0)
    events.set(allocation.planned_start_date,(events.get(allocation.planned_start_date)??0)+meters)
    events.set(allocation.planned_end_date,(events.get(allocation.planned_end_date)??0)-meters)
  }
  let current=0, peak=0, peakDate:string|null=null
  for (const [date,delta] of [...events.entries()].sort(([a],[b])=>a.localeCompare(b))) {
    current += delta
    if (current > peak) { peak=current; peakDate=date }
  }
  return {meters:peak,date:peakDate}
}

export default function DietrichCapacityPage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]
  const [plans,setPlans]=useState<Plan[]>([]),[plots,setPlots]=useState<Plot[]>([]),[beds,setBeds]=useState<Bed[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([])
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)
  useEffect(()=>{let live=true;setLoading(true);setError(null);void Promise.all([
    supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
    supabase.from("orchard_plots").select("id,name").order("name"),
    supabase.from("orchard_beds").select("id,plot_id,name,length_m").order("planning_order"),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id"),
    supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_length_m"),
  ]).then(([p,pl,b,c,s,a])=>{if(!live)return;const first=p.error??pl.error??b.error??c.error??s.error??a.error;if(first){setError(`${text.loadError} ${first.message}`);setLoading(false);return}setPlans((p.data??[]) as Plan[]);setPlots((pl.data??[]) as Plot[]);setBeds((b.data??[]) as Bed[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);setLoading(false)});return()=>{live=false}},[supabase,text.loadError])

  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const physicalPlots=plots.filter(plot=>PHYSICAL_BLOCK.test(plot.name)); const physicalPlotIds=new Set(physicalPlots.map(plot=>plot.id))
  const physicalBeds=beds.filter(bed=>physicalPlotIds.has(bed.plot_id)); const physicalBedIds=new Set(physicalBeds.map(bed=>bed.id))
  const cycleIds=new Set(cycles.filter(cycle=>cycle.game_plan_id===plan?.id).map(cycle=>cycle.id)); const successionIds=new Set(successions.filter(s=>cycleIds.has(s.crop_cycle_id)).map(s=>s.id))
  const scopedAllocations=allocations.filter(allocation=>successionIds.has(allocation.crop_succession_id)&&physicalBedIds.has(allocation.bed_id))
  const reconciledPlantings=new Set(scopedAllocations.map((allocation)=>allocation.crop_succession_id)).size
  const usedBedIds=new Set(scopedAllocations.map(allocation=>allocation.bed_id))
  const capacityM=physicalBeds.reduce((sum,bed)=>sum+Number(bed.length_m??0),0); const seasonMeters=scopedAllocations.reduce((sum,a)=>sum+Number(a.allocated_length_m??0),0)
  const peak=peakUsage(scopedAllocations); const headroom=Math.max(0,capacityM-peak.meters); const occupancyPct=capacityM>0?(peak.meters/capacityM)*100:0
  const advancedHref=`/${language}/orchard/crop-map${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`; const locale=lang==="es"?"es-CL":lang==="de"?"de-DE":"en-US"

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1380px] px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
    {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>:<>
      <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric icon={MapIcon} label={text.blocks} value={physicalPlots.length}/><Metric icon={Rows3} label={text.beds} value={physicalBeds.length}/><Metric icon={Gauge} label={text.capacity} value={capacityM} unit="m"/><Metric icon={Gauge} label={text.peak} value={peak.meters} unit="m"/></section>
      <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric label={text.headroom} value={headroom} unit="m"/><Metric label={text.plantings} value={reconciledPlantings}/><Metric label={text.seasonal} value={seasonMeters} unit="m"/><Metric label={text.usedBeds} value={usedBedIds.size}/></section>
      <div className="mb-6 flex gap-3 border border-[#cfe0d5] bg-[#f3f8f5] p-4 text-sm text-[#345744]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/><span>{text.verified}</span></div>
      <section className="mb-6 bg-[var(--bs-surface-primary)] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.occupancy}</p><p className="mt-2 text-3xl tabular-nums">{occupancyPct.toFixed(1)}%</p></div><div className="text-right"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.peakDate}</p><p className="mt-2 text-sm">{peak.date?new Date(`${peak.date}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"long",year:"numeric"}):"—"}</p></div></div><div className="mt-5 h-2 bg-[var(--bs-surface-tertiary)]"><div className="h-full bg-[var(--orchard-green)]" style={{width:`${Math.min(100,occupancyPct)}%`}}/></div></section>
      <section className="overflow-hidden border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]"><div className="grid grid-cols-[1fr_120px_150px_150px] border-b border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-secondary)] px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground"><span>{text.block}</span><span>{text.bedCount}</span><span>{text.blockCapacity}</span><span>{text.touched}</span></div>{physicalPlots.map(plot=>{const blockBeds=physicalBeds.filter(b=>b.plot_id===plot.id);const blockCapacity=blockBeds.reduce((sum,b)=>sum+Number(b.length_m??0),0);const touched=blockBeds.filter(b=>usedBedIds.has(b.id)).length;return <div key={plot.id} className="grid grid-cols-[1fr_120px_150px_150px] border-b border-[var(--bs-divider-subtle)] px-4 py-3 text-sm last:border-b-0"><strong className="font-medium">{plot.name}</strong><span>{blockBeds.length}</span><span>{blockCapacity.toLocaleString(locale)} m</span><span>{touched}/{blockBeds.length}</span></div>})}</section>
      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
    </>}
  </main></AppLayout>
}

function Metric({icon:Icon,label,value,unit}:{icon?:typeof MapIcon;label:string;value:number;unit?:string}){return <div className="bg-[var(--bs-surface-primary)] p-5">{Icon?<Icon className="h-4 w-4 text-muted-foreground"/>:null}<p className={`${Icon?"mt-4":""} text-xs uppercase tracking-wide text-muted-foreground`}>{label}</p><p className="mt-2 text-3xl tabular-nums">{value.toLocaleString("es-CL",{maximumFractionDigits:1})}{unit?<span className="ml-1 text-sm text-muted-foreground">{unit}</span>:null}</p></div>}

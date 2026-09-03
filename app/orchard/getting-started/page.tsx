"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, Circle, MapPinned, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import {
  CORE_FARM_AREA_1_LAYOUT_REFERENCE,
  HEIRLOOM_ONBOARDING_STEPS,
  HEIRLOOM_REFERENCE_PEAK_BED_METERS,
  HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS,
  HEIRLOOM_REFERENCE_PLANTINGS,
  HEIRLOOM_REFERENCE_SETUP,
} from "@/lib/orchard/heirloom-parity"

type Locale = "en" | "es" | "de"
type Plan = { id:string; name:string; season:string|null; start_date:string; end_date:string; status:string }
type Plot = { id:string; name:string; status:string|null }
type Cycle = { id:string; game_plan_id:string }
type Succession = { id:string; crop_cycle_id:string; status:string; planned_bed_m:number|null }
type Bed = { id:string; plot_id:string; length_m:number|null; status:string }
type Allocation = { crop_succession_id:string }
type RevenueTarget = { crop_succession_id:string }
type TaskRef = { source_id:string|null; source_type:string|null }
type StepText = { label:string; description:string }

type LiveSnapshot = {
  plans: Plan[]
  plots: Plot[]
  cycles: Cycle[]
  successions: Succession[]
  beds: Bed[]
  allocations: Allocation[]
  revenueTargets: RevenueTarget[]
  chartDefinitions: number
  seedLots: number
  tasks: TaskRef[]
}

const copy = {
  en:{eyebrow:"Orchard · Getting Started",title:"One operating journey from farm map to workload",description:"Progress is calculated from current Core records. Historical Heirloom observations remain reference evidence and never overwrite the operational layout.",gamePlan:"Game Plan",loading:"Loading Orchard state…",loadError:"Could not load the Orchard onboarding state.",complete:"complete",completed:"Completed",pending:"Pending",openStep:"Open step",reference:"Historical Heirloom reference",coreLive:"Core live",referenceHelp:"Authenticated behavior observed on 01 Sep 2026. Reference only.",coreHelp:"Current authorized Supabase state for the selected Game Plan.",physicalBeds:"Physical beds",plantings:"Plantings",capacity:"Bed-meter capacity",assigned:"Assigned plantings",peak:"Reference peak demand",syncTitle:"Farm Area 1 synchronized",syncBody:"The current operational model is 5 current blocks + 3 expansion blocks, 10 beds per block. Crop Map completion requires every reconciled planting to have a physical allocation.",truth:"Completion criteria are strict and data-backed."},
  es:{eyebrow:"Orchard · Primeros pasos",title:"Un solo recorrido operativo desde el mapa hasta la carga de trabajo",description:"El avance se calcula desde los registros actuales de Core. Las observaciones históricas de Heirloom quedan como evidencia y nunca reemplazan el layout operativo.",gamePlan:"Plan de Cultivo",loading:"Cargando estado de Orchard…",loadError:"No fue posible cargar el estado de onboarding de Orchard.",complete:"completado",completed:"Completado",pending:"Pendiente",openStep:"Abrir paso",reference:"Referencia histórica Heirloom",coreLive:"Core en vivo",referenceHelp:"Comportamiento autenticado observado el 01 sep 2026. Sólo referencia.",coreHelp:"Estado autorizado actual de Supabase para el Plan seleccionado.",physicalBeds:"Camas físicas",plantings:"Plantaciones",capacity:"Capacidad bed-meter",assigned:"Plantaciones asignadas",peak:"Demanda peak de referencia",syncTitle:"Farm Area 1 sincronizada",syncBody:"El modelo operativo actual es 5 bloques actuales + 3 expansiones, con 10 camas por bloque. Crop Map sólo se considera completo cuando todas las plantaciones reconciliadas tienen ubicación física.",truth:"Los criterios de avance son estrictos y respaldados por datos."},
  de:{eyebrow:"Orchard · Erste Schritte",title:"Ein Betriebsablauf von der Farmkarte bis zur Arbeitslast",description:"Der Fortschritt wird aus aktuellen Core-Datensätzen berechnet. Historische Heirloom-Beobachtungen bleiben Referenzevidenz und ersetzen nie das Betriebsmodell.",gamePlan:"Game Plan",loading:"Orchard-Status wird geladen…",loadError:"Der Orchard-Onboarding-Status konnte nicht geladen werden.",complete:"abgeschlossen",completed:"Abgeschlossen",pending:"Offen",openStep:"Schritt öffnen",reference:"Historische Heirloom-Referenz",coreLive:"Core live",referenceHelp:"Authentifiziert beobachtetes Verhalten vom 01. Sep. 2026. Nur Referenz.",coreHelp:"Aktueller autorisierter Supabase-Status für den gewählten Game Plan.",physicalBeds:"Physische Beete",plantings:"Pflanzungen",capacity:"Beetmeter-Kapazität",assigned:"Zugeordnete Pflanzungen",peak:"Referenz-Spitzenbedarf",syncTitle:"Farm Area 1 synchronisiert",syncBody:"Das aktuelle Betriebsmodell besteht aus 5 bestehenden + 3 Erweiterungsblöcken mit je 10 Beeten. Crop Map gilt erst als abgeschlossen, wenn alle abgeglichenen Pflanzungen physisch zugeordnet sind.",truth:"Abschlusskriterien sind streng und datenbasiert."},
} as const

const statusLabels:Record<Locale,Record<string,string>>={
  en:{draft:"Draft",active:"Active",completed:"Completed",archived:"Archived"},
  es:{draft:"Borrador",active:"Activo",completed:"Completado",archived:"Archivado"},
  de:{draft:"Entwurf",active:"Aktiv",completed:"Abgeschlossen",archived:"Archiviert"},
}
const statusLabel=(status:string,locale:Locale)=>statusLabels[locale][status]??status.replaceAll("_"," ")

const stepCopy:Record<Locale,Record<string,StepText>> = {
  en:{},
  es:{
    "farm-map":{label:"Mapea tu granja",description:"Crea el área de la granja y sus estructuras físicas de cultivo."},
    "favorite-crop":{label:"Elige tus cultivos",description:"Selecciona cultivos y cultivares para la temporada."},
    "game-plan":{label:"Crea tu plan de cultivo",description:"Planifica las sucesiones de cultivo en el calendario de temporada."},
    "crop-map":{label:"Organiza tu mapa de cultivos",description:"Asigna las plantaciones a camas físicas o estructuras protegidas."},
    "financial-forecast":{label:"Proyecta el resultado financiero",description:"Define rendimiento planificado, precios y objetivos de ingresos."},
    "data-charts":{label:"Revisa tus gráficos de datos",description:"Revisa las vistas agronómicas que alimentan la operación."},
    "seed-inventory":{label:"Revisa el inventario de semillas",description:"Comprueba inventario y preparación de compra de semillas."},
    "workload":{label:"Gestiona tu carga de trabajo",description:"Revisa trabajo generado y ad hoc en lista, semana y carga."},
  },
  de:{
    "farm-map":{label:"Farm kartieren",description:"Farmfläche und physische Anbaustrukturen anlegen."},
    "favorite-crop":{label:"Kulturen auswählen",description:"Kulturen und Sorten für die Saison auswählen."},
    "game-plan":{label:"Anbauplan erstellen",description:"Kulturfolgen im Saisonkalender planen."},
    "crop-map":{label:"Anbaukarte organisieren",description:"Pflanzungen physischen Beeten oder geschützten Strukturen zuordnen."},
    "financial-forecast":{label:"Finanzprognose planen",description:"Geplante Erträge, Preise und Umsatzziele festlegen."},
    "data-charts":{label:"Datendiagramme prüfen",description:"Agronomische Datenansichten prüfen, die den Betrieb speisen."},
    "seed-inventory":{label:"Saatgutbestand prüfen",description:"Saatgutbestand und Beschaffungsbereitschaft prüfen."},
    "workload":{label:"Arbeitslast verwalten",description:"Generierte und Ad-hoc-Arbeit in Liste, Woche und Auslastung prüfen."},
  },
}

const CORE_BLOCK_NAMES = new Set<string>(CORE_FARM_AREA_1_LAYOUT_REFERENCE.blocks.map(block=>block.name))
const initialSnapshot:LiveSnapshot={plans:[],plots:[],cycles:[],successions:[],beds:[],allocations:[],revenueTargets:[],chartDefinitions:0,seedLots:0,tasks:[]}

export default function OrchardGettingStartedPage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage();const locale:Locale=language;const text=copy[locale]
  const [snapshot,setSnapshot]=useState<LiveSnapshot>(initialSnapshot)
  const [selectedPlanId,setSelectedPlanId]=useState("")
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  const load=useCallback(async()=>{
    setLoading(true);setError(null)
    const [plans,plots,cycles,successions,beds,allocations,revenueTargets,charts,seeds,tasks]=await Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date",{ascending:false}),
      supabase.from("orchard_plots").select("id,name,status").eq("status","active"),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,status,planned_bed_m").neq("status","cancelled"),
      supabase.from("orchard_beds").select("id,plot_id,length_m,status").eq("status","active"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id"),
      supabase.from("orchard_revenue_targets").select("crop_succession_id"),
      supabase.from("orchard_chart_definitions").select("id",{count:"exact",head:true}),
      supabase.from("orchard_seed_lots").select("id",{count:"exact",head:true}),
      supabase.from("tasks").select("source_id,source_type").in("operational_area",["orchard","huerto_vinedo"]),
    ])
    const firstError=plans.error??plots.error??cycles.error??successions.error??beds.error??allocations.error??revenueTargets.error??charts.error??seeds.error??tasks.error
    if(firstError){setError(`${text.loadError} ${firstError.message}`);setLoading(false);return}
    const next:LiveSnapshot={plans:(plans.data??[]) as Plan[],plots:(plots.data??[]) as Plot[],cycles:(cycles.data??[]) as Cycle[],successions:(successions.data??[]) as Succession[],beds:(beds.data??[]) as Bed[],allocations:(allocations.data??[]) as Allocation[],revenueTargets:(revenueTargets.data??[]) as RevenueTarget[],chartDefinitions:charts.count??0,seedLots:seeds.count??0,tasks:(tasks.data??[]) as TaskRef[]}
    setSnapshot(next)
    setSelectedPlanId(current=>{
      if(current&&next.plans.some(plan=>plan.id===current))return current
      const requested=new URLSearchParams(window.location.search).get("game_plan")
      return next.plans.find(plan=>plan.id===requested)?.id??next.plans.find(plan=>plan.season==="2026/27")?.id??next.plans.find(plan=>plan.status==="active")?.id??next.plans.find(plan=>plan.status==="draft")?.id??next.plans[0]?.id??""
    })
    setLoading(false)
  },[supabase,text.loadError])
  useEffect(()=>{void load()},[load])

  const selectedPlan=snapshot.plans.find(plan=>plan.id===selectedPlanId)??null
  const scopedCycles=snapshot.cycles.filter(cycle=>cycle.game_plan_id===selectedPlanId)
  const cycleIds=new Set(scopedCycles.map(cycle=>cycle.id))
  const allPlanSuccessions=snapshot.successions.filter(succession=>cycleIds.has(succession.crop_cycle_id))
  const scopedSuccessions=allPlanSuccessions.filter(succession=>Number(succession.planned_bed_m)>0)
  const reconciledIds=new Set(scopedSuccessions.map(succession=>succession.id))
  const scopedAllocations=snapshot.allocations.filter(allocation=>reconciledIds.has(allocation.crop_succession_id))
  const allocatedSuccessionIds=new Set(scopedAllocations.map(allocation=>allocation.crop_succession_id))
  const unallocatedCount=scopedSuccessions.filter(succession=>!allocatedSuccessionIds.has(succession.id)).length
  const scopedRevenueTargets=snapshot.revenueTargets.filter(target=>reconciledIds.has(target.crop_succession_id))
  const scopedTasks=snapshot.tasks.filter(task=>Boolean(task.source_id&&reconciledIds.has(task.source_id)))
  const corePlots=snapshot.plots.filter(plot=>CORE_BLOCK_NAMES.has(plot.name))
  const corePlotIds=new Set(corePlots.map(plot=>plot.id))
  const coreBeds=snapshot.beds.filter(bed=>corePlotIds.has(bed.plot_id))
  const liveBedMeters=coreBeds.reduce((sum,bed)=>sum+Number(bed.length_m??0),0)
  const physicalLayoutReady=corePlots.length===CORE_FARM_AREA_1_LAYOUT_REFERENCE.blockCount&&coreBeds.length===CORE_FARM_AREA_1_LAYOUT_REFERENCE.totalBeds&&liveBedMeters===CORE_FARM_AREA_1_LAYOUT_REFERENCE.totalCapacityBedMeters
  const cropMapReady=scopedSuccessions.length>0&&unallocatedCount===0

  const completion=[physicalLayoutReady,scopedCycles.length>0,scopedSuccessions.length>0,cropMapReady,scopedRevenueTargets.length>0,snapshot.chartDefinitions>0,snapshot.seedLots>0,scopedTasks.length>0]
  const completedCount=completion.filter(Boolean).length
  const scopedHref=(path:string)=>`/${language}${path}${selectedPlanId?`?game_plan=${encodeURIComponent(selectedPlanId)}`:""}`

  return <AppLayout>
    <OrchardNavigation/>
    <main className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="grid gap-5 border-b border-[var(--orchard-line)] pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><h1 className="mt-2 text-3xl font-normal sm:text-4xl">{text.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p></div>
        <div className="min-w-[250px]"><p className="mb-2 text-xs font-medium text-muted-foreground">{text.gamePlan}</p><Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={loading||snapshot.plans.length===0}><SelectTrigger aria-label={text.gamePlan}><SelectValue placeholder={text.gamePlan}/></SelectTrigger><SelectContent>{snapshot.plans.map(plan=><SelectItem key={plan.id} value={plan.id}>{plan.season??plan.name} · {statusLabel(plan.status,locale)}</SelectItem>)}</SelectContent></Select></div>
      </header>

      {loading?<div className="py-16 text-sm text-muted-foreground">{text.loading}</div>:error?<div className="my-8 border-y border-red-400/30 py-4 text-sm text-red-300">{error}</div>:<>
        <section className="my-6 grid gap-0 border-y border-[var(--orchard-line)] lg:grid-cols-[300px_1fr]">
          <div className="py-5 pr-6 lg:border-r lg:border-[var(--orchard-line)]"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{selectedPlan?.season??selectedPlan?.name??text.gamePlan}</p><Badge variant="secondary">{completedCount}/8</Badge></div><div className="mt-4 h-1.5 overflow-hidden bg-[var(--bs-surface-tertiary)]"><div className="h-full bg-[var(--orchard-green)] transition-all" style={{width:`${(completedCount/8)*100}%`}}/></div><p className="mt-2 text-xs text-muted-foreground">{completedCount} / 8 {text.complete}. {text.truth}</p></div>
          <div className="flex gap-3 py-5 lg:pl-6"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orchard-green)]"/><div><p className="font-medium">{text.syncTitle}</p><p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{text.syncBody}</p></div></div>
        </section>

        <section className="grid overflow-hidden border-y border-[var(--orchard-line)] md:grid-cols-2 xl:grid-cols-4">
          {HEIRLOOM_ONBOARDING_STEPS.map((step,index)=>{const done=completion[index];const localized=stepCopy[locale][step.id]??step;return <Link key={step.id} href={scopedHref(step.coreHref)} className="group min-h-48 border-b border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-5 transition-colors hover:bg-[var(--bs-surface-secondary)] md:border-r xl:[&:nth-child(4n)]:border-r-0"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium tabular-nums text-muted-foreground">0{step.order}</span>{done?<CheckCircle2 className="h-5 w-5 text-[var(--orchard-green)]"/>:<Circle className="h-5 w-5 text-muted-foreground"/>}</div><h2 className="mt-7 text-lg font-normal">{localized.label}</h2><p className="mt-2 text-sm leading-5 text-muted-foreground">{localized.description}</p><div className="mt-5 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{done?text.completed:text.pending}</span><span className="flex items-center gap-1 text-xs font-medium text-[var(--orchard-green)]">{text.openStep}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"/></span></div></Link>})}
        </section>

        <section className="mt-8 grid gap-8 border-t border-[var(--orchard-line)] pt-6 xl:grid-cols-2">
          <article><div className="flex items-start gap-3"><MapPinned className="mt-0.5 h-5 w-5 text-[var(--orchard-green)]"/><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">{text.reference}</p><h2 className="mt-2 text-xl font-normal">{HEIRLOOM_REFERENCE_SETUP.fieldBlockName}</h2><p className="mt-1 text-sm text-muted-foreground">{text.referenceHelp}</p></div></div><div className="mt-5 grid grid-cols-2 border-y border-[var(--orchard-line)] sm:grid-cols-4"><Metric label={text.physicalBeds} value={`${HEIRLOOM_REFERENCE_SETUP.fieldBlockBeds}`}/><Metric label={text.plantings} value={`${HEIRLOOM_REFERENCE_PLANTINGS.length}`}/><Metric label={text.capacity} value={`${HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS} m`}/><Metric label={text.peak} value={`${HEIRLOOM_REFERENCE_PEAK_BED_METERS} m`}/></div></article>
          <article><div className="flex items-start gap-3"><Sprout className="mt-0.5 h-5 w-5 text-[var(--orchard-green)]"/><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">{text.coreLive}</p><h2 className="mt-2 text-xl font-normal">{selectedPlan?.name??text.gamePlan}</h2><p className="mt-1 text-sm text-muted-foreground">{text.coreHelp}</p></div></div><div className="mt-5 grid grid-cols-2 border-y border-[var(--orchard-line)] sm:grid-cols-4"><Metric label={text.physicalBeds} value={`${coreBeds.length}`}/><Metric label={text.plantings} value={`${scopedSuccessions.length}`}/><Metric label={text.capacity} value={`${liveBedMeters.toFixed(0)} m`}/><Metric label={text.assigned} value={`${scopedSuccessions.length-unallocatedCount}/${scopedSuccessions.length}`}/></div></article>
        </section>

        <div className="mt-5 flex justify-end"><Button variant="ghost" onClick={()=>void load()}>{text.coreLive}</Button></div>
      </>}
    </main>
  </AppLayout>
}

function Metric({label,value}:{label:string;value:string}){return <div className="border-r border-[var(--orchard-line)] px-3 py-4 last:border-r-0"><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-xl tabular-nums">{value}</p></div>}
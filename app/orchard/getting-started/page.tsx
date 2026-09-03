"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, Circle } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;status:string}
type Cycle={id:string;game_plan_id:string}
type Succession={id:string;crop_cycle_id:string;planned_bed_m:number|string|null}
type Allocation={crop_succession_id:string}
type RevenueTarget={crop_succession_id:string}
type TaskRef={source_id:string|null;source_type:string|null}
type Snapshot={plans:Plan[];cycles:Cycle[];successions:Succession[];allocations:Allocation[];revenueTargets:RevenueTarget[];tasks:TaskRef[];farmObjects:number;charts:number;seeds:number}
const initial:Snapshot={plans:[],cycles:[],successions:[],allocations:[],revenueTargets:[],tasks:[],farmObjects:0,charts:0,seeds:0}
const statusLabels:Record<Locale,Record<string,string>>={
 en:{draft:"Draft",active:"Active",completed:"Completed",archived:"Archived"},
 es:{draft:"Borrador",active:"Activo",completed:"Completado",archived:"Archivado"},
 de:{draft:"Entwurf",active:"Aktiv",completed:"Abgeschlossen",archived:"Archiviert"}
}
const statusLabel=(status:string,locale:Locale)=>statusLabels[locale][status]??status.replaceAll("_"," ")
const copy={
 en:{eyebrow:"Orchard · Getting Started",title:"Set up the farm in eight clear steps",description:"Start with the physical Farm Map. Then build the seasonal plan and place each planting in Crop Map.",loading:"Loading Orchard state…",error:"Could not load onboarding state.",complete:"complete",done:"Completed",pending:"Pending",open:"Open step",plan:"Game Plan",steps:[
  ["Map your farm","Place field blocks, greenhouses, tunnels and infrastructure on the aerial Farm Map."],["Choose your crops","Confirm the crops and cultivars used this season."],["Create your Game Plan","Plan crop successions across the season."],["Organize your Crop Map","Assign planned plantings to physical beds over time."],["Project financial forecasts","Set planned yields, prices and revenue targets."],["Review data charts","Review the agronomic views that feed operations."],["Check seed inventory","Confirm seed inventory and procurement readiness."],["Manage workload","Review generated and ad-hoc work."]]},
 es:{eyebrow:"Orchard · Primeros pasos",title:"Configura la granja en ocho pasos claros",description:"Parte por el Mapa de la granja físico. Luego construye el plan de temporada y ubica cada plantación en el Mapa de cultivos.",loading:"Cargando estado de Orchard…",error:"No fue posible cargar el onboarding.",complete:"completado",done:"Completado",pending:"Pendiente",open:"Abrir paso",plan:"Plan de cultivo",steps:[
  ["Mapea tu granja","Ubica bloques, invernaderos, túneles e infraestructura sobre la foto aérea."],["Elige tus cultivos","Confirma cultivos y cultivares para esta temporada."],["Crea tu plan de cultivo","Planifica las sucesiones a lo largo de la temporada."],["Organiza tu mapa de cultivos","Asigna las plantaciones planificadas a camas físicas en el tiempo."],["Proyecta el resultado financiero","Define rendimiento, precios y objetivos de ingreso."],["Revisa tus gráficos de datos","Revisa las vistas agronómicas que alimentan la operación."],["Revisa el inventario de semillas","Confirma inventario y preparación de compras."],["Gestiona tu carga de trabajo","Revisa trabajo generado y ad hoc."]]},
 de:{eyebrow:"Orchard · Erste Schritte",title:"Farm in acht klaren Schritten einrichten",description:"Mit der physischen Hofkarte beginnen. Danach Saisonplan erstellen und jede Pflanzung in der Anbaukarte platzieren.",loading:"Orchard-Status wird geladen…",error:"Onboarding konnte nicht geladen werden.",complete:"abgeschlossen",done:"Abgeschlossen",pending:"Offen",open:"Schritt öffnen",plan:"Anbauplan",steps:[
  ["Farm kartieren","Feldblöcke, Gewächshäuser, Tunnel und Infrastruktur auf dem Luftbild platzieren."],["Kulturen auswählen","Kulturen und Sorten für diese Saison bestätigen."],["Anbauplan erstellen","Kulturfolgen über die Saison planen."],["Anbaukarte organisieren","Geplante Pflanzungen zeitlich physischen Beeten zuordnen."],["Finanzprognose planen","Erträge, Preise und Umsatzziele definieren."],["Datendiagramme prüfen","Agronomische Betriebsansichten prüfen."],["Saatgutbestand prüfen","Bestand und Beschaffungsbereitschaft prüfen."],["Arbeitslast verwalten","Generierte und Ad-hoc-Arbeit prüfen."]]}
} as const

export default function OrchardGettingStartedPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const locale:Locale=language;const text=copy[locale]
 const [snapshot,setSnapshot]=useState<Snapshot>(initial),[selectedPlanId,setSelectedPlanId]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("orchard_game_plans").select("id,name,season,status").order("created_at",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,planned_bed_m").neq("status","cancelled"),
  supabase.from("orchard_bed_allocations").select("crop_succession_id"),
  supabase.from("orchard_revenue_targets").select("crop_succession_id"),
  supabase.from("tasks").select("source_id,source_type").in("operational_area",["orchard","huerto_vinedo"]),
  supabase.from("orchard_farm_map_objects").select("id",{count:"exact",head:true}).in("object_type",["field_block","greenhouse","tunnel","farm_area"]),
  supabase.from("orchard_chart_definitions").select("id",{count:"exact",head:true}),
  supabase.from("orchard_seed_lots").select("id",{count:"exact",head:true})
 ]).then(results=>{if(!live)return;const first=results.find(result=>result.error)?.error;if(first){setError(`${text.error} ${first.message}`);setLoading(false);return}const plans=(results[0].data??[]) as Plan[];setSnapshot({plans,cycles:(results[1].data??[]) as Cycle[],successions:(results[2].data??[]) as Succession[],allocations:(results[3].data??[]) as Allocation[],revenueTargets:(results[4].data??[]) as RevenueTarget[],tasks:(results[5].data??[]) as TaskRef[],farmObjects:results[6].count??0,charts:results[7].count??0,seeds:results[8].count??0});const requested=new URLSearchParams(window.location.search).get("game_plan");setSelectedPlanId(plans.find(plan=>plan.id===requested)?.id??plans.find(plan=>plan.season==="2026/27")?.id??plans.find(plan=>plan.status==="active")?.id??plans.find(plan=>plan.status==="draft")?.id??plans[0]?.id??"");setLoading(false)});return()=>{live=false}},[supabase,text.error])
 const cycles=snapshot.cycles.filter(c=>c.game_plan_id===selectedPlanId)
 const cycleIds=new Set(cycles.map(c=>c.id))
 const successions=snapshot.successions.filter(s=>cycleIds.has(s.crop_cycle_id)&&Number(s.planned_bed_m)>0)
 const reconciledIds=new Set(successions.map(s=>s.id))
 const allocated=new Set(snapshot.allocations.filter(a=>reconciledIds.has(a.crop_succession_id)).map(a=>a.crop_succession_id))
 const scopedRevenueTargets=snapshot.revenueTargets.filter(target=>reconciledIds.has(target.crop_succession_id))
 const scopedTasks=snapshot.tasks.filter(task=>Boolean(task.source_id&&reconciledIds.has(task.source_id)))
 const completion=[snapshot.farmObjects>0,cycles.length>0,successions.length>0,successions.length>0&&allocated.size===successions.length,scopedRevenueTargets.length>0,snapshot.charts>0,snapshot.seeds>0,scopedTasks.length>0]
 const completed=completion.filter(Boolean).length
 const routes=["/orchard/farm-map","/orchard/crops/catalog","/orchard/game-plan/season","/orchard/crop-map/overview","/orchard/game-plan/forecast","/orchard/charts","/orchard/game-plan/propagation","/orchard/work/week-board"]
 const href=(route:string)=>`/${language}${route}${selectedPlanId?`?game_plan=${encodeURIComponent(selectedPlanId)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 lg:px-8">
  <header className="grid gap-5 border-b border-[var(--orchard-line)] pb-5 lg:grid-cols-[1fr_280px] lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><h1 className="mt-2 text-3xl font-normal sm:text-4xl">{text.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p></div><label className="text-xs text-muted-foreground">{text.plan}<select value={selectedPlanId} onChange={e=>setSelectedPlanId(e.target.value)} className="mt-2 h-10 w-full border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] px-3 text-sm text-foreground outline-none">{snapshot.plans.map(plan=><option key={plan.id} value={plan.id}>{plan.season??plan.name} · {statusLabel(plan.status,locale)}</option>)}</select></label></header>
  {loading?<div className="py-16 text-sm text-muted-foreground">{text.loading}</div>:error?<div className="my-8 border-y border-red-400/30 py-4 text-sm text-red-300">{error}</div>:<>
   <section className="my-6 border-y border-[var(--orchard-line)] py-4"><div className="flex items-center justify-between gap-4"><p className="text-sm font-medium">{completed}/8 {text.complete}</p><span className="text-xs text-muted-foreground">{Math.round(completed/8*100)}%</span></div><div className="mt-3 h-1 overflow-hidden bg-[var(--bs-surface-tertiary)]"><div className="h-full bg-[var(--orchard-green)]" style={{width:`${completed/8*100}%`}}/></div></section>
   <section className="grid overflow-hidden border-y border-[var(--orchard-line)] md:grid-cols-2">{text.steps.map((step,index)=>{const done=completion[index];return <Link key={index} href={href(routes[index])} className="group grid min-h-40 grid-cols-[42px_1fr_auto] items-start gap-4 border-b border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-5 transition hover:bg-[var(--bs-surface-secondary)] md:odd:border-r"><span className="text-xs tabular-nums text-muted-foreground">0{index+1}</span><span><strong className="block text-lg font-normal">{step[0]}</strong><span className="mt-2 block max-w-xl text-sm leading-5 text-muted-foreground">{step[1]}</span><span className="mt-5 flex items-center gap-1 text-xs font-medium text-[var(--orchard-green)]">{text.open}<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1"/></span></span>{done?<CheckCircle2 className="h-5 w-5 text-[var(--orchard-green)]"/>:<Circle className="h-5 w-5 text-muted-foreground"/>}</Link>})}</section>
  </>}
 </main></AppLayout>
}

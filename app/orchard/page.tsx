"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, CalendarDays, CalendarRange, Leaf, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;start_date:string;end_date:string;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;cycle_type:string}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string;planned_transplant_date:string|null;planned_first_harvest_date:string|null;planned_last_harvest_date:string|null;status:string}
type Event={date:string;kind:"sow"|"transplant"|"harvest";crop:string;sequence:number}

const copy={
 en:{eyebrow:"Orchard · Today",title:"What needs attention in the orchard",description:"One operating view for Dietrich: the current Game Plan, the next field milestones and the nearest harvest windows.",season:"Game Plan",status:"Status",today:"Today",next7:"Next 7 days",overdue:"Past plan milestones",nextHarvest:"Next harvest",noToday:"No planned milestone today.",noUpcoming:"No planned milestone in the next 7 days.",noHarvest:"No future harvest window recorded.",planning:"This Game Plan is still in preparation. Dates below are planning milestones, not evidence that work has happened.",work:"Upcoming work",sow:"Sow",transplant:"Transplant",harvest:"First harvest",openPlan:"Open Game Plan",openTasks:"Open calendar & tasks",openField:"Open field",openHarvest:"Open harvest",source:"Canonical dates from Supabase · no work is marked complete automatically."},
 es:{eyebrow:"Huerto · Hoy",title:"Qué necesita atención en el huerto",description:"Una sola vista operacional para Dietrich: Game Plan actual, próximos hitos de campo y ventanas de cosecha más cercanas.",season:"Game Plan",status:"Estado",today:"Hoy",next7:"Próximos 7 días",overdue:"Hitos del plan vencidos",nextHarvest:"Próxima cosecha",noToday:"No hay hitos planificados para hoy.",noUpcoming:"No hay hitos planificados en los próximos 7 días.",noHarvest:"No hay próxima ventana de cosecha registrada.",planning:"Este Game Plan todavía está en preparación. Las fechas de abajo son hitos de planificación, no evidencia de que el trabajo haya ocurrido.",work:"Próximo trabajo",sow:"Sembrar",transplant:"Trasplantar",harvest:"Primera cosecha",openPlan:"Abrir Game Plan",openTasks:"Abrir calendario y tareas",openField:"Abrir Campo",openHarvest:"Abrir Cosecha",source:"Fechas canónicas desde Supabase · ningún trabajo se marca completado automáticamente."},
 de:{eyebrow:"Orchard · Heute",title:"Was im Garten Aufmerksamkeit braucht",description:"Eine Betriebsansicht für Dietrich: aktueller Game Plan, nächste Feldmeilensteine und nächste Erntefenster.",season:"Game Plan",status:"Status",today:"Heute",next7:"Nächste 7 Tage",overdue:"Überfällige Planmeilensteine",nextHarvest:"Nächste Ernte",noToday:"Heute kein geplanter Meilenstein.",noUpcoming:"In den nächsten 7 Tagen kein geplanter Meilenstein.",noHarvest:"Kein zukünftiges Erntefenster erfasst.",planning:"Dieser Game Plan ist noch in Vorbereitung. Die Termine unten sind Planungsmeilensteine, kein Nachweis ausgeführter Arbeit.",work:"Nächste Arbeiten",sow:"Aussaat",transplant:"Verpflanzen",harvest:"Erste Ernte",openPlan:"Game Plan öffnen",openTasks:"Kalender & Aufgaben öffnen",openField:"Feld öffnen",openHarvest:"Ernte öffnen",source:"Kanonische Termine aus Supabase · Arbeit wird nie automatisch als erledigt markiert."},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const statusLabels:Record<Locale,Record<string,string>>={en:{draft:"Draft",active:"Active",completed:"Completed",archived:"Archived"},es:{draft:"En preparación",active:"Activo",completed:"Completado",archived:"Archivado"},de:{draft:"In Vorbereitung",active:"Aktiv",completed:"Abgeschlossen",archived:"Archiviert"}}
const chileDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
const addDays=(value:string,days:number)=>{const d=new Date(`${value}T12:00:00-04:00`);d.setDate(d.getDate()+days);return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
const dateLabel=(value:string,locale:string)=>new Date(`${value}T12:00:00-04:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Santiago"})

export default function OrchardTodayPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,status").order("planned_sow_date"),
 ]).then(([p,c,s])=>{if(!live)return;setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setLoading(false)});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[];const cycleById=new Map(scopedCycles.map(c=>[c.id,c]));const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&s.status!=="cancelled")
 const events:Event[]=[];for(const s of scopedSuccessions){const c=cycleById.get(s.crop_cycle_id)!;events.push({date:s.planned_sow_date,kind:"sow",crop:c.crop_name,sequence:s.sequence_no});if(s.planned_transplant_date)events.push({date:s.planned_transplant_date,kind:"transplant",crop:c.crop_name,sequence:s.sequence_no});if(s.planned_first_harvest_date)events.push({date:s.planned_first_harvest_date,kind:"harvest",crop:c.crop_name,sequence:s.sequence_no})}
 events.sort((a,b)=>a.date.localeCompare(b.date));const today=chileDate();const in7=addDays(today,7);const todayEvents=events.filter(e=>e.date===today);const upcoming=events.filter(e=>e.date>today&&e.date<=in7);const overdue=events.filter(e=>e.date<today);const futureHarvest=events.find(e=>e.kind==="harvest"&&e.date>=today)??null
 const kindLabel=(kind:Event["kind"])=>kind==="sow"?text.sow:kind==="transplant"?text.transplant:text.harvest;const href=(path:string)=>`/${language}${path}${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 const displayEvents=(items:Event[])=>items.map(e=><article key={`${e.kind}-${e.crop}-${e.sequence}-${e.date}`} className="grid gap-3 bg-[var(--bs-surface-primary)] p-4 sm:grid-cols-[120px_1fr_auto]"><div><p className="text-sm font-medium">{dateLabel(e.date,locale)}</p></div><div><strong className="font-medium">{e.crop}</strong><p className="mt-1 text-xs text-muted-foreground">{kindLabel(e.kind)} · Succession {e.sequence}</p></div><Badge variant="secondary">{kindLabel(e.kind)}</Badge></article>)
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:!plan?<div className="py-12 text-sm text-muted-foreground">No Game Plan</div>:<>
   <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-4"><div className="bg-[var(--bs-surface-primary)] p-5"><CalendarRange className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.season}</p><p className="mt-2 text-xl">{plan.season??plan.name}</p><Badge className="mt-3" variant="secondary">{statusLabels[lang][plan.status]??plan.status}</Badge></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.today}</p><p className="mt-2 text-3xl tabular-nums">{todayEvents.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.next7}</p><p className="mt-2 text-3xl tabular-nums">{upcoming.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><Leaf className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.nextHarvest}</p><p className="mt-2 text-sm font-medium">{futureHarvest?futureHarvest.crop:text.noHarvest}</p>{futureHarvest?<p className="mt-1 text-xs text-muted-foreground">{dateLabel(futureHarvest.date,locale)}</p>:null}</div></section>
   {plan.status==="draft"?<p className="mb-6 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground"><AlertTriangle className="mr-2 inline h-4 w-4"/>{text.planning}</p>:null}
   <section className="mb-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-normal">{text.work}</h2><CalendarDays className="h-5 w-5 text-muted-foreground"/></div>{todayEvents.length?<div className="mb-px">{displayEvents(todayEvents)}</div>:<p className="mb-4 bg-[var(--bs-surface-primary)] p-4 text-sm text-muted-foreground">{text.noToday}</p>}{upcoming.length?<div className="space-y-px">{displayEvents(upcoming.slice(0,12))}</div>:<p className="bg-[var(--bs-surface-primary)] p-4 text-sm text-muted-foreground">{text.noUpcoming}</p>}</section>
   <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 lg:grid-cols-4">{[
    {href:"/orchard/game-plan/overview",label:text.openPlan,icon:CalendarRange},
    {href:"/orchard/game-plan/tasks",label:text.openTasks,icon:CalendarDays},
    {href:"/orchard/field",label:text.openField,icon:Sprout},
    {href:"/orchard/harvest",label:text.openHarvest,icon:Leaf},
   ].map(item=>{const Icon=item.icon;return <Link key={item.href} href={href(item.href)} className="group flex min-h-28 items-center justify-between gap-4 bg-[var(--bs-surface-primary)] p-5"><span className="flex items-center gap-3"><Icon className="h-4 w-4 text-muted-foreground"/><strong className="font-medium">{item.label}</strong></span><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"/></Link>})}</section>
   <div className="flex items-center justify-between gap-4 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground"><span>{text.source}</span><span>{text.overdue}: {overdue.length}</span></div>
  </>}
 </main></AppLayout>
}

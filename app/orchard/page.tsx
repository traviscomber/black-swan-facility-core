"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, CalendarDays, CalendarRange, Leaf, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { OrchardCropTile, OrchardMetricStrip, OrchardPhotoHero, OrchardStageRail } from "@/components/orchard/heirloom-visuals"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;start_date:string;end_date:string;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;cycle_type:string}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string;planned_transplant_date:string|null;planned_first_harvest_date:string|null;planned_last_harvest_date:string|null;status:string}
type Event={date:string;kind:"sow"|"transplant"|"harvest";crop:string;sequence:number}

const copy={
 en:{eyebrow:"Orchard · Today",title:"Run the orchard from one living seasonal picture",description:"A visual operating view of the active Game Plan: what is moving through propagation, what enters the field next and where harvest windows are opening.",season:"Game Plan",status:"Status",today:"Today",next7:"Next 7 days",overdue:"Past plan milestones",nextHarvest:"Next harvest",noToday:"No planned milestone today.",noUpcoming:"No planned milestone in the next 7 days.",noHarvest:"No future harvest window recorded.",planning:"This Game Plan is still in preparation. Dates below are planning milestones, not evidence that work has happened.",work:"This week in the orchard",sow:"Sow",transplant:"Transplant",harvest:"First harvest",openPlan:"Open Game Plan",openTasks:"Open calendar & tasks",openField:"Open field",openHarvest:"Open harvest",source:"Canonical dates from Supabase · no work is marked complete automatically.",rhythm:"Season rhythm",rhythmHelp:"The next recorded succession milestones, shown as a crop-led operational rail rather than a report table."},
 es:{eyebrow:"Huerto · Hoy",title:"Opera el huerto desde una sola imagen viva de la temporada",description:"Una vista operacional y visual del Game Plan activo: qué está avanzando en propagación, qué entra al campo y dónde se abren las próximas ventanas de cosecha.",season:"Game Plan",status:"Estado",today:"Hoy",next7:"Próximos 7 días",overdue:"Hitos del plan vencidos",nextHarvest:"Próxima cosecha",noToday:"No hay hitos planificados para hoy.",noUpcoming:"No hay hitos planificados en los próximos 7 días.",noHarvest:"No hay próxima ventana de cosecha registrada.",planning:"Este Game Plan todavía está en preparación. Las fechas de abajo son hitos de planificación, no evidencia de que el trabajo haya ocurrido.",work:"Esta semana en el huerto",sow:"Sembrar",transplant:"Trasplantar",harvest:"Primera cosecha",openPlan:"Abrir Game Plan",openTasks:"Abrir calendario y tareas",openField:"Abrir Campo",openHarvest:"Abrir Cosecha",source:"Fechas canónicas desde Supabase · ningún trabajo se marca completado automáticamente.",rhythm:"Ritmo de temporada",rhythmHelp:"Los próximos hitos registrados de las sucesiones, mostrados como un rail operacional centrado en los cultivos y no como una tabla."},
 de:{eyebrow:"Orchard · Heute",title:"Den Garten aus einem lebendigen Saisonbild steuern",description:"Eine visuelle Betriebsansicht des aktiven Game Plans: was sich in der Anzucht bewegt, was als Nächstes ins Feld kommt und wo Erntefenster beginnen.",season:"Game Plan",status:"Status",today:"Heute",next7:"Nächste 7 Tage",overdue:"Überfällige Planmeilensteine",nextHarvest:"Nächste Ernte",noToday:"Heute kein geplanter Meilenstein.",noUpcoming:"In den nächsten 7 Tagen kein geplanter Meilenstein.",noHarvest:"Kein zukünftiges Erntefenster erfasst.",planning:"Dieser Game Plan ist noch in Vorbereitung. Die Termine unten sind Planungsmeilensteine, kein Nachweis ausgeführter Arbeit.",work:"Diese Woche im Garten",sow:"Aussaat",transplant:"Verpflanzen",harvest:"Erste Ernte",openPlan:"Game Plan öffnen",openTasks:"Kalender & Aufgaben öffnen",openField:"Feld öffnen",openHarvest:"Ernte öffnen",source:"Kanonische Termine aus Supabase · Arbeit wird nie automatisch als erledigt markiert.",rhythm:"Saisonrhythmus",rhythmHelp:"Die nächsten erfassten Meilensteine der Anbaufolgen als kulturorientierte Betriebsschiene statt Berichtstabelle."},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const statusLabels:Record<Locale,Record<string,string>>={en:{draft:"Draft",active:"Active",completed:"Completed",archived:"Archived"},es:{draft:"En preparación",active:"Activo",completed:"Completado",archived:"Archivado"},de:{draft:"In Vorbereitung",active:"Aktiv",completed:"Abgeschlossen",archived:"Archiviert"}}
const chileDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
const addDays=(value:string,days:number)=>{const d=new Date(`${value}T12:00:00-04:00`);d.setDate(d.getDate()+days);return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
const dateLabel=(value:string,locale:string)=>new Date(`${value}T12:00:00-04:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Santiago"})
const image=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=92`
const heroImage=image("photo-1416879595882-3373a0480b5b")
const cropImage=(name:string)=>{const key=name.toLowerCase();if(key.includes("tomato"))return image("photo-1592924357228-91a4daadcfea");if(key.includes("lettuce"))return image("photo-1622206151226-18ca2c9ab4a1");if(key.includes("carrot"))return image("photo-1447175008436-054170c2e979");if(key.includes("onion"))return image("photo-1508747703725-719777637510");if(key.includes("basil"))return image("photo-1618375569909-3c8616cf7733");return image("photo-1523348837708-15d4a09cfac2")}

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
 const nextEvents=[...todayEvents,...upcoming].slice(0,6)
 const selectedSuccession=scopedSuccessions.find(s=>{const c=cycleById.get(s.crop_cycle_id);return c&&nextEvents.some(e=>e.crop===c.crop_name&&e.sequence===s.sequence_no)})??scopedSuccessions[0]??null
 const selectedCycle=selectedSuccession?cycleById.get(selectedSuccession.crop_cycle_id)??null:null
 const stageRail=selectedSuccession?[{label:text.sow,date:dateLabel(selectedSuccession.planned_sow_date,locale),complete:selectedSuccession.planned_sow_date<today,active:selectedSuccession.planned_sow_date===today},{label:text.transplant,date:selectedSuccession.planned_transplant_date?dateLabel(selectedSuccession.planned_transplant_date,locale):null,complete:Boolean(selectedSuccession.planned_transplant_date&&selectedSuccession.planned_transplant_date<today),active:selectedSuccession.planned_transplant_date===today},{label:text.harvest,date:selectedSuccession.planned_first_harvest_date?dateLabel(selectedSuccession.planned_first_harvest_date,locale):null,complete:Boolean(selectedSuccession.planned_first_harvest_date&&selectedSuccession.planned_first_harvest_date<today),active:selectedSuccession.planned_first_harvest_date===today}]:[]
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] space-y-8 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:!plan?<div className="py-12 text-sm text-muted-foreground">No Game Plan</div>:<>
   <OrchardPhotoHero eyebrow={text.eyebrow} title={text.title} description={text.description} image={heroImage}>
    <div className="mb-4 flex flex-wrap gap-2"><Badge className="border-white/15 bg-black/35 text-white">{plan.name}</Badge><Badge variant="outline" className="border-white/20 bg-black/25 text-white">{statusLabels[lang][plan.status]??plan.status}</Badge>{plan.season?<Badge variant="outline" className="border-white/20 bg-black/25 text-white">{plan.season}</Badge>:null}</div>
    <OrchardMetricStrip items={[{label:text.today,value:String(todayEvents.length)},{label:text.next7,value:String(upcoming.length)},{label:text.nextHarvest,value:futureHarvest?futureHarvest.crop:"—",detail:futureHarvest?dateLabel(futureHarvest.date,locale):text.noHarvest},{label:text.overdue,value:String(overdue.length)}]}/>
   </OrchardPhotoHero>
   {plan.status==="draft"?<p className="border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground"><AlertTriangle className="mr-2 inline h-4 w-4"/>{text.planning}</p>:null}

   {selectedSuccession&&selectedCycle?<section className="grid gap-5 xl:grid-cols-[.9fr_1.4fr]"><OrchardCropTile name={selectedCycle.crop_name} meta={`Succession ${selectedSuccession.sequence_no} · ${selectedSuccession.status}`} image={cropImage(selectedCycle.crop_name)} badge={text.rhythm}/><div className="border bg-card p-5 sm:p-6"><p className="text-[11px] uppercase tracking-[.18em] text-muted-foreground">{text.rhythm}</p><h2 className="mt-2 text-2xl font-medium tracking-[-.02em]">{selectedCycle.crop_name} · Succession {selectedSuccession.sequence_no}</h2><p className="mt-2 text-sm text-muted-foreground">{text.rhythmHelp}</p><div className="mt-6"><OrchardStageRail stages={stageRail}/></div></div></section>:null}

   <section><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">01 · {text.work}</p><h2 className="mt-2 text-3xl font-medium tracking-[-.03em]">{text.work}</h2></div><CalendarDays className="h-5 w-5 text-muted-foreground"/></div>{nextEvents.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{nextEvents.map(e=><OrchardCropTile key={`${e.kind}-${e.crop}-${e.sequence}-${e.date}`} name={e.crop} meta={`${kindLabel(e.kind)} · Succession ${e.sequence}`} image={cropImage(e.crop)} badge={dateLabel(e.date,locale)} footer={<div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{kindLabel(e.kind)}</span><Badge variant="secondary">{e.date===today?text.today:text.next7}</Badge></div>}/>)}</div>:<div className="border border-dashed p-8 text-sm text-muted-foreground">{text.noUpcoming}</div>}</section>

   <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
    {href:"/orchard/game-plan",label:text.openPlan,icon:CalendarRange,detail:plan.name},
    {href:"/orchard/work",label:text.openTasks,icon:CalendarDays,detail:`${todayEvents.length+upcoming.length} ${text.next7.toLowerCase()}`},
    {href:"/orchard/field",label:text.openField,icon:Sprout,detail:`${scopedSuccessions.length} successions`},
    {href:"/orchard/harvest",label:text.openHarvest,icon:Leaf,detail:futureHarvest?futureHarvest.crop:text.noHarvest},
   ].map(item=>{const Icon=item.icon;return <Link key={item.href} href={href(item.href)} className="group min-h-36 border bg-card p-5 transition hover:bg-muted/30"><div className="flex items-start justify-between gap-4"><div className="border bg-muted p-2"><Icon className="h-4 w-4"/></div><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"/></div><p className="mt-5 font-medium">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></Link>})}</section>

   <div className="flex items-center justify-between gap-4 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground"><span>{text.source}</span><span>{text.season}: {plan.season??plan.name}</span></div>
  </>}
 </main></AppLayout>
}

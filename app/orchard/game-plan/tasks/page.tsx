"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, CheckSquare2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import cropTaskReference from "@/data/orchard/dietrich-crop-tasks-2026-27.json"

type Locale="en"|"es"|"de"
type Plan={id:string;season:string|null;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;cycle_type:string}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string;planned_transplant_date:string|null}
type RefTask={task:string;day_offset:number|string}
type RefCrop={crop:string;tasks:RefTask[]}
type ScheduledTask={crop:string;sequence:number;task:string;date:string|null;timing:string;anchor:string}

const copy={
 en:{eyebrow:"Dietrich · Calendar & Tasks",title:"The Crop Associated Task sheet, turned into a usable calendar",description:"Black Swan calculates reference dates from the canonical sow/transplant plan. These are planning recommendations from Dietrich's workbook, not completed work or automatically assigned tasks.",templates:"Crop task templates",scheduled:"Dated reference tasks",crops:"Crops with templates",calendar:"Planning calendar",crop:"Crop",task:"Task",timing:"Timing",anchor:"Plan anchor",noSchedule:"No dated task references could be matched to this Game Plan.",reference:"Reference templates",advanced:"Open accountable task management",source:"Source: Crop Associated Task · Copy of Crop Plan 26-27 Black Swan Test.xlsx",warning:"Reference only · Creating, assigning or completing a real task remains an explicit operational action."},
 es:{eyebrow:"Dietrich · Calendario y Tareas",title:"La hoja Crop Associated Task convertida en un calendario usable",description:"Black Swan calcula fechas de referencia desde el plan canónico de siembra/trasplante. Son recomendaciones de planificación del Excel de Dietrich, no trabajo realizado ni tareas asignadas automáticamente.",templates:"Plantillas por cultivo",scheduled:"Tareas de referencia con fecha",crops:"Cultivos con plantilla",calendar:"Calendario de planificación",crop:"Cultivo",task:"Tarea",timing:"Momento",anchor:"Hito base",noSchedule:"No se pudieron vincular tareas con fecha a este Game Plan.",reference:"Plantillas de referencia",advanced:"Abrir gestión de tareas responsables",source:"Fuente: Crop Associated Task · Copy of Crop Plan 26-27 Black Swan Test.xlsx",warning:"Sólo referencia · Crear, asignar o completar una tarea real sigue siendo una acción operacional explícita."},
 de:{eyebrow:"Dietrich · Kalender & Aufgaben",title:"Das Blatt Crop Associated Task als nutzbarer Kalender",description:"Black Swan berechnet Referenztermine aus dem kanonischen Aussaat-/Pflanzplan. Es sind Planungsempfehlungen aus Dietrichs Workbook, keine erledigte Arbeit oder automatisch zugewiesene Aufgaben.",templates:"Kulturvorlagen",scheduled:"Datierte Referenzaufgaben",crops:"Kulturen mit Vorlage",calendar:"Planungskalender",crop:"Kultur",task:"Aufgabe",timing:"Zeitpunkt",anchor:"Plananker",noSchedule:"Keine datierten Aufgabenreferenzen konnten diesem Game Plan zugeordnet werden.",reference:"Referenzvorlagen",advanced:"Verbindliche Aufgabenverwaltung öffnen",source:"Quelle: Crop Associated Task · Copy of Crop Plan 26-27 Black Swan Test.xlsx",warning:"Nur Referenz · Das Erstellen, Zuweisen oder Abschließen realer Aufgaben bleibt eine explizite Betriebsaktion."},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateKey=(value:string,days:number)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const dateLabel=(value:string,locale:string)=>new Date(`${value}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"})
const normalize=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()

function referenceFor(crop:string,cycleType:string){
 const key=normalize(crop)
 const aliases:Record<string,string[]>={
  "storage beetroot":["beets storage"],"bush beans":["bush beans"],broccoli:["cabbages broccoli"],"storage cabbage":["cabbages broccoli"],"chinese cabbage":["cabbages broccoli"],cauliflower:["cauliflowers"],"cilantro coriander":["coriander"],"storage squash":["courges d hiver"],"green onion scallion":["green onions"],onion:["onions"],zucchini:["summer squash"],"swiss chard":["swiss chard"],peas:["sweet peas"],radishes:["radishes"],arugula:["arugula"],carrots:["carrots"],basil:["basil"],kale:["kale"],lettuce:["lettuce"]
 }
 if(key==="spinach") return (cropTaskReference as RefCrop[]).find(r=>normalize(r.crop)===`spinach ${cycleType==="direct_sow"?"ds":"tr"}`)??null
 const needles=[key,...(aliases[key]??[])]
 return (cropTaskReference as RefCrop[]).find(r=>needles.some(n=>normalize(r.crop)===n||normalize(r.crop).includes(n)||n.includes(normalize(r.crop))))??null
}

export default function DietrichTaskCalendarPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date").order("planned_sow_date"),
 ]).then(([p,c,s])=>{if(!live)return;setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setLoading(false)});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[];const cycleById=new Map(scopedCycles.map(c=>[c.id,c]));const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id))
 const scheduled:ScheduledTask[]=[]
 for(const s of scopedSuccessions){const cycle=cycleById.get(s.crop_cycle_id)!;const ref=referenceFor(cycle.crop_name,cycle.cycle_type);if(!ref)continue;const anchor=s.planned_transplant_date??s.planned_sow_date;for(const t of ref.tasks){if(typeof t.day_offset==="number"||/^-?\d+$/.test(String(t.day_offset))){const offset=Number(t.day_offset);scheduled.push({crop:cycle.crop_name,sequence:s.sequence_no,task:t.task,date:dateKey(anchor,offset),timing:offset===0?"0":`${offset>0?"+":""}${offset} d`,anchor})}else{scheduled.push({crop:cycle.crop_name,sequence:s.sequence_no,task:t.task,date:null,timing:String(t.day_offset),anchor})}}
 }
 scheduled.sort((a,b)=>(a.date??"9999").localeCompare(b.date??"9999")||a.crop.localeCompare(b.crop))
 const dated=scheduled.filter(t=>t.date);const advancedHref=`/${language}/orchard/work${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:<>
   <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3"><div className="bg-[var(--bs-surface-primary)] p-5"><CheckSquare2 className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.templates}</p><p className="mt-2 text-3xl tabular-nums">{(cropTaskReference as RefCrop[]).length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><CalendarDays className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.scheduled}</p><p className="mt-2 text-3xl tabular-nums">{dated.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.crops}</p><p className="mt-2 text-3xl tabular-nums">{new Set(scheduled.map(t=>t.crop)).size}</p></div></section>
   <p className="mb-5 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.warning}</p>
   <section><h2 className="mb-4 text-2xl font-normal">{text.calendar}</h2>{scheduled.length===0?<p className="text-sm text-muted-foreground">{text.noSchedule}</p>:<div className="space-y-px">{scheduled.map((item,index)=><article key={`${item.crop}-${item.sequence}-${item.task}-${index}`} className="grid gap-3 bg-[var(--bs-surface-primary)] p-4 sm:grid-cols-[1fr_1.2fr_.7fr_.8fr]"><div><strong className="font-medium">{item.crop}</strong><p className="mt-1 text-xs text-muted-foreground">Succession {item.sequence}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.task}</p><p className="mt-1 text-sm">{item.task}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.timing}</p><p className="mt-1 text-sm">{item.date?`${dateLabel(item.date,locale)} · ${item.timing}`:item.timing}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.anchor}</p><p className="mt-1 text-sm">{dateLabel(item.anchor,locale)}</p></div></article>)}</div>}</section>
   <div className="mt-6 flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
  </>}
 </main></AppLayout>
}

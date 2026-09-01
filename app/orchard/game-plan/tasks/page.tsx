"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, CheckSquare2, MapPinCheck, ShieldAlert } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import {
  ORCHARD_CROP_TASK_REFERENCE_PROFILES,
  ORCHARD_CROP_TASK_REFERENCE_SOURCE,
  cropTaskReferenceFor,
} from "@/lib/orchard/crop-task-reference"

type Locale="en"|"es"|"de"
type Plan={id:string;season:string|null;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string;planned_transplant_date:string|null}
type Allocation={crop_succession_id:string}
type ScheduledTask={crop:string;sequence:number;task:string;date:string;timing:string;anchor:string;offsetDays:number;sourceRow:number;sourceColumn:string;kind:"setup"|"offset"}

const copy={
 en:{eyebrow:"Dietrich · Calendar & Tasks",title:"Crop task references on the reconciled field plan",description:"Black Swan dates only source-observed Crop Associated Task actions against physically allocated successions. These are planning references, not completed work or automatically created tasks.",templates:"Source profiles",scheduled:"Dated references",matched:"Plantings with actions",unmatched:"Without source actions",calendar:"Planning reference calendar",task:"Source action",timing:"Timing",anchor:"Implantation anchor",noSchedule:"No dated source task references match the reconciled plantings in this Game Plan.",advanced:"Open accountable task management",source:"Source",warning:"Planning reference only · Real tasks still require an explicit responsible person and canonical Orchard location.",row:"row",loadError:"Could not load the reconciled task calendar.",setup:"setup"},
 es:{eyebrow:"Dietrich · Calendario y Tareas",title:"Referencias de labores sobre el plan de campo reconciliado",description:"Black Swan fecha sólo las acciones observadas en Crop Associated Task contra sucesiones con asignación física. Son referencias de planificación, no trabajo ejecutado ni tareas creadas automáticamente.",templates:"Perfiles fuente",scheduled:"Referencias con fecha",matched:"Plantaciones con acciones",unmatched:"Sin acciones fuente",calendar:"Calendario de referencias",task:"Acción fuente",timing:"Momento",anchor:"Hito de implantación",noSchedule:"No hay referencias de labores con fecha para las plantaciones reconciliadas de este Plan de Cultivo.",advanced:"Abrir gestión de tareas responsables",source:"Fuente",warning:"Sólo referencia de planificación · Las tareas reales siguen exigiendo responsable explícito y ubicación canónica de Orchard.",row:"fila",loadError:"No fue posible cargar el calendario reconciliado de tareas.",setup:"implantación"},
 de:{eyebrow:"Dietrich · Kalender & Aufgaben",title:"Arbeitsreferenzen auf dem abgeglichenen Feldplan",description:"Black Swan terminiert nur im Blatt Crop Associated Task beobachtete Aktionen für physisch zugeordnete Anbaufolgen. Dies sind Planungsreferenzen, keine erledigte Arbeit oder automatisch erstellte Aufgaben.",templates:"Quellprofile",scheduled:"Datierte Referenzen",matched:"Pflanzungen mit Aktionen",unmatched:"Ohne Quellaktionen",calendar:"Referenzkalender",task:"Quellaktion",timing:"Zeitpunkt",anchor:"Pflanzanker",noSchedule:"Keine datierten Arbeitsreferenzen passen zu den abgeglichenen Pflanzungen dieses Game Plans.",advanced:"Verbindliche Aufgabenverwaltung öffnen",source:"Quelle",warning:"Nur Planungsreferenz · Reale Aufgaben benötigen weiterhin eine explizit verantwortliche Person und einen kanonischen Orchard-Ort.",row:"Zeile",loadError:"Der abgeglichene Aufgabenkalender konnte nicht geladen werden.",setup:"Pflanzung"},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateKey=(value:string,days:number)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const dateLabel=(value:string,locale:string)=>new Date(`${value}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"})

export default function DietrichTaskCalendarPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)
 useEffect(()=>{let live=true;setLoading(true);setError(null);void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date").order("planned_sow_date"),
  supabase.from("orchard_bed_allocations").select("crop_succession_id"),
 ]).then(([p,c,s,a])=>{if(!live)return;const first=p.error??c.error??s.error??a.error;if(first){setError(`${text.loadError} ${first.message}`);setLoading(false);return}setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);setLoading(false)});return()=>{live=false}},[supabase,text.loadError])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[]
 const cycleById=new Map(scopedCycles.map(c=>[c.id,c]))
 const allocatedSuccessionIds=new Set(allocations.map(a=>a.crop_succession_id))
 const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&allocatedSuccessionIds.has(s.id))
 const scheduled:ScheduledTask[]=[]
 const matchedSuccessionIds=new Set<string>()
 const profiledSuccessionIds=new Set<string>()
 for(const s of scopedSuccessions){
  const cycle=cycleById.get(s.crop_cycle_id);if(!cycle)continue
  const profile=cropTaskReferenceFor(cycle.crop_name);if(!profile)continue
  profiledSuccessionIds.add(s.id)
  if(!profile.actions.length)continue
  matchedSuccessionIds.add(s.id)
  const anchor=s.planned_transplant_date??s.planned_sow_date
  for(const action of profile.actions){scheduled.push({crop:cycle.crop_name,sequence:s.sequence_no,task:action.activity,date:dateKey(anchor,action.offsetDays),timing:action.kind==="setup"?text.setup:`${action.offsetDays>0?"+":""}${action.offsetDays} d`,anchor,offsetDays:action.offsetDays,sourceRow:profile.sourceRow,sourceColumn:action.sourceColumn,kind:action.kind})}
 }
 scheduled.sort((a,b)=>a.date.localeCompare(b.date)||a.crop.localeCompare(b.crop)||a.sequence-b.sequence||a.offsetDays-b.offsetDays)
 const withoutSourceActions=scopedSuccessions.length-matchedSuccessionIds.size
 const advancedHref=`/${language}/orchard/work${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>:<>
   <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric icon={CheckSquare2} label={text.templates} value={`${ORCHARD_CROP_TASK_REFERENCE_PROFILES.length}`}/><Metric icon={CalendarDays} label={text.scheduled} value={`${scheduled.length}`}/><Metric icon={MapPinCheck} label={text.matched} value={`${matchedSuccessionIds.size}/${scopedSuccessions.length}`}/><Metric icon={ShieldAlert} label={text.unmatched} value={`${withoutSourceActions}`}/></section>
   <p className="mb-5 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.warning}</p>
   <section><h2 className="mb-4 text-2xl font-normal">{text.calendar}</h2>{scheduled.length===0?<p className="text-sm text-muted-foreground">{text.noSchedule}</p>:<div className="space-y-px">{scheduled.map((item,index)=><article key={`${item.crop}-${item.sequence}-${item.task}-${item.date}-${index}`} className="grid gap-3 bg-[var(--bs-surface-primary)] p-4 sm:grid-cols-[1fr_1.2fr_.75fr_.8fr]"><div><strong className="font-medium">{item.crop}</strong><p className="mt-1 text-xs text-muted-foreground">Succession {item.sequence} · {text.row} {item.sourceRow}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.task}</p><p className="mt-1 text-sm">{item.task}</p><p className="mt-1 text-xs text-muted-foreground">{item.sourceColumn}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.timing}</p><p className="mt-1 text-sm">{dateLabel(item.date,locale)} · {item.timing}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.anchor}</p><p className="mt-1 text-sm">{dateLabel(item.anchor,locale)}</p></div></article>)}</div>}</section>
   <div className="mt-6 flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}: {ORCHARD_CROP_TASK_REFERENCE_SOURCE.sheet} · SHA-256 {ORCHARD_CROP_TASK_REFERENCE_SOURCE.workbookSha256.slice(0,12)}… · {profiledSuccessionIds.size} profiled plantings</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
  </>}
 </main></AppLayout>
}

function Metric({icon:Icon,label,value}:{icon:typeof CalendarDays;label:string;value:string}){return <div className="bg-[var(--bs-surface-primary)] p-5"><Icon className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div>}

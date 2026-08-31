"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarRange, ChartNoAxesCombined, Leaf, Target } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;start_date:string;end_date:string;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;variety:string|null;target_quantity:number|null;target_unit:string|null}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_first_harvest_date:string|null;planned_last_harvest_date:string|null}

type Window={crop:string;variety:string|null;sequence:number;first:string;last:string}

const copy={
 en:{eyebrow:"Production Forecast",title:"Planned availability by harvest window",description:"This view uses canonical succession dates. It does not distribute crop targets into invented weekly or monthly volumes.",season:"Season",windows:"Harvest windows",months:"Months with coverage",crops:"Crops with harvest windows",coverage:"Availability coverage",upcoming:"Planned harvest windows",target:"Season target",noTarget:"No target quantity recorded",empty:"No planned harvest windows are recorded for this Game Plan.",method:"Method: a month is covered when at least one planned succession has a harvest window overlapping that month."},
 es:{eyebrow:"Forecast de Producción",title:"Disponibilidad planificada por ventana de cosecha",description:"Esta vista usa las fechas canónicas de sucesiones. No reparte objetivos de cultivo en volúmenes semanales o mensuales inventados.",season:"Temporada",windows:"Ventanas de cosecha",months:"Meses con cobertura",crops:"Cultivos con ventana",coverage:"Cobertura de disponibilidad",upcoming:"Ventanas de cosecha planificadas",target:"Objetivo de temporada",noTarget:"Sin cantidad objetivo registrada",empty:"No hay ventanas de cosecha planificadas para este Game Plan.",method:"Método: un mes tiene cobertura cuando al menos una sucesión planificada tiene una ventana de cosecha que se superpone con ese mes."},
 de:{eyebrow:"Produktionsprognose",title:"Geplante Verfügbarkeit nach Erntefenster",description:"Diese Ansicht verwendet kanonische Folgedaten. Kulturziele werden nicht in erfundene Wochen- oder Monatsmengen verteilt.",season:"Saison",windows:"Erntefenster",months:"Monate mit Abdeckung",crops:"Kulturen mit Erntefenster",coverage:"Verfügbarkeitsabdeckung",upcoming:"Geplante Erntefenster",target:"Saisonziel",noTarget:"Keine Zielmenge erfasst",empty:"Für diesen Game Plan sind keine Erntefenster geplant.",method:"Methode: Ein Monat ist abgedeckt, wenn mindestens eine geplante Folge ein Erntefenster hat, das diesen Monat überschneidet."},
} as const

const locales:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateLabel=(v:string,locale:string)=>new Date(`${v}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"})
const monthKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`
const monthLabel=(key:string,locale:string)=>new Date(`${key}-01T12:00:00`).toLocaleDateString(locale,{month:"short",year:"2-digit"})
function coveredMonths(first:string,last:string){
 const out:string[]=[];const start=new Date(`${first}T12:00:00`);const end=new Date(`${last}T12:00:00`);const cursor=new Date(start.getFullYear(),start.getMonth(),1,12)
 while(cursor<=end){out.push(monthKey(cursor));cursor.setMonth(cursor.getMonth()+1)}
 return out
}

export default function OrchardForecastPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=locales[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,target_quantity,target_unit"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_first_harvest_date,planned_last_harvest_date"),
 ]).then(([p,c,s])=>{if(!live)return;setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setLoading(false)});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[];const cycleById=new Map(scopedCycles.map(c=>[c.id,c]));const scoped=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&s.planned_first_harvest_date&&s.planned_last_harvest_date)
 const windows:Window[]=scoped.map(s=>{const cycle=cycleById.get(s.crop_cycle_id)!;return{crop:cycle.crop_name,variety:cycle.variety,sequence:s.sequence_no,first:s.planned_first_harvest_date!,last:s.planned_last_harvest_date!}}).sort((a,b)=>a.first.localeCompare(b.first))
 const monthMap=new Map<string,Set<string>>();for(const w of windows){for(const month of coveredMonths(w.first,w.last)){const crops=monthMap.get(month)??new Set<string>();crops.add(w.crop);monthMap.set(month,crops)}}
 const months=[...monthMap.entries()].sort(([a],[b])=>a.localeCompare(b));const cropsWithWindows=new Set(windows.map(w=>w.crop)).size
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:windows.length===0?<div className="py-12 text-sm text-muted-foreground">{text.empty}</div>:<>
   <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3"><div className="bg-[var(--bs-surface-primary)] p-5"><CalendarRange className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.windows}</p><p className="mt-2 text-3xl tabular-nums">{windows.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><ChartNoAxesCombined className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.months}</p><p className="mt-2 text-3xl tabular-nums">{months.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><Leaf className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.crops}</p><p className="mt-2 text-3xl tabular-nums">{cropsWithWindows}</p></div></section>
   <section className="mb-8 bg-[var(--bs-surface-primary)] p-5 sm:p-6"><h2 className="text-xl font-normal">{text.coverage}</h2><div className="mt-5 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3 lg:grid-cols-6">{months.map(([month,crops])=><div key={month} className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-sm font-medium">{monthLabel(month,locale)}</p><p className="mt-1 text-2xl tabular-nums">{crops.size}</p><p className="text-xs text-muted-foreground">{text.crops.toLowerCase()}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">{text.method}</p></section>
   <section><h2 className="mb-4 text-xl font-normal">{text.upcoming}</h2><div className="space-y-px">{windows.map(w=>{const cycle=scopedCycles.find(c=>c.crop_name===w.crop&&c.variety===w.variety);return <article key={`${w.crop}-${w.sequence}-${w.first}`} className="grid gap-3 bg-[var(--bs-surface-primary)] p-4 md:grid-cols-[1.4fr_.7fr_1fr_1fr]"><div><strong className="font-medium">{w.crop}</strong>{w.variety?<span className="ml-2 text-sm text-muted-foreground">{w.variety}</span>:null}<p className="mt-1 text-xs text-muted-foreground">Succession {w.sequence}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.target}</p><p className="mt-1 text-sm">{cycle?.target_quantity!=null?`${cycle.target_quantity.toLocaleString(locale)} ${cycle.target_unit??""}`:text.noTarget}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Start</p><p className="mt-1 text-sm">{dateLabel(w.first,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">End</p><p className="mt-1 text-sm">{dateLabel(w.last,locale)}</p></div></article>})}</div></section>
  </>}
 </main></AppLayout>
}

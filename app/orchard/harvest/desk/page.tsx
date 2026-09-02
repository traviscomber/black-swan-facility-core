"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarRange, Leaf } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;season:string|null;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_first_harvest_date:string|null;planned_last_harvest_date:string|null}
type Allocation={crop_succession_id:string}
type Harvest={id:string;crop_succession_id:string|null;harvest_date:string;quantity_harvested:number|null;harvest_unit:string|null;harvest_lot_code:string|null}
type ActualSummary={passes:number;byUnit:Map<string,number>}

const copy={
 en:{eyebrow:"Orchard · Harvest",title:"What is coming off the field",description:"Planned harvest windows and recorded output for the physically reconciled field plan. Actual production stays attached to its exact succession and unit.",planned:"Reconciled harvest windows",recorded:"Recorded harvest passes",active:"Open now",next:"Next / active harvest",none:"No harvest window",noActual:"No harvest has been recorded for these reconciled plantings yet.",crop:"Crop",window:"Window",actual:"Recorded output",advanced:"Record / manage harvest",source:"Plan windows and actual harvest records from canonical Supabase lineage. No harvest is attributed by date alone.",passes:"passes",mixed:"mixed units",loadError:"Could not load harvest desk."},
 es:{eyebrow:"Huerto · Cosecha",title:"Qué está saliendo del campo",description:"Ventanas planificadas y producción registrada para el plan de campo físicamente reconciliado. La producción real queda ligada a su sucesión y unidad exactas.",planned:"Ventanas reconciliadas",recorded:"Pasadas de cosecha registradas",active:"Abiertas hoy",next:"Próxima / activa",none:"Sin ventana de cosecha",noActual:"Todavía no hay cosechas registradas para estas plantaciones reconciliadas.",crop:"Cultivo",window:"Ventana",actual:"Producción registrada",advanced:"Registrar / gestionar cosecha",source:"Ventanas del plan y cosechas reales desde lineage canónico de Supabase. Ninguna cosecha se atribuye sólo por fecha.",passes:"pasadas",mixed:"unidades mixtas",loadError:"No fue posible cargar la mesa de cosecha."},
 de:{eyebrow:"Orchard · Ernte",title:"Was vom Feld kommt",description:"Geplante Erntefenster und erfasster Ertrag für den physisch abgeglichenen Feldplan. Reale Produktion bleibt an die exakte Folge und Einheit gebunden.",planned:"Abgeglichene Erntefenster",recorded:"Erfasste Erntedurchgänge",active:"Heute offen",next:"Nächste / aktive Ernte",none:"Kein Erntefenster",noActual:"Für diese abgeglichenen Pflanzungen wurde noch keine Ernte erfasst.",crop:"Kultur",window:"Fenster",actual:"Erfasster Ertrag",advanced:"Ernte erfassen / verwalten",source:"Planfenster und reale Ernten aus kanonischer Supabase-Lineage. Keine Ernte wird nur anhand des Datums zugeordnet.",passes:"Durchgänge",mixed:"gemischte Einheiten",loadError:"Erntetisch konnte nicht geladen werden."},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateLabel=(v:string,locale:string)=>new Date(`${v}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"})
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())

export default function DietrichHarvestDesk(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([]),[harvests,setHarvests]=useState<Harvest[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)
 useEffect(()=>{let live=true;setLoading(true);setError(null);void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_first_harvest_date,planned_last_harvest_date").neq("status","cancelled"),
  supabase.from("orchard_bed_allocations").select("crop_succession_id"),
  supabase.from("orchard_harvest_records").select("id,crop_succession_id,harvest_date,quantity_harvested,harvest_unit,harvest_lot_code").order("harvest_date",{ascending:false}),
 ]).then(([p,c,s,a,h])=>{if(!live)return;const first=p.error??c.error??s.error??a.error??h.error;if(first){setError(`${text.loadError} ${first.message}`);setLoading(false);return}setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);setHarvests((h.data??[]) as Harvest[]);setLoading(false)});return()=>{live=false}},[supabase,text.loadError])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null;const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[];const cycleById=new Map(scopedCycles.map(c=>[c.id,c]));const allocatedIds=new Set(allocations.map(a=>a.crop_succession_id));const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&allocatedIds.has(s.id));const successionById=new Map(scopedSuccessions.map(s=>[s.id,s]));const scopedHarvests=harvests.filter(h=>h.crop_succession_id&&successionById.has(h.crop_succession_id))
 const windows=scopedSuccessions.filter(s=>s.planned_first_harvest_date&&s.planned_last_harvest_date).map(s=>({s,cycle:cycleById.get(s.crop_cycle_id)!})).sort((a,b)=>a.s.planned_first_harvest_date!.localeCompare(b.s.planned_first_harvest_date!))
 const todayKey=today();const openNow=windows.filter(w=>w.s.planned_first_harvest_date!<=todayKey&&w.s.planned_last_harvest_date!>=todayKey);const next=openNow[0]??windows.find(w=>w.s.planned_first_harvest_date!>todayKey)??null
 const actualBySuccession=new Map<string,ActualSummary>();for(const h of scopedHarvests){if(!h.crop_succession_id)continue;const current=actualBySuccession.get(h.crop_succession_id)??{passes:0,byUnit:new Map<string,number>()};current.passes+=1;if(h.quantity_harvested!=null&&h.harvest_unit){current.byUnit.set(h.harvest_unit,(current.byUnit.get(h.harvest_unit)??0)+Number(h.quantity_harvested))}actualBySuccession.set(h.crop_succession_id,current)}
 const actualLabel=(id:string)=>{const summary=actualBySuccession.get(id);if(!summary)return "—";const units=[...summary.byUnit.entries()];if(units.length===1)return `${units[0][1].toLocaleString(locale,{maximumFractionDigits:2})} ${units[0][0]} · ${summary.passes} ${text.passes}`;if(units.length>1)return `${summary.passes} ${text.passes} · ${text.mixed}`;return `${summary.passes} ${text.passes}`}
 const advancedHref=`/${language}/orchard/harvest${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>:<>
   <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-4"><Metric icon={CalendarRange} label={text.planned} value={windows.length}/><Metric icon={Leaf} label={text.recorded} value={scopedHarvests.length}/><Metric label={text.active} value={openNow.length}/><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.next}</p><p className="mt-2 text-sm font-medium">{next?`${next.cycle.crop_name} · #${next.s.sequence_no}`:text.none}</p>{next?<p className="mt-1 text-xs text-muted-foreground">{dateLabel(next.s.planned_first_harvest_date!,locale)} — {dateLabel(next.s.planned_last_harvest_date!,locale)}</p>:null}</div></section>
   <section className="mb-8"><h2 className="mb-4 text-2xl font-normal">{text.planned}</h2><div className="space-y-px">{windows.map(({s,cycle})=><article key={s.id} className="grid gap-3 bg-[var(--bs-surface-primary)] p-4 sm:grid-cols-[1fr_1fr_1fr]"><div><strong className="font-medium">{cycle.crop_name}</strong><p className="mt-1 text-xs text-muted-foreground">Succession {s.sequence_no}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.window}</p><p className="mt-1 text-sm">{dateLabel(s.planned_first_harvest_date!,locale)} — {dateLabel(s.planned_last_harvest_date!,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.actual}</p><p className="mt-1 text-sm">{actualLabel(s.id)}</p></div></article>)}</div></section>
   {scopedHarvests.length===0?<p className="mb-6 bg-[var(--bs-surface-primary)] p-4 text-sm text-muted-foreground">{text.noActual}</p>:null}
   <div className="flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
  </>}
 </main></AppLayout>
}
function Metric({icon:Icon,label,value}:{icon?:typeof Leaf;label:string;value:number}){return <div className="bg-[var(--bs-surface-primary)] p-5">{Icon?<Icon className="h-4 w-4 text-muted-foreground"/>:null}<p className={`${Icon?"mt-4":""} text-xs uppercase tracking-wide text-muted-foreground`}>{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div>}

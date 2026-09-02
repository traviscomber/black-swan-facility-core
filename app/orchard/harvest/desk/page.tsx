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
type WindowRow={s:Succession;cycle:Cycle}

type CropRow={crop:string;windows:WindowRow[];successionIds:Set<string>}

const copy={
 en:{eyebrow:"Orchard · Harvest",title:"Weekly harvest availability",description:"The reconciled field plan is read as a crop-by-week availability matrix. Green cells mean a planned harvest window is open; actual harvest remains separate and is attached only through exact succession lineage.",planned:"Reconciled harvest windows",recorded:"Current-plan harvest passes",active:"Open now",next:"Next / active harvest",none:"No harvest window",noActual:"No harvest has been recorded for the reconciled 2026/27 field plantings yet.",crop:"Crop",actual:"Actual recorded",advanced:"Record / manage harvest",source:"Planned availability comes from exact succession harvest windows. Actual quantities come only from orchard_harvest_records with matching crop_succession_id; incompatible units are never summed.",passes:"passes",mixed:"mixed units",loadError:"Could not load harvest desk.",matrix:"Season availability",matrixHelp:"Each weekly cell counts how many reconciled successions for that crop have an open harvest window during the week. It does not imply a projected quantity.",week:"W",successions:"successions"},
 es:{eyebrow:"Huerto · Cosecha",title:"Disponibilidad semanal de cosecha",description:"El plan de campo reconciliado se lee como una matriz cultivo×semana. Las celdas verdes indican una ventana de cosecha planificada abierta; la cosecha real permanece separada y sólo se liga mediante la sucesión exacta.",planned:"Ventanas reconciliadas",recorded:"Pasadas reales del plan",active:"Abiertas hoy",next:"Próxima / activa",none:"Sin ventana de cosecha",noActual:"Todavía no hay cosechas registradas para las plantaciones de campo reconciliadas 2026/27.",crop:"Cultivo",actual:"Real registrado",advanced:"Registrar / gestionar cosecha",source:"La disponibilidad planificada viene de las ventanas exactas de cada sucesión. Las cantidades reales vienen sólo de orchard_harvest_records con crop_succession_id coincidente; nunca se suman unidades incompatibles.",passes:"pasadas",mixed:"unidades mixtas",loadError:"No fue posible cargar la mesa de cosecha.",matrix:"Disponibilidad de temporada",matrixHelp:"Cada celda semanal cuenta cuántas sucesiones reconciliadas de ese cultivo tienen una ventana de cosecha abierta durante la semana. No representa una cantidad proyectada.",week:"S",successions:"sucesiones"},
 de:{eyebrow:"Orchard · Ernte",title:"Wöchentliche Ernteverfügbarkeit",description:"Der abgeglichene Feldplan wird als Kultur×Woche-Matrix gelesen. Grüne Zellen bedeuten ein offenes geplantes Erntefenster; reale Ernte bleibt getrennt und wird nur über die exakte Folge zugeordnet.",planned:"Abgeglichene Erntefenster",recorded:"Ist-Ernten im Plan",active:"Heute offen",next:"Nächste / aktive Ernte",none:"Kein Erntefenster",noActual:"Für die abgeglichenen Feldpflanzungen 2026/27 wurde noch keine Ernte erfasst.",crop:"Kultur",actual:"Erfasstes Ist",advanced:"Ernte erfassen / verwalten",source:"Geplante Verfügbarkeit stammt aus den exakten Erntefenstern der Folgen. Ist-Mengen stammen nur aus orchard_harvest_records mit passender crop_succession_id; inkompatible Einheiten werden nie summiert.",passes:"Durchgänge",mixed:"gemischte Einheiten",loadError:"Erntetisch konnte nicht geladen werden.",matrix:"Saisonverfügbarkeit",matrixHelp:"Jede Wochenzelle zählt, wie viele abgeglichene Folgen dieser Kultur in der Woche ein offenes Erntefenster haben. Sie stellt keine projizierte Menge dar.",week:"W",successions:"Folgen"},
} as const

const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
const dateLabel=(v:string,locale:string)=>new Date(`${v}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"})
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
const mondayOf=(value:string)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()-((d.getDay()+6)%7));return dateKey(d)}
const addDays=(value:string,days:number)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return dateKey(d)}
const weekKeys=(start:string,end:string)=>{const out:string[]=[];let key=mondayOf(start);while(key<=end&&out.length<60){out.push(key);key=addDays(key,7)}return out}
const isoWeek=(value:string)=>{const d=new Date(`${value}T12:00:00Z`);const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day+3);const firstThursday=new Date(Date.UTC(d.getUTCFullYear(),0,4));return 1+Math.round((d.getTime()-firstThursday.getTime())/604800000)}

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

 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[];const cycleById=new Map(scopedCycles.map(c=>[c.id,c]));const allocatedIds=new Set(allocations.map(a=>a.crop_succession_id));const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&allocatedIds.has(s.id));const successionById=new Map(scopedSuccessions.map(s=>[s.id,s]));const scopedHarvests=harvests.filter(h=>h.crop_succession_id&&successionById.has(h.crop_succession_id))
 const windows:WindowRow[]=scopedSuccessions.filter(s=>s.planned_first_harvest_date&&s.planned_last_harvest_date).map(s=>({s,cycle:cycleById.get(s.crop_cycle_id)!})).sort((a,b)=>a.s.planned_first_harvest_date!.localeCompare(b.s.planned_first_harvest_date!))
 const todayKey=today();const openNow=windows.filter(w=>w.s.planned_first_harvest_date!<=todayKey&&w.s.planned_last_harvest_date!>=todayKey);const next=openNow[0]??windows.find(w=>w.s.planned_first_harvest_date!>todayKey)??null

 const actualBySuccession=new Map<string,ActualSummary>();for(const h of scopedHarvests){if(!h.crop_succession_id)continue;const current=actualBySuccession.get(h.crop_succession_id)??{passes:0,byUnit:new Map<string,number>()};current.passes+=1;if(h.quantity_harvested!=null&&h.harvest_unit){current.byUnit.set(h.harvest_unit,(current.byUnit.get(h.harvest_unit)??0)+Number(h.quantity_harvested))}actualBySuccession.set(h.crop_succession_id,current)}
 const cropRows:CropRow[]=[];for(const row of windows){let crop=cropRows.find(c=>c.crop===row.cycle.crop_name);if(!crop){crop={crop:row.cycle.crop_name,windows:[],successionIds:new Set<string>()};cropRows.push(crop)}crop.windows.push(row);crop.successionIds.add(row.s.id)}cropRows.sort((a,b)=>a.crop.localeCompare(b.crop))
 const actualLabel=(ids:Set<string>)=>{const summaries=[...ids].map(id=>actualBySuccession.get(id)).filter((v):v is ActualSummary=>Boolean(v));if(!summaries.length)return "—";const units=new Map<string,number>();let passes=0;for(const summary of summaries){passes+=summary.passes;for(const [unit,value] of summary.byUnit)units.set(unit,(units.get(unit)??0)+value)}const entries=[...units.entries()];if(entries.length===1)return `${entries[0][1].toLocaleString(locale,{maximumFractionDigits:2})} ${entries[0][0]} · ${passes} ${text.passes}`;if(entries.length>1)return `${passes} ${text.passes} · ${text.mixed}`;return `${passes} ${text.passes}`}
 const minHarvest=windows.map(w=>w.s.planned_first_harvest_date!).sort()[0]??todayKey;const maxHarvest=windows.map(w=>w.s.planned_last_harvest_date!).sort().at(-1)??todayKey;const weeks=weekKeys(minHarvest,maxHarvest)
 const activeInWeek=(row:WindowRow,weekStart:string)=>{const weekEnd=addDays(weekStart,6);return row.s.planned_first_harvest_date!<=weekEnd&&row.s.planned_last_harvest_date!>=weekStart}
 const advancedHref=`/${language}/orchard/harvest${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`

 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1700px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
  <header className="mb-7 max-w-5xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>:<>
   <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric icon={CalendarRange} label={text.planned} value={windows.length}/><Metric icon={Leaf} label={text.recorded} value={scopedHarvests.length}/><Metric label={text.active} value={openNow.length}/><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.next}</p><p className="mt-2 text-sm font-medium">{next?`${next.cycle.crop_name} · #${next.s.sequence_no}`:text.none}</p>{next?<p className="mt-1 text-xs text-muted-foreground">{dateLabel(next.s.planned_first_harvest_date!,locale)} — {dateLabel(next.s.planned_last_harvest_date!,locale)}</p>:null}</div></section>

   <section className="mb-7"><div className="mb-3"><p className="text-xs uppercase tracking-[.16em] text-muted-foreground">{text.matrix}</p><h2 className="mt-1 text-2xl font-normal">{cropRows.length} {text.crop.toLowerCase()} · {weeks.length} {text.week.toLowerCase()}</h2><p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">{text.matrixHelp}</p></div>
    <div className="max-h-[68vh] overflow-auto border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]">
      <div style={{minWidth:`${260+weeks.length*54+190}px`}}>
        <div className="sticky top-0 z-20 flex border-b border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-secondary)] text-[10px] uppercase tracking-[.08em] text-muted-foreground">
          <div className="sticky left-0 z-30 w-[260px] shrink-0 border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-secondary)] px-3 py-2">{text.crop}</div>
          {weeks.map(week=><div key={week} className="w-[54px] shrink-0 border-r border-[var(--bs-divider-subtle)] px-1 py-2 text-center"><span className="block">{text.week}{isoWeek(week)}</span><span className="mt-0.5 block normal-case tracking-normal">{new Date(`${week}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short"})}</span></div>)}
          <div className="sticky right-0 z-30 w-[190px] shrink-0 bg-[var(--bs-surface-secondary)] px-3 py-2">{text.actual}</div>
        </div>
        {cropRows.map(row=><div key={row.crop} className="flex min-h-[52px] border-b border-[var(--bs-divider-subtle)] last:border-b-0">
          <div className="sticky left-0 z-10 w-[260px] shrink-0 border-r border-[var(--bs-divider-subtle)] bg-white px-3 py-3"><strong className="text-sm font-medium">{row.crop}</strong><p className="mt-1 text-[11px] text-muted-foreground">{row.successionIds.size} {text.successions}</p></div>
          {weeks.map(week=>{const active=row.windows.filter(w=>activeInWeek(w,week)).length;const currentWeek=todayKey>=week&&todayKey<=addDays(week,6);return <div key={week} className={`flex w-[54px] shrink-0 items-center justify-center border-r border-[var(--bs-divider-subtle)] text-xs tabular-nums ${active?"bg-[var(--orchard-green-soft)] font-medium text-[var(--orchard-green)]":"bg-white text-muted-foreground"} ${currentWeek?"outline outline-1 outline-inset outline-[var(--orchard-green)]":""}`}>{active||""}</div>})}
          <div className="sticky right-0 z-10 flex w-[190px] shrink-0 items-center bg-white px-3 py-2 text-xs">{actualLabel(row.successionIds)}</div>
        </div>)}
      </div>
    </div>
   </section>

   {scopedHarvests.length===0?<p className="mb-6 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.noActual}</p>:null}
   <div className="flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="max-w-4xl">{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
  </>}
 </main></AppLayout>
}
function Metric({icon:Icon,label,value}:{icon?:typeof Leaf;label:string;value:number}){return <div className="bg-[var(--bs-surface-primary)] p-5">{Icon?<Icon className="h-4 w-4 text-muted-foreground"/>:null}<p className={`${Icon?"mt-4":""} text-xs uppercase tracking-wide text-muted-foreground`}>{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div>}

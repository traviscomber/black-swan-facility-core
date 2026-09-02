"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, Map as MapIcon, Rows3 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;season:string|null;status:string;start_date:string;end_date:string}
type Plot={id:string;name:string}
type Bed={id:string;plot_id:string;name:string;length_m:number|null;planning_order:number|null}
type Cycle={id:string;game_plan_id:string;crop_name:string}
type Succession={id:string;crop_cycle_id:string}
type Allocation={id:string;bed_id:string;crop_succession_id:string;planned_start_date:string|null;planned_end_date:string|null;allocated_length_m:number|null}

const PHYSICAL_BLOCK=/^(Current 0[1-5]|Expansion 0[1-3])$/
const copy={
 en:{eyebrow:"Orchard · Crop Map",title:"Field occupancy canvas",description:"A date-controlled schematic of the verified 8-block / 80-bed field model. Every lane is a canonical bed. Occupancy includes every Game Plan so physical conflicts cannot disappear when the active plan changes.",blocks:"Physical blocks",beds:"Canonical beds",assigned:"Plan assigned",occupied:"Occupied beds",planOccupied:"Active-plan beds",meters:"Occupied bed-m",date:"Planning date",legendPlan:"Active Game Plan",legendOther:"Other physical allocation",legendFree:"Free",canvas:"Physical bed canvas",canvasHelp:"This is a schematic occupancy view, not surveyed geometry. Bed identity, length and allocation dates come from canonical Supabase records.",advanced:"Open advanced Crop Map",capacity:"capacity",loadError:"Could not load the physical field canvas."},
 es:{eyebrow:"Huerto · Crop Map",title:"Canvas de ocupación del campo",description:"Vista esquemática controlada por fecha del modelo físico verificado de 8 bloques / 80 camas. Cada línea es una cama canónica. La ocupación incluye todos los Game Plans para que los conflictos físicos no desaparezcan al cambiar de scope.",blocks:"Bloques físicos",beds:"Camas canónicas",assigned:"Plan ubicado",occupied:"Camas ocupadas",planOccupied:"Camas plan activo",meters:"Bed-m ocupados",date:"Fecha de planificación",legendPlan:"Game Plan activo",legendOther:"Otra asignación física",legendFree:"Libre",canvas:"Canvas físico de camas",canvasHelp:"Esta es una vista esquemática de ocupación, no geometría topográfica. Identidad, largo y fechas de asignación vienen de registros canónicos de Supabase.",advanced:"Abrir Crop Map avanzado",capacity:"capacidad",loadError:"No fue posible cargar el canvas físico del campo."},
 de:{eyebrow:"Orchard · Crop Map",title:"Canvas der Feldbelegung",description:"Datumssteuernde schematische Ansicht des verifizierten 8-Block-/80-Beet-Modells. Jede Linie ist ein kanonisches Beet. Die Belegung enthält alle Game Plans, damit physische Konflikte nicht durch Scope-Wechsel verschwinden.",blocks:"Physische Blöcke",beds:"Kanonische Beete",assigned:"Plan zugeordnet",occupied:"Belegte Beete",planOccupied:"Beete aktiver Plan",meters:"Belegte Beet-m",date:"Planungsdatum",legendPlan:"Aktiver Game Plan",legendOther:"Andere physische Zuweisung",legendFree:"Frei",canvas:"Physischer Beet-Canvas",canvasHelp:"Dies ist eine schematische Belegungsansicht, keine Vermessungsgeometrie. Beetidentität, Länge und Zuweisungsdaten stammen aus kanonischen Supabase-Daten.",advanced:"Erweiterte Crop Map öffnen",capacity:"Kapazität",loadError:"Der physische Feld-Canvas konnte nicht geladen werden."}
} as const

const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
const addDays=(value:string,days:number)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return dateKey(d)}
const dateKeys=(start:string,end:string)=>{const out:string[]=[];let key=start;while(key<=end&&out.length<400){out.push(key);key=addDays(key,7)}return out}
const todaySantiago=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())

export default function CropMapOverview(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[plots,setPlots]=useState<Plot[]>([]),[beds,setBeds]=useState<Bed[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([])
 const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[dateIndex,setDateIndex]=useState(0)
 useEffect(()=>{let live=true;setLoading(true);setError(null);void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status,start_date,end_date").order("start_date",{ascending:false}),
  supabase.from("orchard_plots").select("id,name").order("name"),
  supabase.from("orchard_beds").select("id,plot_id,name,length_m,planning_order").order("planning_order"),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id"),
  supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_length_m"),
 ]).then(([p,pl,b,c,s,a])=>{if(!live)return;const first=p.error??pl.error??b.error??c.error??s.error??a.error;if(first){setError(`${text.loadError} ${first.message}`);setLoading(false);return}setPlans((p.data??[]) as Plan[]);setPlots((pl.data??[]) as Plot[]);setBeds((b.data??[]) as Bed[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);setLoading(false)});return()=>{live=false}},[supabase,text.loadError])

 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const physicalPlots=plots.filter(p=>PHYSICAL_BLOCK.test(p.name));const physicalPlotIds=new Set(physicalPlots.map(p=>p.id));const physicalBeds=beds.filter(b=>physicalPlotIds.has(b.plot_id));const physicalBedIds=new Set(physicalBeds.map(b=>b.id))
 const successionById=new Map(successions.map(s=>[s.id,s]));const cycleById=new Map(cycles.map(c=>[c.id,c]));const planCycleIds=new Set(cycles.filter(c=>c.game_plan_id===plan?.id).map(c=>c.id));const planSuccessionIds=new Set(successions.filter(s=>planCycleIds.has(s.crop_cycle_id)).map(s=>s.id))
 const planAllocatedIds=new Set(allocations.filter(a=>planSuccessionIds.has(a.crop_succession_id)&&physicalBedIds.has(a.bed_id)).map(a=>a.crop_succession_id))
 const weeks=plan?dateKeys(plan.start_date,plan.end_date):[]
 const todayKey=todaySantiago();const initialIndex=weeks.length?Math.max(0,weeks.findIndex((key,index)=>todayKey>=key&&(index===weeks.length-1||todayKey<weeks[index+1]))):0
 useEffect(()=>{if(weeks.length&&dateIndex===0&&initialIndex>0)setDateIndex(initialIndex)},[weeks.length,initialIndex,dateIndex])
 const selectedDate=weeks[Math.min(dateIndex,Math.max(0,weeks.length-1))]??todayKey
 const activeAllocations=allocations.filter(a=>physicalBedIds.has(a.bed_id)&&a.planned_start_date&&a.planned_end_date&&a.planned_start_date<=selectedDate&&a.planned_end_date>=selectedDate)
 const activeByBed=new Map<string,Allocation[]>();for(const a of activeAllocations){const current=activeByBed.get(a.bed_id)??[];current.push(a);activeByBed.set(a.bed_id,current)}
 const occupiedBedIds=new Set(activeAllocations.map(a=>a.bed_id));const planActiveAllocations=activeAllocations.filter(a=>planSuccessionIds.has(a.crop_succession_id));const planOccupiedBedIds=new Set(planActiveAllocations.map(a=>a.bed_id));const occupiedMeters=activeAllocations.reduce((sum,a)=>sum+Number(a.allocated_length_m??0),0);const totalMeters=physicalBeds.reduce((sum,b)=>sum+Number(b.length_m??0),0)
 const cropForAllocation=(a:Allocation)=>{const s=successionById.get(a.crop_succession_id);return s?cycleById.get(s.crop_cycle_id)?.crop_name??null:null}
 const advancedHref=`/${language}/orchard/crop-map${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`

 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1760px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
  <header className="mb-6 max-w-5xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>:<>
   <section className="mb-5 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-6"><Metric icon={MapIcon} label={text.blocks} value={physicalPlots.length}/><Metric icon={Rows3} label={text.beds} value={physicalBeds.length}/><Metric label={text.assigned} value={planAllocatedIds.size} suffix="/32"/><Metric label={text.occupied} value={occupiedBedIds.size}/><Metric label={text.planOccupied} value={planOccupiedBedIds.size}/><Metric label={text.meters} value={Math.round(occupiedMeters)} suffix={`/${Math.round(totalMeters)} m`}/></section>

   <section className="mb-5 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-5 py-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-[220px] items-center gap-3"><CalendarDays className="h-4 w-4 text-[var(--orchard-green)]"/><div><p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{text.date}</p><p className="mt-1 text-sm font-medium">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(locale,{weekday:"short",day:"2-digit",month:"long",year:"numeric"})}</p></div></div><input aria-label={text.date} type="range" min={0} max={Math.max(0,weeks.length-1)} value={Math.min(dateIndex,Math.max(0,weeks.length-1))} onChange={e=>setDateIndex(Number(e.target.value))} className="h-2 min-h-0 flex-1 cursor-pointer"/><div className="flex flex-wrap gap-4 text-xs"><Legend className="bg-[var(--orchard-green)]" label={text.legendPlan}/><Legend className="bg-[var(--bs-warm-amber)]" label={text.legendOther}/><Legend className="bg-[var(--bs-surface-tertiary)]" label={text.legendFree}/></div></div></section>

   <section><div className="mb-3"><p className="text-xs uppercase tracking-[.16em] text-muted-foreground">{text.canvas}</p><p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">{text.canvasHelp}</p></div>
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">{physicalPlots.map(plot=>{const blockBeds=physicalBeds.filter(b=>b.plot_id===plot.id).sort((a,b)=>(a.planning_order??0)-(b.planning_order??0));return <section key={plot.id} className="border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]"><div className="flex items-center justify-between border-b border-[var(--bs-divider-subtle)] px-4 py-3"><strong className="font-medium">{plot.name}</strong><span className="text-xs text-muted-foreground">{blockBeds.length} {text.beds.toLowerCase()}</span></div><div className="p-2">{blockBeds.map(bed=>{const active=activeByBed.get(bed.id)??[];const planActive=active.filter(a=>planSuccessionIds.has(a.crop_succession_id));const used=active.reduce((sum,a)=>sum+Number(a.allocated_length_m??0),0);const capacity=Number(bed.length_m??0);const pct=capacity>0?Math.min(100,(used/capacity)*100):0;const labels=[...new Set(planActive.map(cropForAllocation).filter(Boolean))];const otherActive=active.length>planActive.length;return <div key={bed.id} className="grid grid-cols-[72px_1fr] items-center gap-2 border-b border-[var(--bs-divider-subtle)] px-2 py-2 last:border-b-0"><span className="truncate text-[11px] text-muted-foreground" title={bed.name}>{bed.name}</span><div><div className="relative h-4 overflow-hidden bg-[var(--bs-surface-tertiary)]"><div className={`absolute inset-y-0 left-0 ${planActive.length?"bg-[var(--orchard-green)]":otherActive?"bg-[var(--bs-warm-amber)]":""}`} style={{width:`${pct}%`}}/>{planActive.length&&otherActive?<div className="absolute inset-y-0 right-0 w-1/3 bg-[var(--bs-warm-amber)]"/>:null}</div><div className="mt-1 flex justify-between gap-2 text-[9px] text-muted-foreground"><span className="truncate">{labels.join(", ")|| (otherActive?text.legendOther:text.legendFree)}</span><span className="shrink-0 tabular-nums">{used.toLocaleString(locale,{maximumFractionDigits:1})}/{capacity.toLocaleString(locale,{maximumFractionDigits:1})} m</span></div></div></div>})}</div></section>})}</div>
   </section>
   <footer className="mt-6 flex justify-end border-t border-[var(--bs-divider-subtle)] pt-5"><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></footer>
  </>}
 </main></AppLayout>
}
function Metric({icon:Icon,label,value,suffix}:{icon?:typeof MapIcon;label:string;value:number;suffix?:string}){return <div className="bg-[var(--bs-surface-primary)] p-5">{Icon?<Icon className="h-4 w-4 text-muted-foreground"/>:null}<p className={`${Icon?"mt-4":""} text-xs uppercase tracking-wide text-muted-foreground`}>{label}</p><p className="mt-2 text-3xl tabular-nums">{value}<span className="ml-1 text-sm text-muted-foreground">{suffix}</span></p></div>}
function Legend({className,label}:{className:string;label:string}){return <span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 ${className}`}/>{label}</span>}

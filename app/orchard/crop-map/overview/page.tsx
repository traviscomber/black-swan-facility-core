"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, Search, SlidersHorizontal, X } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { cropColor } from "@/lib/orchard/crop-identity"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;status:string;start_date:string;end_date:string}
type Plot={id:string;name:string}
type Bed={id:string;plot_id:string;name:string;length_m:number|null;planning_order:number|null}
type Cycle={id:string;game_plan_id:string;crop_name:string;cycle_type:string|null}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string|null;planned_transplant_date:string|null;planned_first_harvest_date:string|null;planned_last_harvest_date:string|null;planned_bed_m:number|string|null;planned_plants:number|null}
type Allocation={id:string;bed_id:string;crop_succession_id:string;planned_start_date:string|null;planned_end_date:string|null;allocated_length_m:number|string|null}
type CropProfile={crop_name:string;crop_family:string|null}

const PHYSICAL_BLOCK=/^(Current 0[1-5]|Expansion 0[1-3])$/
const copy={
 en:{title:"Crop Map",subtitle:"Assign plantings to physical beds over the season",assign:"Assign plantings",help:"Drag an unassigned planting onto the bed where it should start. Existing assignments stay canonical and read-only here.",search:"Search crops…",assigned:"assigned plantings",unassigned:"Unassigned",done:"Assigned",seasonStart:"Season start",seasonEnd:"Season end",selected:"Selected",loadError:"Could not load Crop Map.",dropError:"This planting could not be assigned to that bed.",missing:"Missing dates or planned bed metres",beds:"beds",plantings:"plantings",week:"CW"},
 es:{title:"Mapa de cultivos",subtitle:"Asigna plantaciones a camas físicas a lo largo de la temporada",assign:"Asignar plantaciones",help:"Arrastra una plantación sin asignar sobre la cama donde debe comenzar. Las asignaciones existentes siguen siendo canónicas y aquí son de solo lectura.",search:"Buscar cultivos…",assigned:"plantaciones asignadas",unassigned:"Sin asignar",done:"Asignada",seasonStart:"Inicio de temporada",seasonEnd:"Fin de temporada",selected:"Seleccionada",loadError:"No fue posible cargar el Mapa de cultivos.",dropError:"No fue posible asignar esta plantación a esa cama.",missing:"Faltan fechas o bed-m planificados",beds:"camas",plantings:"plantaciones",week:"SC"},
 de:{title:"Anbaukarte",subtitle:"Pflanzungen über die Saison physischen Beeten zuordnen",assign:"Pflanzungen zuordnen",help:"Eine nicht zugeordnete Pflanzung auf das Startbeet ziehen. Bestehende Zuordnungen bleiben kanonisch und hier schreibgeschützt.",search:"Kulturen suchen…",assigned:"zugeordnete Pflanzungen",unassigned:"Nicht zugeordnet",done:"Zugeordnet",seasonStart:"Saisonbeginn",seasonEnd:"Saisonende",selected:"Ausgewählt",loadError:"Anbaukarte konnte nicht geladen werden.",dropError:"Pflanzung konnte diesem Beet nicht zugeordnet werden.",missing:"Daten oder geplante Beetmeter fehlen",beds:"Beete",plantings:"Pflanzungen",week:"KW"}
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const normalize=(value:string)=>value.trim().toLowerCase()
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value))
const isoWeek=(value:string)=>{const d=new Date(`${value}T12:00:00Z`);const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d.getTime()-yearStart.getTime())/86400000)+1)/7)}
const addDays=(value:string,days:number)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
const weekKeys=(start:string,end:string)=>{const out:string[]=[];let current=start;while(current<=end&&out.length<80){out.push(current);current=addDays(current,7)}return out}
const monthsBetween=(start:string,end:string,locale:string)=>{const out:{key:string;label:string;start:string;end:string}[]=[];const cursor=new Date(`${start}T12:00:00`);cursor.setDate(1);const last=new Date(`${end}T12:00:00`);while(cursor<=last&&out.length<18){const mStart=cursor.toISOString().slice(0,10);const next=new Date(cursor);next.setMonth(next.getMonth()+1);const mEnd=new Date(next);mEnd.setDate(0);out.push({key:mStart,label:cursor.toLocaleDateString(locale,{month:"short"}).toUpperCase(),start:mStart<start?start:mStart,end:mEnd.toISOString().slice(0,10)>end?end:mEnd.toISOString().slice(0,10)});cursor.setMonth(cursor.getMonth()+1)}return out}
const pctDate=(value:string,start:string,end:string)=>{const a=new Date(`${start}T12:00:00`).getTime(),b=new Date(`${end}T12:00:00`).getTime(),v=new Date(`${value}T12:00:00`).getTime();return clamp(((v-a)/Math.max(1,b-a))*100)}

export default function CropMapOverview(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[plots,setPlots]=useState<Plot[]>([]),[beds,setBeds]=useState<Bed[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([]),[profiles,setProfiles]=useState<CropProfile[]>([])
 const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[query,setQuery]=useState(""),[weekIndex,setWeekIndex]=useState(0),[dragId,setDragId]=useState<string|null>(null),[placing,setPlacing]=useState(false)
 const load=async()=>{setLoading(true);setError(null);const results=await Promise.all([
  supabase.from("orchard_game_plans").select("id,name,season,status,start_date,end_date").order("start_date",{ascending:false}),
  supabase.from("orchard_plots").select("id,name").order("name"),
  supabase.from("orchard_beds").select("id,plot_id,name,length_m,planning_order").eq("status","active").order("planning_order"),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_bed_m,planned_plants"),
  supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_length_m"),
  supabase.from("orchard_crop_library").select("crop_name,crop_family").eq("is_active",true).eq("classification_scheme","black_swan_canonical").eq("classification_code","fundo_corcovado")
 ]);const first=results.find(r=>r.error)?.error;if(first){setError(`${text.loadError} ${first.message}`);setLoading(false);return}setPlans((results[0].data??[]) as Plan[]);setPlots((results[1].data??[]) as Plot[]);setBeds((results[2].data??[]) as Bed[]);setCycles((results[3].data??[]) as Cycle[]);setSuccessions((results[4].data??[]) as Succession[]);setAllocations((results[5].data??[]) as Allocation[]);setProfiles((results[6].data??[]) as CropProfile[]);setLoading(false)}
 useEffect(()=>{void load()},[])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const physicalPlots=plots.filter(p=>PHYSICAL_BLOCK.test(p.name));const plotIds=new Set(physicalPlots.map(p=>p.id));const physicalBeds=beds.filter(b=>plotIds.has(b.plot_id));const bedIds=new Set(physicalBeds.map(b=>b.id))
 const planCycles=cycles.filter(c=>c.game_plan_id===plan?.id);const cycleById=new Map(cycles.map(c=>[c.id,c]));const planCycleIds=new Set(planCycles.map(c=>c.id));const planSuccessions=successions.filter(s=>planCycleIds.has(s.crop_cycle_id));const successionById=new Map(successions.map(s=>[s.id,s]));const assignedIds=new Set(allocations.filter(a=>bedIds.has(a.bed_id)).map(a=>a.crop_succession_id))
 const familyByCrop=new Map(profiles.map(p=>[normalize(p.crop_name),p.crop_family]));const familyFor=(crop:string)=>familyByCrop.get(normalize(crop))??null
 const weeks=plan?weekKeys(plan.start_date,plan.end_date):[];const selectedDate=weeks[Math.min(weekIndex,Math.max(0,weeks.length-1))]??plan?.start_date??""
 const months=plan?monthsBetween(plan.start_date,plan.end_date,locale):[]
 const visibleSuccessions=planSuccessions.filter(s=>{const cycle=cycleById.get(s.crop_cycle_id);return !query.trim()||`${cycle?.crop_name??""} ${s.sequence_no}`.toLowerCase().includes(query.toLowerCase())}).sort((a,b)=>{const ca=cycleById.get(a.crop_cycle_id)?.crop_name??"",cb=cycleById.get(b.crop_cycle_id)?.crop_name??"";return ca.localeCompare(cb)||a.sequence_no-b.sequence_no})
 const assignedCount=planSuccessions.filter(s=>assignedIds.has(s.id)).length
 const drop=async(successionId:string,plot:Plot,bed:Bed)=>{const succession=successionById.get(successionId);if(!succession||assignedIds.has(successionId)||placing)return;const start=succession.planned_transplant_date??succession.planned_sow_date;const end=succession.planned_last_harvest_date??succession.planned_first_harvest_date;const required=Number(succession.planned_bed_m??0);if(!start||!end||required<=0){setError(text.missing);return}setPlacing(true);const result=await supabase.rpc("orchard_place_succession_bed_meters",{p_succession_id:succession.id,p_plot_id:plot.id,p_start_bed_id:bed.id,p_start_date:start,p_end_date:end,p_required_bed_m:required});setPlacing(false);setDragId(null);if(result.error){setError(`${text.dropError} ${result.error.message}`);return}await load()}

 return <AppLayout><OrchardNavigation/><main className="flex h-[calc(100dvh-var(--orchard-nav-height,0px))] min-h-[680px] flex-col overflow-hidden bg-[#1a1a18] text-[#e8e5dc]">
  <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3"><div><h1 className="text-xl font-semibold">{text.title}</h1><p className="mt-0.5 text-xs text-[#8f8a81]">{text.subtitle}</p></div><div className="border border-white/10 px-4 py-2 text-xs text-[#aaa69c]">{plan?.season??"—"}</div></header>
  {loading?<div className="grid flex-1 place-items-center text-sm text-[#8f8a81]">…</div>:error&&!plan?<div className="grid flex-1 place-items-center text-sm text-red-300">{error}</div>:plan?<>
   <section className="shrink-0 border-b border-white/10 bg-[#171715] px-5 py-3">
    <div className="grid grid-cols-[160px_1fr_170px] items-center gap-4"><div><p className="text-[10px] uppercase tracking-[.14em] text-[#77726a]">{text.seasonStart}</p><p className="mt-1 text-xs">{text.week} {isoWeek(plan.start_date)} · {new Date(`${plan.start_date}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short"})}</p></div><div className="relative pt-5"><input aria-label={text.selected} type="range" min={0} max={Math.max(0,weeks.length-1)} value={Math.min(weekIndex,Math.max(0,weeks.length-1))} onChange={e=>setWeekIndex(Number(e.target.value))} className="h-1 w-full cursor-pointer accent-[#79c5aa]"/><span className="pointer-events-none absolute top-0 -translate-x-1/2 border border-[#79c5aa]/50 bg-[#24342d] px-2 py-0.5 text-[10px] font-semibold text-[#a6dec7]" style={{left:`${weeks.length>1?(weekIndex/(weeks.length-1))*100:0}%`}}>{text.week} {selectedDate?isoWeek(selectedDate):"—"}</span></div><div className="text-right"><p className="text-[10px] uppercase tracking-[.14em] text-[#77726a]">{text.seasonEnd}</p><p className="mt-1 text-xs">{text.week} {isoWeek(plan.end_date)} · {new Date(`${plan.end_date}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short"})}</p></div></div>
   </section>
   <div className="flex min-h-0 flex-1">
    <section className="min-w-0 flex-1 overflow-auto bg-[#242522] p-5">
     <div className="flex min-h-[610px] w-max min-w-full items-start gap-3 border border-[#5b5b55] bg-[#1c1d1a] p-4">
      {physicalPlots.map(plot=><PlotTimeline key={plot.id} plot={plot} beds={physicalBeds.filter(b=>b.plot_id===plot.id).sort((a,b)=>(a.planning_order??999)-(b.planning_order??999))} allocations={allocations.filter(a=>physicalBedIdsForPlot(plot.id,physicalBeds).has(a.bed_id))} months={months} plan={plan} selectedDate={selectedDate} cycleById={cycleById} successionById={successionById} familyFor={familyFor} onDrop={drop} dragId={dragId}/>) }
     </div>
    </section>
    <aside className="w-[350px] shrink-0 border-l border-white/10 bg-[#171715] xl:w-[390px]">
     <div className="flex items-start justify-between border-b border-white/10 px-4 py-4"><div><h2 className="font-semibold">{text.assign} ({assignedCount}/{planSuccessions.length})</h2><p className="mt-2 text-xs leading-5 text-[#aaa69c]">{text.help}</p></div><SlidersHorizontal className="mt-1 h-4 w-4 text-[#77726a]"/></div>
     <div className="border-b border-white/10 p-3"><label className="flex h-9 items-center gap-2 border border-white/10 bg-[#1d1d1b] px-3"><Search className="h-4 w-4 text-[#77726a]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={text.search} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#66625c]"/></label></div>
     <div className="h-[calc(100%-145px)] overflow-y-auto p-3">{visibleSuccessions.map(s=>{const cycle=cycleById.get(s.crop_cycle_id);if(!cycle)return null;const assigned=assignedIds.has(s.id);const start=s.planned_transplant_date??s.planned_sow_date;const end=s.planned_last_harvest_date??s.planned_first_harvest_date;const draggable=!assigned&&Boolean(start&&end&&Number(s.planned_bed_m??0)>0);const tone=cropColor(cycle.crop_name,familyFor(cycle.crop_name));return <div key={s.id} draggable={draggable&&!placing} onDragStart={()=>{if(draggable)setDragId(s.id)}} onDragEnd={()=>setDragId(null)} className={`mb-2 border border-white/10 bg-[#1d1d1b] p-3 ${draggable?"cursor-grab active:cursor-grabbing":""}`} style={{borderLeft:`4px solid ${tone}`}}><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{cycle.crop_name}</p><p className="mt-0.5 text-[11px] text-[#8f8a81]">#{s.sequence_no} · {start??"—"} → {end??"—"}</p></div>{assigned?<span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[.08em] text-[#7fc5a9]"><Check className="h-3 w-3"/>{text.done}</span>:<span className="text-[10px] uppercase tracking-[.08em] text-[#b39a69]">{text.unassigned}</span>}</div>{!assigned&& !draggable?<p className="mt-2 text-[10px] text-[#aa806f]">{text.missing}</p>:null}</div>})}</div>
    </aside>
   </div>
   {error?<button type="button" onClick={()=>setError(null)} className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-red-400/30 bg-[#2a1d1a] px-4 py-2 text-xs text-[#e7c2bb]"><X className="h-3.5 w-3.5"/>{error}</button>:null}
  </>:null}
 </main></AppLayout>
}

function physicalBedIdsForPlot(plotId:string,beds:Bed[]){return new Set(beds.filter(b=>b.plot_id===plotId).map(b=>b.id))}
function PlotTimeline({plot,beds,allocations,months,plan,selectedDate,cycleById,successionById,familyFor,onDrop,dragId}:{plot:Plot;beds:Bed[];allocations:Allocation[];months:{key:string;label:string;start:string;end:string}[];plan:Plan;selectedDate:string;cycleById:Map<string,Cycle>;successionById:Map<string,Succession>;familyFor:(crop:string)=>string|null;onDrop:(id:string,plot:Plot,bed:Bed)=>Promise<void>;dragId:string|null}){
 const width=Math.max(118,beds.length*26);const selectedTop=pctDate(selectedDate,plan.start_date,plan.end_date)
 return <div className="shrink-0" style={{width}}><div className="mb-1 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">{plot.name}</h3><span className="text-[10px] text-[#77726a]">{beds.length}</span></div><div className="grid h-5 border-x border-t border-[#55564f] bg-[#22231f]" style={{gridTemplateColumns:`repeat(${beds.length},minmax(24px,1fr))`}}>{beds.map((bed,index)=><div key={bed.id} className="border-r border-[#454640] text-center text-[8px] leading-5 text-[#8f8a81] last:border-r-0">{index+1}</div>)}</div><div className="relative h-[540px] border border-[#55564f] bg-[#20211e]">
  {months.map(month=><div key={month.key} className="absolute inset-x-0 border-t border-[#43443f]" style={{top:`${pctDate(month.start,plan.start_date,plan.end_date)}%`,height:`${Math.max(.5,pctDate(month.end,plan.start_date,plan.end_date)-pctDate(month.start,plan.start_date,plan.end_date))}%`}}><span className="absolute left-1 top-1 text-[8px] font-semibold text-[#77726a]">{month.label}</span></div>)}
  <div className="absolute inset-0 grid" style={{gridTemplateColumns:`repeat(${beds.length},minmax(24px,1fr))`}}>{beds.map(bed=><div key={bed.id} onDragOver={event=>{if(dragId)event.preventDefault()}} onDrop={event=>{event.preventDefault();const id=dragId??event.dataTransfer.getData("text/plain");if(id)void onDrop(id,plot,bed)}} className={`border-r border-[#3d3e39] last:border-r-0 ${dragId?"hover:bg-[#79c5aa]/10":""}`}/>)}</div>
  <div className="pointer-events-none absolute inset-x-0 z-20 h-px bg-[#b96d5a]" style={{top:`${selectedTop}%`}}/>
  {allocations.map(allocation=>{const bedIndex=beds.findIndex(b=>b.id===allocation.bed_id);const succession=successionById.get(allocation.crop_succession_id);const cycle=succession?cycleById.get(succession.crop_cycle_id):null;if(bedIndex<0||!cycle||!allocation.planned_start_date||!allocation.planned_end_date)return null;const top=pctDate(allocation.planned_start_date,plan.start_date,plan.end_date),bottom=pctDate(allocation.planned_end_date,plan.start_date,plan.end_date);const tone=cropColor(cycle.crop_name,familyFor(cycle.crop_name));return <div key={allocation.id} className="absolute z-10 overflow-hidden border border-black/30 px-0.5 text-[7px] font-semibold leading-3 text-white shadow" style={{left:`calc(${(bedIndex/beds.length)*100}% + 1px)`,width:`calc(${100/beds.length}% - 2px)`,top:`${top}%`,height:`${Math.max(2,bottom-top)}%`,backgroundColor:tone}} title={`${cycle.crop_name} · ${allocation.planned_start_date} → ${allocation.planned_end_date}`}><span className="block truncate">{cycle.crop_name}</span></div>})}
 </div></div>
}

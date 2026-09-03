"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarRange, ClipboardList, Info, Leaf, StickyNote, X } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { cropColor } from "@/lib/orchard/crop-identity"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Tab = "information" | "tasks" | "harvests" | "notes"
type CanonicalSnapshot = {
  yield_unit?: string | null
  rows_per_bed?: string | null
  yield_10m_bed?: number | null
  yield_per_week_10m_bed?: number | null
  price_per_unit_clp?: number | null
  harvest_window_days?: number | null
  source?: string | null
}
type Succession = {
  id:string
  crop_cycle_id:string
  sequence_no:number
  planned_sow_date:string
  planned_transplant_date:string|null
  planned_first_harvest_date:string|null
  planned_last_harvest_date:string|null
  days_to_maturity:number|null
  planned_plants:number|null
  planned_area_sqm:number|null
  planned_bed_m:number|null
  plant_spacing_cm:number|null
  row_spacing_cm:number|null
  germination_rate_pct:number|null
  seeds_per_plant:number|null
  status:string
  notes:string|null
  crop_library_id:string|null
  lifecycle_source:string|null
  knowledge_source_snapshot:{black_swan_canonical?:CanonicalSnapshot}|null
}
type Cycle = { id:string; crop_name:string; variety:string|null; cycle_type:string }
type CropProfile = { id:string; crop_name:string; crop_family:string|null; yield_unit:string|null }
type Task = { id:string; title:string; due_date:string|null; status:string; estimated_minutes:number|null; task_category:string|null }
type Harvest = { id:string; harvest_date:string; quantity_harvested:number|null; harvest_unit:string|null; quality_rating:number|null; total_market_value:number|null; harvest_lot_code:string|null }

const copy = {
  en:{quick:"Quick actions",readOnly:"Read-only planning milestones. Passing a planned date never marks work complete automatically.",planned:"Planned",sow:"Sow / direct seed",field:"Field establishment",firstHarvest:"First harvest",lastHarvest:"Harvest complete target",information:"Information",tasks:"Tasks",harvests:"Harvests",notes:"Notes",details:"Planting details",crop:"Crop",cultivar:"Cultivar",method:"Planting method",amount:"Planting amount",dtm:"Days to maturity",rows:"Rows per bed",rowSpacing:"Row spacing",plantSpacing:"Plant spacing",germination:"Germination",seeds:"Seeds / plant",yieldUnit:"Harvest unit",expectedYield:"Projected yield",harvested:"Harvested",potentialRevenue:"Projected revenue",status:"Status",source:"Evidence source",none:"No canonical records for this planting.",noNotes:"No planting note recorded.",minutes:"min",loadError:"Could not load planting detail",direct:"Direct seeding",transplant:"Transplant",close:"Close planting detail"},
  es:{quick:"Acciones rápidas",readOnly:"Hitos de planificación en modo lectura. El paso de una fecha planificada nunca marca trabajo como completado automáticamente.",planned:"Planificado",sow:"Siembra / siembra directa",field:"Entrada a campo",firstHarvest:"Primera cosecha",lastHarvest:"Fin objetivo de cosecha",information:"Información",tasks:"Tareas",harvests:"Cosechas",notes:"Notas",details:"Detalles de plantación",crop:"Cultivo",cultivar:"Cultivar",method:"Método de plantación",amount:"Cantidad plantada",dtm:"Días a madurez",rows:"Filas por cama",rowSpacing:"Separación entre filas",plantSpacing:"Separación en la fila",germination:"Germinación",seeds:"Semillas / planta",yieldUnit:"Unidad de cosecha",expectedYield:"Rendimiento proyectado",harvested:"Cosechado",potentialRevenue:"Ingreso proyectado",status:"Estado",source:"Fuente de evidencia",none:"No hay registros canónicos para esta plantación.",noNotes:"No hay nota registrada para esta plantación.",minutes:"min",loadError:"No fue posible cargar el detalle de plantación",direct:"Siembra directa",transplant:"Trasplante",close:"Cerrar detalle de plantación"},
  de:{quick:"Schnellaktionen",readOnly:"Planungsmeilensteine nur lesbar. Ein verstrichenes Plandatum markiert Arbeit niemals automatisch als erledigt.",planned:"Geplant",sow:"Aussaat / Direktsaat",field:"Feldetablierung",firstHarvest:"Erste Ernte",lastHarvest:"Ziel Ernteende",information:"Information",tasks:"Aufgaben",harvests:"Ernten",notes:"Notizen",details:"Pflanzdetails",crop:"Kultur",cultivar:"Sorte",method:"Pflanzmethode",amount:"Pflanzmenge",dtm:"Tage bis Reife",rows:"Reihen pro Beet",rowSpacing:"Reihenabstand",plantSpacing:"Pflanzabstand",germination:"Keimung",seeds:"Samen / Pflanze",yieldUnit:"Ernteeinheit",expectedYield:"Projizierter Ertrag",harvested:"Geerntet",potentialRevenue:"Projizierter Umsatz",status:"Status",source:"Evidenzquelle",none:"Keine kanonischen Datensätze für diese Pflanzung.",noNotes:"Keine Pflanznotiz erfasst.",minutes:"Min.",loadError:"Pflanzdetail konnte nicht geladen werden",direct:"Direktsaat",transplant:"Verpflanzung",close:"Pflanzdetail schließen"},
} as const

const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateLabel=(value:string|null,locale:string)=>value?new Date(`${value}T12:00:00-04:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Santiago"}):"—"
const numberLabel=(value:number|null|undefined,locale:string,maximumFractionDigits=1)=>value==null?"—":Number(value).toLocaleString(locale,{maximumFractionDigits})

export function OrchardPlantingDetailDrawer({successionId,onClose}:{successionId:string|null;onClose:()=>void}){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
  const [tab,setTab]=useState<Tab>("information")
  const [succession,setSuccession]=useState<Succession|null>(null)
  const [cycle,setCycle]=useState<Cycle|null>(null)
  const [profile,setProfile]=useState<CropProfile|null>(null)
  const [tasks,setTasks]=useState<Task[]>([])
  const [harvests,setHarvests]=useState<Harvest[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{
    if(!successionId){setSuccession(null);setCycle(null);setProfile(null);setTasks([]);setHarvests([]);return}
    let live=true;setLoading(true);setError(null);setTab("information")
    void supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,days_to_maturity,planned_plants,planned_area_sqm,planned_bed_m,plant_spacing_cm,row_spacing_cm,germination_rate_pct,seeds_per_plant,status,notes,crop_library_id,lifecycle_source,knowledge_source_snapshot").eq("id",successionId).single().then(async result=>{
      if(!live)return
      if(result.error||!result.data){setError(`${text.loadError}: ${result.error?.message??"not found"}`);setLoading(false);return}
      const next=result.data as Succession;setSuccession(next)
      const [cycleResult,taskResult,harvestResult,profileResult]=await Promise.all([
        supabase.from("orchard_crop_cycles").select("id,crop_name,variety,cycle_type").eq("id",next.crop_cycle_id).single(),
        supabase.from("tasks").select("id,title,due_date,status,estimated_minutes,task_category").eq("operational_area","orchard").eq("source_type","orchard_succession").eq("source_id",next.id).order("due_date",{ascending:true}),
        supabase.from("orchard_harvest_records").select("id,harvest_date,quantity_harvested,harvest_unit,quality_rating,total_market_value,harvest_lot_code").eq("crop_succession_id",next.id).order("harvest_date",{ascending:false}),
        next.crop_library_id?supabase.from("orchard_crop_library").select("id,crop_name,crop_family,yield_unit").eq("id",next.crop_library_id).single():Promise.resolve({data:null,error:null}),
      ])
      if(!live)return
      if(cycleResult.error){setError(`${text.loadError}: ${cycleResult.error.message}`);setLoading(false);return}
      setCycle(cycleResult.data as Cycle);setTasks((taskResult.data??[]) as Task[]);setHarvests((harvestResult.data??[]) as Harvest[]);setProfile((profileResult.data??null) as CropProfile|null);setLoading(false)
    })
    return()=>{live=false}
  },[successionId,supabase,text.loadError])

  if(!successionId)return null
  const canonical=succession?.knowledge_source_snapshot?.black_swan_canonical
  const yieldUnit=canonical?.yield_unit??profile?.yield_unit??null
  const projectedYield=canonical?.yield_10m_bed!=null&&succession?.planned_bed_m!=null?Number(canonical.yield_10m_bed)*(Number(succession.planned_bed_m)/10):null
  const projectedRevenue=projectedYield!=null&&canonical?.price_per_unit_clp!=null?projectedYield*Number(canonical.price_per_unit_clp):null
  const actualUnits=new Map<string,number>();for(const record of harvests){if(record.quantity_harvested!=null&&record.harvest_unit)actualUnits.set(record.harvest_unit,(actualUnits.get(record.harvest_unit)??0)+Number(record.quantity_harvested))}
  const actualEntries=[...actualUnits.entries()]
  const actualLabel=actualEntries.length===1?`${numberLabel(actualEntries[0][1],locale,2)} ${actualEntries[0][0]}`:actualEntries.length>1?actualEntries.map(([unit,value])=>`${numberLabel(value,locale,2)} ${unit}`).join(" · "):"—"
  const method=cycle?.cycle_type==="direct_sow"?text.direct:cycle?.cycle_type==="transplant"?text.transplant:cycle?.cycle_type?.replaceAll("_"," ")??"—"
  const color=cropColor(cycle?.crop_name??"Planting",profile?.crop_family??null)
  const fieldDate=cycle?.cycle_type==="transplant"?(succession?.planned_transplant_date??succession?.planned_sow_date??null):(succession?.planned_sow_date??null)
  const tabs:[Tab,string,typeof Info][]=[["information",text.information,Info],["tasks",text.tasks,ClipboardList],["harvests",text.harvests,Leaf],["notes",text.notes,StickyNote]]

  return <div className="fixed inset-0 z-[70] flex justify-end bg-black/35" role="dialog" aria-modal="true" aria-label={text.details} onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <aside className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--orchard-line)] bg-[var(--orchard-canvas,#171512)] text-foreground shadow-2xl">
      <header className="border-b border-[var(--orchard-line)] px-5 py-4" style={{boxShadow:`inset 4px 0 0 ${color}`}}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--orchard-green)]">{text.details}</p><h2 className="mt-1 text-2xl font-normal">{cycle?.crop_name??"…"} {succession?`#${succession.sequence_no}`:""}</h2><p className="mt-1 text-sm text-muted-foreground">{cycle?.variety??"Generic"} · {method}</p></div><button type="button" onClick={onClose} aria-label={text.close} className="p-2 text-muted-foreground hover:text-foreground"><X className="h-5 w-5"/></button></div>
      </header>
      {loading?<div className="p-6 text-sm text-muted-foreground">…</div>:error?<div className="p-6 text-sm text-red-300">{error}</div>:succession&&cycle?<>
        <section className="border-b border-[var(--orchard-line)] px-5 py-4"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{text.quick}</p><span className="text-[10px] uppercase tracking-[.12em]" style={{color}}>{succession.status}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{text.readOnly}</p><div className="mt-3 grid gap-px bg-[var(--orchard-line)] sm:grid-cols-2"><Milestone label={text.sow} value={succession.planned_sow_date} locale={locale}/><Milestone label={text.field} value={fieldDate} locale={locale}/><Milestone label={text.firstHarvest} value={succession.planned_first_harvest_date} locale={locale}/><Milestone label={text.lastHarvest} value={succession.planned_last_harvest_date} locale={locale}/></div></section>
        <nav className="flex overflow-x-auto border-b border-[var(--orchard-line)] px-3" aria-label="Planting detail tabs">{tabs.map(([key,label,Icon])=><button key={key} type="button" onClick={()=>setTab(key)} aria-current={tab===key?"page":undefined} className={`relative flex min-w-max items-center gap-2 px-3 py-3 text-sm ${tab===key?"text-[var(--orchard-green)]":"text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4"/>{label}{tab===key?<span className="absolute inset-x-2 bottom-0 h-0.5 bg-[var(--orchard-green)]"/>:null}</button>)}</nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab==="information"?<div className="space-y-6"><section><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{text.details}</p><dl className="divide-y divide-[var(--orchard-line)] border-y border-[var(--orchard-line)]"><Fact label={text.crop} value={cycle.crop_name}/><Fact label={text.cultivar} value={cycle.variety??"Generic"}/><Fact label={text.method} value={method}/><Fact label={text.amount} value={succession.planned_bed_m!=null?`${numberLabel(succession.planned_bed_m,locale)} m`:"—"}/><Fact label={text.dtm} value={succession.days_to_maturity!=null?String(succession.days_to_maturity):"—"}/><Fact label={text.rows} value={canonical?.rows_per_bed??"—"}/><Fact label={text.rowSpacing} value={succession.row_spacing_cm!=null?`${numberLabel(succession.row_spacing_cm,locale)} cm`:"—"}/><Fact label={text.plantSpacing} value={succession.plant_spacing_cm!=null?`${numberLabel(succession.plant_spacing_cm,locale)} cm`:"—"}/><Fact label={text.germination} value={succession.germination_rate_pct!=null?`${numberLabel(succession.germination_rate_pct,locale)}%`:"—"}/><Fact label={text.seeds} value={numberLabel(succession.seeds_per_plant,locale,2)}/><Fact label={text.status} value={succession.status}/><Fact label={text.source} value={canonical?.source??succession.lifecycle_source??"—"}/></dl></section><section><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{text.harvests}</p><dl className="divide-y divide-[var(--orchard-line)] border-y border-[var(--orchard-line)]"><Fact label={text.yieldUnit} value={yieldUnit??"—"}/><Fact label={text.expectedYield} value={projectedYield!=null?`${numberLabel(projectedYield,locale,2)} ${yieldUnit??""}`.trim():"—"}/><Fact label={text.harvested} value={actualLabel}/><Fact label={text.potentialRevenue} value={projectedRevenue!=null?new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(projectedRevenue):"—"}/></dl></section></div>:null}
          {tab==="tasks"?<div className="space-y-2">{tasks.length?tasks.map(task=><article key={task.id} className="border-b border-[var(--orchard-line)] py-3 first:pt-0"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.task_category??"—"} · {dateLabel(task.due_date,locale)}</p></div><span className="shrink-0 text-xs text-muted-foreground">{task.estimated_minutes??0} {text.minutes}</span></div><p className="mt-1 text-[10px] uppercase tracking-[.12em]" style={{color}}>{task.status}</p></article>):<Empty text={text.none}/>}</div>:null}
          {tab==="harvests"?<div className="space-y-2">{harvests.length?harvests.map(record=><article key={record.id} className="border-b border-[var(--orchard-line)] py-3 first:pt-0"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{dateLabel(record.harvest_date,locale)}</p><p className="mt-1 text-xs text-muted-foreground">{record.harvest_lot_code??"—"}{record.quality_rating!=null?` · Q${record.quality_rating}`:""}</p></div><div className="text-right"><p className="text-sm">{record.quantity_harvested!=null?numberLabel(record.quantity_harvested,locale,2):"—"} {record.harvest_unit??""}</p>{record.total_market_value!=null?<p className="mt-1 text-xs text-muted-foreground">{new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(record.total_market_value)}</p>:null}</div></div></article>):<Empty text={text.none}/>}</div>:null}
          {tab==="notes"?<div>{succession.notes?<p className="whitespace-pre-wrap text-sm leading-6">{succession.notes}</p>:<Empty text={text.noNotes}/>}</div>:null}
        </div>
      </>:<div className="p-6 text-sm text-muted-foreground">{text.none}</div>}
    </aside>
  </div>
}

function Milestone({label,value,locale}:{label:string;value:string|null;locale:string}){return <div className="bg-[var(--bs-surface-primary)] p-3"><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><div className="mt-1.5 flex items-center gap-2"><CalendarRange className="h-3.5 w-3.5 text-[var(--orchard-green)]"/><p className="text-sm">{dateLabel(value,locale)}</p></div></div>}
function Fact({label,value}:{label:string;value:string}){return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 py-2.5 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right">{value}</dd></div>}
function Empty({text}:{text:string}){return <p className="py-8 text-sm text-muted-foreground">{text}</p>}

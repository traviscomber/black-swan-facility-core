"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Search } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Mode = "tasks" | "crops"
type Locale = "en" | "es" | "de"
type Task = { id:string; task_category:string|null; status:string; estimated_minutes:number|null }
type Crop = { id:string; crop_name:string; crop_family:string|null; days_to_maturity:number|null; nursery_days:number|null; plant_spacing_cm:number|null; row_spacing_cm:number|null; target_yield_per_sqm:number|null; yield_unit:string|null; provenance_type:string|null; observed_count:number|null }

type TaskRow = { category:string; total:number; open:number; completed:number; minutes:number|null }

const copy = {
  en:{taskTitle:"Task Chart",taskHelp:"Observed Orchard task categories and workload defaults from canonical task records. No task duration is fabricated.",cropTitle:"Crop Chart",cropHelp:"Canonical crop planning values used by the Game Plan. Blank cells remain blank when Black Swan has no validated value.",refresh:"Refresh",search:"Search crops…",category:"Task",total:"Tasks",open:"Open",completed:"Completed",avgTime:"Avg. time",minutes:"min",crop:"Crop",family:"Family",dtm:"Days to maturity",nursery:"Nursery days",plantSpacing:"Plant spacing",rowSpacing:"Row spacing",yield:"Target yield / m²",evidence:"Evidence",noData:"No canonical records available.",unclassified:"Unclassified",unknown:"—"},
  es:{taskTitle:"Gráfico de tareas",taskHelp:"Categorías y carga observada de Orchard desde tareas canónicas. No se inventan duraciones.",cropTitle:"Gráfico de cultivos",cropHelp:"Valores canónicos de planificación usados por el Game Plan. Las celdas quedan vacías cuando Black Swan no tiene un valor validado.",refresh:"Actualizar",search:"Buscar cultivos…",category:"Tarea",total:"Tareas",open:"Abiertas",completed:"Completadas",avgTime:"Tiempo prom.",minutes:"min",crop:"Cultivo",family:"Familia",dtm:"Días a madurez",nursery:"Días en vivero",plantSpacing:"Espaciado",rowSpacing:"Entre hileras",yield:"Rendimiento objetivo / m²",evidence:"Evidencia",noData:"No hay registros canónicos disponibles.",unclassified:"Sin clasificar",unknown:"—"},
  de:{taskTitle:"Aufgabendiagramm",taskHelp:"Beobachtete Orchard-Aufgabenkategorien aus kanonischen Aufgaben. Zeitwerte werden nicht erfunden.",cropTitle:"Kulturdiagramm",cropHelp:"Kanonische Planungswerte für den Saisonplan. Felder bleiben leer, wenn Black Swan keinen validierten Wert hat.",refresh:"Aktualisieren",search:"Kulturen suchen…",category:"Aufgabe",total:"Aufgaben",open:"Offen",completed:"Abgeschlossen",avgTime:"Ø Zeit",minutes:"Min",crop:"Kultur",family:"Familie",dtm:"Tage bis Reife",nursery:"Anzuchttage",plantSpacing:"Pflanzabstand",rowSpacing:"Reihenabstand",yield:"Zielertrag / m²",evidence:"Evidenz",noData:"Keine kanonischen Datensätze verfügbar.",unclassified:"Nicht klassifiziert",unknown:"—"}
} as const

export function OrchardDataChart({mode}:{mode:Mode}){
  const {language}=useLanguage(); const locale:Locale=language; const text=copy[locale]; const supabase=useMemo(()=>createBrowserClient(),[])
  const [tasks,setTasks]=useState<Task[]>([]); const [crops,setCrops]=useState<Crop[]>([]); const [search,setSearch]=useState(""); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null)
  const load=async()=>{setLoading(true);setError(null);if(mode==="tasks"){const result=await supabase.from("tasks").select("id,task_category,status,estimated_minutes").in("operational_area",["orchard","huerto_vinedo"]);if(result.error)setError(result.error.message);else setTasks((result.data??[]) as Task[])}else{const result=await supabase.from("orchard_crop_library").select("id,crop_name,crop_family,days_to_maturity,nursery_days,plant_spacing_cm,row_spacing_cm,target_yield_per_sqm,yield_unit,provenance_type,observed_count").eq("is_active",true).order("crop_name");if(result.error)setError(result.error.message);else setCrops((result.data??[]) as Crop[])}setLoading(false)}
  useEffect(()=>{void load()},[mode])

  const taskRows=useMemo(()=>{const map=new Map<string,TaskRow>();for(const task of tasks){const key=task.task_category?.trim()||text.unclassified;const current=map.get(key)??{category:key,total:0,open:0,completed:0,minutes:null};current.total+=1;if(task.status==="completada")current.completed+=1;else if(task.status!=="cancelada")current.open+=1;const mins=tasks.filter(t=>(t.task_category?.trim()||text.unclassified)===key&&t.estimated_minutes!=null).map(t=>Number(t.estimated_minutes));current.minutes=mins.length?Math.round(mins.reduce((a,b)=>a+b,0)/mins.length):null;map.set(key,current)}return [...map.values()].sort((a,b)=>b.total-a.total||a.category.localeCompare(b.category))},[tasks,text.unclassified])
  const cropRows=useMemo(()=>{const q=search.trim().toLowerCase();return q?crops.filter(c=>[c.crop_name,c.crop_family].some(v=>v?.toLowerCase().includes(q))):crops},[crops,search])
  const title=mode==="tasks"?text.taskTitle:text.cropTitle; const help=mode==="tasks"?text.taskHelp:text.cropHelp

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1320px] px-5 pb-20 pt-6 lg:px-8">
    <div className="flex flex-col gap-4 border-b border-[var(--orchard-line)] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-[30px] font-normal tracking-[-.03em]">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{help}</p></div><button type="button" onClick={()=>void load()} className="inline-flex h-10 items-center gap-2 rounded border border-[var(--orchard-line)] px-3 text-sm text-[#d8d1c7]"><RefreshCw className="h-4 w-4"/>{text.refresh}</button></div>
    {mode==="crops"?<label className="mt-5 flex h-10 max-w-sm items-center gap-2 rounded border border-[var(--orchard-line)] bg-[#171614] px-3"><Search className="h-4 w-4 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={text.search} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"/></label>:null}
    {error?<p className="mt-5 text-sm text-red-300">{error}</p>:null}
    <div className="mt-5 overflow-x-auto">
      {mode==="tasks"?<table className="w-full min-w-[720px] text-sm"><thead><tr><Th>{text.category}</Th><Th>{text.total}</Th><Th>{text.open}</Th><Th>{text.completed}</Th><Th>{text.avgTime}</Th></tr></thead><tbody>{taskRows.map(row=><tr key={row.category}><Td strong>{row.category}</Td><Td>{row.total}</Td><Td>{row.open}</Td><Td>{row.completed}</Td><Td>{row.minutes==null?text.unknown:`${row.minutes} ${text.minutes}`}</Td></tr>)}</tbody></table>:<table className="w-full min-w-[1080px] text-sm"><thead><tr><Th>{text.crop}</Th><Th>{text.family}</Th><Th>{text.dtm}</Th><Th>{text.nursery}</Th><Th>{text.plantSpacing}</Th><Th>{text.rowSpacing}</Th><Th>{text.yield}</Th><Th>{text.evidence}</Th></tr></thead><tbody>{cropRows.map(row=><tr key={row.id}><Td strong>{row.crop_name}</Td><Td>{row.crop_family||text.unclassified}</Td><Td>{row.days_to_maturity??text.unknown}</Td><Td>{row.nursery_days??text.unknown}</Td><Td>{row.plant_spacing_cm==null?text.unknown:`${row.plant_spacing_cm} cm`}</Td><Td>{row.row_spacing_cm==null?text.unknown:`${row.row_spacing_cm} cm`}</Td><Td>{row.target_yield_per_sqm==null?text.unknown:`${row.target_yield_per_sqm} ${row.yield_unit??""}`.trim()}</Td><Td>{row.provenance_type??(row.observed_count?`${row.observed_count}`:text.unknown)}</Td></tr>)}</tbody></table>}
      {!loading&&((mode==="tasks"&&!taskRows.length)||(mode==="crops"&&!cropRows.length))?<p className="py-10 text-center text-sm text-muted-foreground">{text.noData}</p>:null}
    </div>
  </main></AppLayout>
}

function Th({children}:{children:React.ReactNode}){return <th className="border-b border-[var(--orchard-line)] px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">{children}</th>}
function Td({children,strong=false}:{children:React.ReactNode;strong?:boolean}){return <td className={`border-b border-[var(--orchard-line-soft)] px-3 py-3 ${strong?"font-medium text-[#eee9e1]":"text-[#c4bcb1]"}`}>{children}</td>}

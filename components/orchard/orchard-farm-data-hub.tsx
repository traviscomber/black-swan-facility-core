"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Section="tasks"|"nursery-containers"|"crop-families"|"tags"|"seed-companies"
type TaskRow={title:string;description:string|null;task_category:string|null;source_type:string|null;estimated_minutes:number|null}
type NurseryRow={cells_per_tray:number|null;tray_count:number|null}
type CropRow={crop_family:string|null}
type SeedRow={supplier:string|null}
type FarmSettingsRow={standard_bed_length_m:number|string|null}
type DisplayRow=(string|number)[]

const copy={
 en:{title:"Farm data",help:"Canonical Orchard reference data, organized in the same working groups as Heirloom.",search:"Search…",tasks:"Tasks",containers:"Nursery containers",families:"Crop families",tags:"Tags",companies:"Seed companies",name:"Name",type:"Type",category:"Category",description:"Description",minutes:"Minutes / standard bed",cells:"Number of cells",width:"Container width",length:"Container length",crops:"Crops",usage:"Usage",company:"Company",lots:"Seed lots",none:"No canonical records are configured for this section.",observed:"Observed task",orchard:"Orchard",unavailable:"—",records:"records"},
 es:{title:"Datos de granja",help:"Datos canónicos de referencia de Orchard, organizados en los mismos grupos de trabajo que Heirloom.",search:"Buscar…",tasks:"Tareas",containers:"Contenedores de vivero",families:"Familias de cultivos",tags:"Etiquetas",companies:"Empresas de semillas",name:"Nombre",type:"Tipo",category:"Categoría",description:"Descripción",minutes:"Minutos / cama estándar",cells:"Número de celdas",width:"Ancho del contenedor",length:"Largo del contenedor",crops:"Cultivos",usage:"Uso",company:"Empresa",lots:"Lotes de semillas",none:"No hay registros canónicos configurados para esta sección.",observed:"Tarea observada",orchard:"Orchard",unavailable:"—",records:"registros"},
 de:{title:"Hofdaten",help:"Kanonische Orchard-Referenzdaten in denselben Arbeitsgruppen wie bei Heirloom.",search:"Suchen…",tasks:"Aufgaben",containers:"Anzuchtbehälter",families:"Kulturfamilien",tags:"Tags",companies:"Saatgutfirmen",name:"Name",type:"Typ",category:"Kategorie",description:"Beschreibung",minutes:"Minuten / Standardbeet",cells:"Zellenanzahl",width:"Behälterbreite",length:"Behälterlänge",crops:"Kulturen",usage:"Verwendung",company:"Firma",lots:"Saatgutlose",none:"Für diesen Bereich sind keine kanonischen Datensätze konfiguriert.",observed:"Beobachtete Aufgabe",orchard:"Orchard",unavailable:"—",records:"Einträge"}
} as const

const sections:Section[]=["tasks","nursery-containers","crop-families","tags","seed-companies"]

export function OrchardFarmDataHub(){
 const {language}=useLanguage();const t=copy[language as Locale];const supabase=useMemo(()=>createBrowserClient(),[])
 const [section,setSection]=useState<Section>("tasks");const [tasks,setTasks]=useState<TaskRow[]>([]);const [nursery,setNursery]=useState<NurseryRow[]>([]);const [crops,setCrops]=useState<CropRow[]>([]);const [seeds,setSeeds]=useState<SeedRow[]>([]);const [standardBedLengthM,setStandardBedLengthM]=useState<number|null>(null);const [search,setSearch]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null)
 useEffect(()=>{if(typeof window==="undefined")return;const raw=new URLSearchParams(window.location.search).get("section") as Section|null;if(raw&&sections.includes(raw))setSection(raw)},[])
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("tasks").select("title,description,task_category,source_type,estimated_minutes").eq("operational_area","orchard").order("task_category"),
  supabase.from("orchard_nursery_batches").select("cells_per_tray,tray_count"),
  supabase.from("orchard_crop_library").select("crop_family").eq("is_active",true),
  supabase.from("orchard_seed_lots").select("supplier"),
  supabase.from("orchard_farm_settings").select("standard_bed_length_m").eq("farm_key","black_swan_orchard").maybeSingle(),
 ]).then(results=>{if(!live)return;const failure=results.find(r=>r.error)?.error;if(failure)setError(failure.message);setTasks((results[0].data??[]) as TaskRow[]);setNursery((results[1].data??[]) as NurseryRow[]);setCrops((results[2].data??[]) as CropRow[]);setSeeds((results[3].data??[]) as SeedRow[]);const farmSettings=results[4].data as FarmSettingsRow|null;const bedLength=farmSettings?.standard_bed_length_m==null?null:Number(farmSettings.standard_bed_length_m);setStandardBedLengthM(Number.isFinite(bedLength)?bedLength:null);setLoading(false)});return()=>{live=false}},[supabase])
 const choose=(next:Section)=>{setSection(next);setSearch("");if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("section",next);window.history.replaceState(null,"",url.toString())}}
 const taskRows=useMemo(()=>{const map=new Map<string,{name:string;type:string;description:string}>();for(const row of tasks){const name=(row.task_category||row.title||"").trim();if(!name)continue;const current=map.get(name);if(!current)map.set(name,{name,type:row.source_type||t.observed,description:row.description||t.unavailable});else if(current.description===t.unavailable&&row.description)current.description=row.description}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name))},[tasks,t])
 const containerRows=useMemo(()=>{const map=new Map<number,number>();for(const row of nursery){if(row.cells_per_tray==null)continue;map.set(row.cells_per_tray,(map.get(row.cells_per_tray)??0)+(row.tray_count??0))}return [...map.entries()].sort((a,b)=>a[0]-b[0])},[nursery])
 const familyRows=useMemo(()=>{const map=new Map<string,number>();for(const row of crops){const family=row.crop_family?.trim();if(!family)continue;map.set(family,(map.get(family)??0)+1)}return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]))},[crops])
 const companyRows=useMemo(()=>{const map=new Map<string,number>();for(const row of seeds){const supplier=row.supplier?.trim();if(!supplier)continue;map.set(supplier,(map.get(supplier)??0)+1)}return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]))},[seeds])
 const q=search.trim().toLowerCase();let heads:string[]=[];let rows:DisplayRow[]=[]
 const taskMinutesLabel=standardBedLengthM==null?t.minutes:`${t.minutes} (${standardBedLengthM} m)`
 if(section==="tasks"){heads=[t.name,t.type,t.category,t.description,taskMinutesLabel];rows=taskRows.map(r=>[r.name,r.type,t.orchard,r.description,t.unavailable])}
 if(section==="nursery-containers"){heads=[t.name,t.cells,t.width,t.length];rows=containerRows.map(([cells])=>[`${cells} cells tray`,cells,t.unavailable,t.unavailable])}
 if(section==="crop-families"){heads=[t.name,t.crops];rows=familyRows.map(([family,count])=>[family,count])}
 if(section==="tags"){heads=[t.name,t.usage];rows=[]}
 if(section==="seed-companies"){heads=[t.company,t.lots];rows=companyRows.map(([company,count])=>[company,count])}
 const filtered=rows.filter(row=>!q||row.some(value=>String(value).toLowerCase().includes(q)))
 const labels:{[K in Section]:string}={tasks:t.tasks,"nursery-containers":t.containers,"crop-families":t.families,tags:t.tags,"seed-companies":t.companies}
 return <AppLayout><OrchardNavigation/><main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1480px] flex-col px-4 pb-5 pt-4 sm:px-6 lg:px-8">
  <header className="border-b border-[var(--orchard-line)] pb-3"><h1 className="text-[25px] font-normal tracking-[-.03em]">{t.title}</h1><p className="mt-1 max-w-3xl text-[12px] leading-5 text-muted-foreground">{t.help}</p></header>
  {error?<p className="mt-4 text-sm text-red-300">{error}</p>:null}
  <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[180px_minmax(0,1fr)]">
   <nav className="border-b border-[var(--orchard-line)] py-4 pr-4 lg:border-b-0 lg:border-r"><div className="flex gap-1 overflow-x-auto lg:flex-col">{sections.map(key=><button key={key} type="button" onClick={()=>choose(key)} className={`shrink-0 border-l-2 px-3 py-2 text-left text-[12px] transition-colors ${section===key?"border-[var(--orchard-green)] text-[#eee9e1]":"border-transparent text-muted-foreground hover:text-foreground"}`}>{labels[key]}</button>)}</div></nav>
   <section className="min-w-0 py-4 lg:pl-10"><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex h-9 w-full max-w-sm items-center gap-2 border border-[var(--orchard-line)] bg-[#171614] px-3"><Search className="h-4 w-4 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search} aria-label={t.search} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"/></label><span className="text-[10px] uppercase tracking-[.1em] text-muted-foreground">{filtered.length} {t.records}</span></div>
    <div className="min-h-0 overflow-auto border-y border-[var(--orchard-line)]"><Table heads={heads} rows={filtered}/>{!loading&&!filtered.length?<div className="flex min-h-[280px] items-center justify-center px-6 text-center text-sm text-muted-foreground">{t.none}</div>:null}</div>
   </section>
  </div>
 </main></AppLayout>
}
function Table({heads,rows}:{heads:string[];rows:DisplayRow[]}){if(!rows.length)return null;return <table className="w-full min-w-[760px] border-collapse text-[12px]"><thead className="sticky top-0 z-10 bg-[var(--bs-surface-primary)] shadow-[0_1px_0_var(--orchard-line)]"><tr>{heads.map(h=><th key={h} className="px-3 py-2.5 text-left text-[9px] font-medium uppercase tracking-[.09em] text-muted-foreground">{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="transition-colors hover:bg-[var(--bs-surface-secondary)]/55">{row.map((value,j)=><td key={j} className={`border-b border-[var(--orchard-line-soft)] px-3 py-2.5 align-top ${j===0?"font-medium text-[#eee9e1]":"text-[#c4bcb1]"}`}>{value}</td>)}</tr>)}</tbody></table>}

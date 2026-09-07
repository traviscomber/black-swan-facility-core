"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDownAZ, ArrowUpAZ, Download, Filter, Search, Settings2, X } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { cropColor } from "@/lib/orchard/crop-identity"

type Locale = "en" | "es" | "de"
type Plan = { id:string; season:string|null; status:string; start_date:string|null; end_date:string|null }
type Cycle = { id:string; game_plan_id:string; crop_name:string }
type Succession = { id:string; crop_cycle_id:string; sequence_no:number; planned_bed_m:number|null; planned_first_harvest_date:string|null; planned_last_harvest_date:string|null; knowledge_source_snapshot:Record<string,unknown>|null }
type Allocation = { crop_succession_id:string }
type Harvest = { id:string; crop_succession_id:string|null; harvest_date:string; quantity_harvested:number|null; harvest_unit:string|null; total_market_value:number|null; sales_channel_id:string|null }
type CropProfile = { crop_name:string; category:string|null }
type SalesChannel = { id:string; name:string; status:string }
type Canonical = { yield_per_week_10m_bed?:number|string|null; yield_unit?:string|null; price_per_unit_clp?:number|string|null }
type Cell = { projected:number; projectedRevenue:number; projectedRevenueComplete:boolean; actual:number; actualRevenue:number; actualRevenueComplete:boolean; actualUnits:Set<string> }
type Row = { crop:string; unit:string|null; mixedProjectionUnits:boolean; category:string|null; successionIds:Set<string>; cells:Map<string,Cell>; totalProjected:number; totalProjectedRevenue:number; totalActual:number; totalActualRevenue:number; totalActualUnits:Set<string> }
type SortDirection = "asc" | "desc"
type Flags = { showRecordedValues:boolean; showProjectedRevenue:boolean; showRecordedRevenue:boolean; showDiff:boolean; showDiffColors?:boolean }

const copy = {
  en:{title:"Season Harvests",description:"Projected and recorded harvests by week, using Black Swan canonical planning and harvest evidence only.",search:"Search crops...",filters:"Filters",options:"Options",export:"Export",channels:"All sales channels",cropTypes:"Crop types",clear:"Clear all",noTypes:"No canonical crop-type classifications are available yet.",showProjectedRevenue:"Show projected revenue",showRecordedRevenue:"Show recorded harvest revenue",showRecordedValues:"Show recorded harvest values",showDiff:"Show projection / harvest difference",showColors:"Show difference with colors",showRounded:"Show rounded values",crop:"Crop",unit:"Unit",proj:"Proj.",prev:"P.Rev.",harv:"Harv.",rev:"Rev.",diff:"Diff",total:"Total",empty:"No crops match the current view.",source:"Projection: canonical yield × physical bed meters × harvest-window overlap. Recorded values: orchard_harvest_records linked to current-plan successions. Incompatible units are never summed.",noChannels:"No sales channels configured",all:"All",loadError:"Could not load harvest data.",today:"Current week",range:"Harvest window"},
  es:{title:"Cosechas de temporada",description:"Cosecha proyectada y registrada por semana usando únicamente planificación canónica y evidencia real de Black Swan.",search:"Buscar cultivos...",filters:"Filtros",options:"Opciones",export:"Exportar",channels:"Todos los canales de venta",cropTypes:"Tipos de cultivo",clear:"Limpiar",noTypes:"Todavía no existen clasificaciones canónicas por tipo de cultivo.",showProjectedRevenue:"Mostrar ingreso proyectado",showRecordedRevenue:"Mostrar ingreso real de cosecha",showRecordedValues:"Mostrar valores reales de cosecha",showDiff:"Mostrar diferencia proyección / cosecha",showColors:"Mostrar diferencia con colores",showRounded:"Mostrar valores redondeados",crop:"Cultivo",unit:"Unidad",proj:"Proy.",prev:"Ing. proy.",harv:"Cos.",rev:"Ing. real",diff:"Dif.",total:"Total",empty:"No hay cultivos para la vista actual.",source:"Proyección: rendimiento canónico × metros físicos de cama × traslape de ventana de cosecha. Real: orchard_harvest_records vinculados a sucesiones del plan actual. Nunca se suman unidades incompatibles.",noChannels:"No hay canales de venta configurados",all:"Todos",loadError:"No fue posible cargar la cosecha.",today:"Semana actual",range:"Ventana de cosecha"},
  de:{title:"Saisonernten",description:"Projizierte und erfasste Ernten pro Woche, ausschließlich aus kanonischer Black-Swan-Planung und Erntenachweisen.",search:"Kulturen suchen...",filters:"Filter",options:"Optionen",export:"Export",channels:"Alle Vertriebskanäle",cropTypes:"Kulturtypen",clear:"Zurücksetzen",noTypes:"Noch keine kanonischen Kulturtyp-Klassifikationen verfügbar.",showProjectedRevenue:"Projizierten Umsatz anzeigen",showRecordedRevenue:"Erfassten Ernteumsatz anzeigen",showRecordedValues:"Erfasste Erntewerte anzeigen",showDiff:"Differenz Prognose / Ernte anzeigen",showColors:"Differenz farblich anzeigen",showRounded:"Gerundete Werte anzeigen",crop:"Kultur",unit:"Einheit",proj:"Progn.",prev:"P.Ums.",harv:"Ernte",rev:"Umsatz",diff:"Diff",total:"Gesamt",empty:"Keine Kulturen entsprechen der aktuellen Ansicht.",source:"Prognose: kanonischer Ertrag × physische Beetmeter × Erntefenster. Ist: orchard_harvest_records mit Folgen des aktuellen Plans. Inkompatible Einheiten werden nie summiert.",noChannels:"Keine Vertriebskanäle konfiguriert",all:"Alle",loadError:"Erntedaten konnten nicht geladen werden.",today:"Aktuelle Woche",range:"Erntefenster"}
} as const

const localeMap:Record<Locale,string> = { en:"en-US", es:"es-CL", de:"de-DE" }
const dateKey = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
const addDays = (value:string, days:number) => { const d=new Date(`${value}T12:00:00`); d.setDate(d.getDate()+days); return dateKey(d) }
const mondayOf = (value:string) => { const d=new Date(`${value}T12:00:00`); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dateKey(d) }
const weekKeys = (start:string,end:string) => { const out:string[]=[]; let key=mondayOf(start); while(key<=end&&out.length<60){ out.push(key); key=addDays(key,7) } return out }
const isoWeek = (value:string) => { const d=new Date(`${value}T12:00:00Z`); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3); const firstThursday=new Date(Date.UTC(d.getUTCFullYear(),0,4)); return 1+Math.round((d.getTime()-firstThursday.getTime())/604800000) }
const overlapDays = (start:string,end:string,weekStart:string) => { const weekEnd=addDays(weekStart,6); const from=start>weekStart?start:weekStart; const to=end<weekEnd?end:weekEnd; if(from>to)return 0; return Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000)+1 }
const asFinite = (value:unknown) => { const n=Number(value); return Number.isFinite(n)?n:null }
const canonicalFor = (snapshot:Record<string,unknown>|null):Canonical => { if(!snapshot)return{}; const value=snapshot["black_swan_canonical"]; return value&&typeof value==="object"?value as Canonical:{} }
const normalize = (value:string) => value.trim().toLowerCase()
const blankCell = ():Cell => ({projected:0,projectedRevenue:0,projectedRevenueComplete:true,actual:0,actualRevenue:0,actualRevenueComplete:true,actualUnits:new Set<string>()})

function monthGroups(weeks:string[], locale:string){
  const groups:{label:string;start:number;count:number}[]=[]
  weeks.forEach((week,index)=>{
    const label=new Date(`${week}T12:00:00`).toLocaleDateString(locale,{month:"short",year:"numeric"})
    const last=groups.at(-1)
    if(last?.label===label) last.count+=1
    else groups.push({label,start:index,count:1})
  })
  return groups
}

export default function SeasonHarvestsPage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]; const locale=localeMap[lang]
  const [plans,setPlans]=useState<Plan[]>([]), [cycles,setCycles]=useState<Cycle[]>([]), [successions,setSuccessions]=useState<Succession[]>([]), [allocations,setAllocations]=useState<Allocation[]>([]), [harvests,setHarvests]=useState<Harvest[]>([]), [profiles,setProfiles]=useState<CropProfile[]>([]), [channels,setChannels]=useState<SalesChannel[]>([])
  const [loading,setLoading]=useState(true), [error,setError]=useState<string|null>(null), [query,setQuery]=useState(""), [sort,setSort]=useState<SortDirection>("asc"), [filterOpen,setFilterOpen]=useState(false), [optionsOpen,setOptionsOpen]=useState(false), [selectedTypes,setSelectedTypes]=useState<Set<string>>(new Set()), [selectedChannel,setSelectedChannel]=useState("all")
  const [showProjectedRevenue,setShowProjectedRevenue]=useState(false), [showRecordedRevenue,setShowRecordedRevenue]=useState(false), [showRecordedValues,setShowRecordedValues]=useState(true), [showDiff,setShowDiff]=useState(false), [showDiffColors,setShowDiffColors]=useState(false), [showRounded,setShowRounded]=useState(false)

  useEffect(()=>{
    let live=true; setLoading(true); setError(null)
    void Promise.all([
      supabase.from("orchard_game_plans").select("id,season,status,start_date,end_date").order("start_date",{ascending:false}),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_bed_m,planned_first_harvest_date,planned_last_harvest_date,knowledge_source_snapshot").neq("status","cancelled"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id"),
      supabase.from("orchard_harvest_records").select("id,crop_succession_id,harvest_date,quantity_harvested,harvest_unit,total_market_value,sales_channel_id").order("harvest_date"),
      supabase.from("orchard_crop_library").select("crop_name,category").eq("is_active",true).eq("classification_scheme","black_swan_canonical").eq("classification_code","fundo_corcovado"),
      supabase.from("orchard_sales_channels").select("id,name,status").order("name")
    ]).then(([p,c,s,a,h,f,ch])=>{
      if(!live)return
      const first=p.error??c.error??s.error??a.error??h.error??f.error??ch.error
      if(first){ setError(`${text.loadError} ${first.message}`); setLoading(false); return }
      setPlans((p.data??[]) as Plan[]); setCycles((c.data??[]) as Cycle[]); setSuccessions((s.data??[]) as Succession[]); setAllocations((a.data??[]) as Allocation[]); setHarvests((h.data??[]) as Harvest[]); setProfiles((f.data??[]) as CropProfile[]); setChannels((ch.data??[]) as SalesChannel[]); setLoading(false)
    })
    return()=>{live=false}
  },[supabase,text.loadError])

  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const cycleById=new Map(cycles.filter(c=>c.game_plan_id===plan?.id).map(c=>[c.id,c]))
  const allocatedIds=new Set(allocations.map(a=>a.crop_succession_id))
  const scoped=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&allocatedIds.has(s.id)&&s.planned_first_harvest_date&&s.planned_last_harvest_date&&Number(s.planned_bed_m)>0)
  const successionById=new Map(scoped.map(s=>[s.id,s]))
  const categoryByCrop=new Map(profiles.map(p=>[normalize(p.crop_name),p.category]))
  const seasonYear=plan?.season?.match(/\d{4}/)?.[0]??"2026"
  const scopedMin=scoped.map(s=>s.planned_first_harvest_date!).sort()[0]??null
  const scopedMax=scoped.map(s=>s.planned_last_harvest_date!).sort().at(-1)??null
  const minDate=scopedMin??plan?.start_date??`${seasonYear}-08-01`
  const maxDate=scopedMax??plan?.end_date??minDate
  const weeks=weekKeys(minDate,maxDate)
  const months=monthGroups(weeks,locale)
  const today=dateKey(new Date())
  const currentWeek=mondayOf(today)
  const cropTypes=[...new Set(profiles.map(p=>p.category).filter((v):v is string=>Boolean(v)))].sort()

  const rows=useMemo<Row[]>(()=>{
    const byCrop=new Map<string,Row>()
    const rowFor=(crop:string)=>{ let row=byCrop.get(crop); if(!row){ row={crop,unit:null,mixedProjectionUnits:false,category:categoryByCrop.get(normalize(crop))??null,successionIds:new Set(),cells:new Map(),totalProjected:0,totalProjectedRevenue:0,totalActual:0,totalActualRevenue:0,totalActualUnits:new Set()}; byCrop.set(crop,row) } return row }
    for(const s of scoped){
      const cycle=cycleById.get(s.crop_cycle_id); if(!cycle)continue
      const row=rowFor(cycle.crop_name); row.successionIds.add(s.id)
      const canonical=canonicalFor(s.knowledge_source_snapshot); const unit=canonical.yield_unit?.trim()||null; const weeklyYield=asFinite(canonical.yield_per_week_10m_bed); const price=asFinite(canonical.price_per_unit_clp)
      if(unit){ if(row.unit&&row.unit!==unit)row.mixedProjectionUnits=true; else if(!row.unit)row.unit=unit }
      if(weeklyYield==null||!unit)continue
      const daily=weeklyYield/7*(Number(s.planned_bed_m)/10)
      for(const week of weeks){
        const days=overlapDays(s.planned_first_harvest_date!,s.planned_last_harvest_date!,week); if(!days)continue
        const quantity=daily*days; const cell=row.cells.get(week)??blankCell(); cell.projected+=quantity
        if(price==null)cell.projectedRevenueComplete=false; else cell.projectedRevenue+=quantity*price
        row.cells.set(week,cell); row.totalProjected+=quantity; if(price!=null)row.totalProjectedRevenue+=quantity*price
      }
    }
    const scopedIds=new Set(scoped.map(s=>s.id))
    for(const h of harvests){
      if(!h.crop_succession_id||!scopedIds.has(h.crop_succession_id))continue
      if(selectedChannel!=="all"&&h.sales_channel_id!==selectedChannel)continue
      const s=successionById.get(h.crop_succession_id); const cycle=s?cycleById.get(s.crop_cycle_id):null; if(!cycle)continue
      const row=rowFor(cycle.crop_name); const week=mondayOf(h.harvest_date); if(!weeks.includes(week))continue
      const cell=row.cells.get(week)??blankCell()
      if(h.quantity_harvested!=null&&h.harvest_unit){ cell.actualUnits.add(h.harvest_unit); row.totalActualUnits.add(h.harvest_unit); if(!row.unit||row.unit===h.harvest_unit){ cell.actual+=Number(h.quantity_harvested); row.totalActual+=Number(h.quantity_harvested) } }
      if(h.total_market_value!=null){ cell.actualRevenue+=Number(h.total_market_value); row.totalActualRevenue+=Number(h.total_market_value) } else cell.actualRevenueComplete=false
      row.cells.set(week,cell)
    }
    return [...byCrop.values()]
  },[scoped,cycleById,weeks,harvests,successionById,categoryByCrop,selectedChannel])

  const visibleRows=rows.filter(row=>{ if(query.trim()&&!row.crop.toLowerCase().includes(query.trim().toLowerCase()))return false; if(selectedTypes.size&&(!row.category||!selectedTypes.has(row.category)))return false; return true }).sort((a,b)=>sort==="asc"?a.crop.localeCompare(b.crop):b.crop.localeCompare(a.crop))
  const number=(value:number)=>value.toLocaleString(locale,{maximumFractionDigits:showRounded?0:2})
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(value)
  const subcols=1+(showRecordedValues?1:0)+(showProjectedRevenue?1:0)+(showRecordedRevenue?1:0)+(showDiff?1:0)
  const weekWidth=Math.max(112,subcols*64)
  const totalWidth=Math.max(132,subcols*76)
  const fixedWidth=322
  const totalTableWidth=fixedWidth+weeks.length*weekWidth+totalWidth
  const flags:Flags={showRecordedValues,showProjectedRevenue,showRecordedRevenue,showDiff,showDiffColors}
  const toggleType=(type:string)=>setSelectedTypes(current=>{ const next=new Set(current); next.has(type)?next.delete(type):next.add(type); return next })
  const toggleRecorded=(value:boolean)=>{ setShowRecordedValues(value); if(!value)setShowDiff(false) }
  const rangeLabel=`${new Date(`${minDate}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"})} → ${new Date(`${maxDate}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"})}`

  const exportCsv=()=>{
    const headers=[text.crop,text.unit,...weeks.map(w=>`W${isoWeek(w)} ${w} ${text.proj}`),text.total]
    const lines=[headers,...visibleRows.map(row=>[row.crop,row.mixedProjectionUnits?"mixed":row.unit??"",...weeks.map(w=>String(row.cells.get(w)?.projected??0)),String(row.totalProjected)])]
    const csv=lines.map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(",")).join("\n")
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); const a=document.createElement("a"); a.href=url; a.download=`black-swan-season-harvests-${plan?.season??"season"}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return <AppLayout><OrchardNavigation/><main className="min-w-0 flex-1 overflow-hidden bg-[var(--bs-bg-primary)] text-foreground">
    <div className="flex h-full min-h-0 flex-col">
      <section className="shrink-0 border-b border-[var(--bs-divider-subtle)] px-4 py-3 lg:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-xl font-medium tracking-[-.02em]">{text.title}</h1><p className="mt-1 max-w-3xl text-xs text-muted-foreground">{text.description}</p></div>
          <div className="text-right"><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{text.range}</p><p className="mt-0.5 text-xs tabular-nums">{rangeLabel}</p></div>
        </div>
      </section>

      <section className="relative shrink-0 border-b border-[var(--bs-divider-subtle)] px-4 py-2 lg:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-3 py-2 text-xs lg:max-w-[360px]"><Search className="h-3.5 w-3.5 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={text.search} className="w-full bg-transparent outline-none placeholder:text-muted-foreground"/></label>
          <button type="button" onClick={()=>setFilterOpen(v=>!v)} className="inline-flex h-9 items-center gap-2 border border-[var(--bs-divider-subtle)] px-3 text-xs"><Filter className="h-3.5 w-3.5"/>{text.filters}</button>
          <select value={selectedChannel} onChange={e=>setSelectedChannel(e.target.value)} className="h-9 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-3 text-xs" disabled={!channels.length}>
            {!channels.length?<option value="all">{text.noChannels}</option>:<><option value="all">{text.channels}</option>{channels.map(channel=><option key={channel.id} value={channel.id}>{channel.name}</option>)}</>}
          </select>
          <button type="button" onClick={()=>setOptionsOpen(v=>!v)} className="inline-flex h-9 items-center gap-2 border border-[var(--bs-divider-subtle)] px-3 text-xs"><Settings2 className="h-3.5 w-3.5"/>{text.options}</button>
          <button type="button" onClick={exportCsv} className="inline-flex h-9 items-center gap-2 border border-[var(--bs-divider-subtle)] px-3 text-xs"><Download className="h-3.5 w-3.5"/>{text.export}</button>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{visibleRows.length} crops · {weeks.length} weeks</span>
        </div>
        {filterOpen?<div className="mt-2 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] p-3"><div className="flex items-center justify-between"><span className="text-xs font-medium">{text.cropTypes}</span><button type="button" onClick={()=>setSelectedTypes(new Set())} className="text-[11px] text-muted-foreground">{text.clear}</button></div>{cropTypes.length?<div className="mt-2 flex flex-wrap gap-1.5">{cropTypes.map(type=><button key={type} type="button" onClick={()=>toggleType(type)} className={`border px-2 py-1 text-[11px] ${selectedTypes.has(type)?"border-[var(--orchard-green)] bg-[var(--orchard-green)]/10":"border-[var(--bs-divider-subtle)]"}`}>{type}</button>)}</div>:<p className="mt-2 text-xs text-muted-foreground">{text.noTypes}</p>}</div>:null}
        {optionsOpen?<div className="absolute right-5 top-12 z-50 w-[320px] border border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-primary)] p-2 shadow-2xl"><div className="flex items-center justify-between px-2 py-1"><span className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{text.options}</span><button type="button" onClick={()=>setOptionsOpen(false)}><X className="h-4 w-4"/></button></div><Toggle label={text.showProjectedRevenue} checked={showProjectedRevenue} onChange={setShowProjectedRevenue}/><Toggle label={text.showRecordedRevenue} checked={showRecordedRevenue} onChange={setShowRecordedRevenue}/><Toggle label={text.showRecordedValues} checked={showRecordedValues} onChange={toggleRecorded}/><Toggle label={text.showDiff} checked={showDiff} onChange={setShowDiff} disabled={!showRecordedValues}/><Toggle label={text.showColors} checked={showDiffColors} onChange={setShowDiffColors}/><Toggle label={text.showRounded} checked={showRounded} onChange={setShowRounded}/></div>:null}
      </section>

      {loading?<div className="p-6 text-sm text-muted-foreground">Loading…</div>:error?<div className="m-4 border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>:<>
        <section className="min-h-0 flex-1 overflow-auto border-b border-[var(--bs-divider-subtle)]" style={{scrollbarGutter:"stable"}}>
          <div style={{minWidth:totalTableWidth}}>
            <div className="sticky top-0 z-40 flex h-7 border-b border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] text-[10px] uppercase tracking-[.08em] text-muted-foreground">
              <div className="sticky left-0 z-50 w-[242px] shrink-0 border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)]"/>
              <div className="sticky left-[242px] z-50 w-[80px] shrink-0 border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)]"/>
              {months.map(month=><div key={`${month.label}-${month.start}`} className="flex shrink-0 items-center justify-center border-r border-[var(--bs-divider-subtle)]" style={{width:month.count*weekWidth}}>{month.label}</div>)}
              <div className="shrink-0" style={{width:totalWidth}}/>
            </div>

            <div className="sticky top-7 z-40 flex border-b border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] text-[10px] uppercase tracking-[.08em] text-muted-foreground">
              <div className="sticky left-0 z-50 flex w-[242px] shrink-0 items-center justify-between border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] px-3 py-2"><span>{text.crop}</span><button type="button" onClick={()=>setSort(v=>v==="asc"?"desc":"asc")} aria-label="Sort crop" className="inline-flex h-6 w-6 items-center justify-center">{sort==="asc"?<ArrowDownAZ className="h-3.5 w-3.5"/>:<ArrowUpAZ className="h-3.5 w-3.5"/>}</button></div>
              <div className="sticky left-[242px] z-50 flex w-[80px] shrink-0 items-center border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] px-2">{text.unit}</div>
              {weeks.map(week=><HeaderWeek key={week} week={week} width={weekWidth} locale={locale} text={text} flags={flags} current={week===currentWeek}/>) }
              <HeaderTotal width={totalWidth} text={text} flags={flags}/>
            </div>

            {visibleRows.length?visibleRows.map((row,index)=><div key={row.crop} className={`flex min-h-[46px] border-b border-[var(--bs-divider-subtle)] ${index%2?"bg-white/[.012]":""}`}>
              <div className="sticky left-0 z-20 flex w-[242px] shrink-0 items-center gap-2 border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-3 py-1.5"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:cropColor(row.crop,null)}}/><div className="min-w-0"><p className="truncate text-[13px] font-medium">{row.crop}</p><p className="text-[10px] text-muted-foreground">{row.successionIds.size} successions{row.category?` · ${row.category}`:""}</p></div></div>
              <div className="sticky left-[242px] z-20 flex w-[80px] shrink-0 items-center border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-2 text-[11px]">{row.mixedProjectionUnits?"mixed":row.unit??"—"}</div>
              {weeks.map(week=><DataCell key={week} cell={row.cells.get(week)??blankCell()} width={weekWidth} unit={row.unit} flags={flags} number={number} money={money} current={week===currentWeek}/>) }
              <TotalCell row={row} width={totalWidth} flags={flags} number={number} money={money}/>
            </div>):<div className="p-8 text-sm text-muted-foreground">{text.empty}</div>}
          </div>
        </section>
        <footer className="shrink-0 px-4 py-2 text-[10px] leading-4 text-muted-foreground lg:px-5">{text.source}</footer>
      </>}
    </div>
  </main></AppLayout>
}

function HeaderWeek({week,width,locale,text,flags,current}:{week:string;width:number;locale:string;text:(typeof copy)[Locale];flags:Flags;current:boolean}){
  const end=addDays(week,6)
  const startLabel=new Date(`${week}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short"})
  const endLabel=new Date(`${end}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short"})
  return <div className={`relative shrink-0 border-r border-[var(--bs-divider-subtle)] ${current?"bg-[var(--orchard-green)]/[.08]":""}`} style={{width}}>{current?<span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--orchard-green)]"/>:null}<div className="px-1 py-1 text-center"><span className={`block ${current?"text-[var(--orchard-green)]":""}`}>W{isoWeek(week)}</span><span className="normal-case tracking-normal">{startLabel} – {endLabel}</span></div><SubHeader text={text} flags={flags}/></div>
}
function HeaderTotal({width,text,flags}:{width:number;text:(typeof copy)[Locale];flags:Flags}){return <div className="shrink-0" style={{width}}><div className="px-1 py-1 text-center">{text.total}</div><SubHeader text={text} flags={flags}/></div>}
function SubHeader({text,flags}:{text:(typeof copy)[Locale];flags:Flags}){const labels=[text.proj,flags.showRecordedValues?text.harv:null,flags.showProjectedRevenue?text.prev:null,flags.showRecordedRevenue?text.rev:null,flags.showDiff?text.diff:null].filter(Boolean);return <div className="grid border-t border-[var(--bs-divider-subtle)]" style={{gridTemplateColumns:`repeat(${labels.length},minmax(0,1fr))`}}>{labels.map(label=><span key={label} className="border-r border-[var(--bs-divider-subtle)] px-1 py-0.5 text-center last:border-r-0">{label}</span>)}</div>}
function DataCell({cell,width,unit,flags,number,money,current}:{cell:Cell;width:number;unit:string|null;flags:Flags;number:(v:number)=>string;money:(v:number)=>string;current:boolean}){const comparable=cell.actualUnits.size<=1&&(!unit||!cell.actualUnits.size||cell.actualUnits.has(unit));const diff=comparable?cell.actual-cell.projected:null;const values=[<span key="p">{cell.projected?number(cell.projected):"-"}</span>,flags.showRecordedValues?<span key="a">{comparable&&cell.actual?number(cell.actual):"-"}</span>:null,flags.showProjectedRevenue?<span key="pr">{cell.projectedRevenueComplete&&cell.projectedRevenue?money(cell.projectedRevenue):"-"}</span>:null,flags.showRecordedRevenue?<span key="ar">{cell.actualRevenueComplete&&cell.actualRevenue?money(cell.actualRevenue):"-"}</span>:null,flags.showDiff?<span key="d" className={flags.showDiffColors&&diff!=null?(diff>0?"text-emerald-400":diff<0?"text-amber-400":"text-muted-foreground"):""}>{diff!=null?number(diff):"-"}</span>:null].filter(Boolean);return <div className={`grid shrink-0 border-r border-[var(--bs-divider-subtle)] text-center text-[11px] ${current?"bg-[var(--orchard-green)]/[.035]":""}`} style={{width,gridTemplateColumns:`repeat(${values.length},minmax(0,1fr))`}}>{values.map((value,index)=><span key={index} className="flex items-center justify-center border-r border-[var(--bs-divider-subtle)] px-1 py-1.5 tabular-nums last:border-r-0">{value}</span>)}</div>}
function TotalCell({row,width,flags,number,money}:{row:Row;width:number;flags:Flags;number:(v:number)=>string;money:(v:number)=>string}){const comparable=row.totalActualUnits.size<=1&&(!row.unit||!row.totalActualUnits.size||row.totalActualUnits.has(row.unit));const diff=comparable?row.totalActual-row.totalProjected:null;const values=[<span key="p">{row.totalProjected?number(row.totalProjected):"-"}</span>,flags.showRecordedValues?<span key="a">{comparable&&row.totalActual?number(row.totalActual):"-"}</span>:null,flags.showProjectedRevenue?<span key="pr">{row.totalProjectedRevenue?money(row.totalProjectedRevenue):"-"}</span>:null,flags.showRecordedRevenue?<span key="ar">{row.totalActualRevenue?money(row.totalActualRevenue):"-"}</span>:null,flags.showDiff?<span key="d" className={flags.showDiffColors&&diff!=null?(diff>0?"text-emerald-400":diff<0?"text-amber-400":"text-muted-foreground"):""}>{diff!=null?number(diff):"-"}</span>:null].filter(Boolean);return <div className="grid shrink-0 bg-white/[.018] text-center text-[11px] font-medium" style={{width,gridTemplateColumns:`repeat(${values.length},minmax(0,1fr))`}}>{values.map((value,index)=><span key={index} className="flex items-center justify-center border-r border-[var(--bs-divider-subtle)] px-1 py-1.5 tabular-nums last:border-r-0">{value}</span>)}</div>}
function Toggle({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){return <label className={`flex min-h-9 items-center justify-between gap-4 px-2 text-xs ${disabled?"opacity-35":""}`}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)} className="h-4 w-4"/></label>}

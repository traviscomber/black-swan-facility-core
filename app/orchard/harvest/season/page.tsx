"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarRange, CircleDollarSign, Leaf, ShieldCheck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { cropColor } from "@/lib/orchard/crop-identity"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id:string; season:string|null; status:string }
type Cycle = { id:string; game_plan_id:string; crop_name:string }
type Succession = {
  id:string
  crop_cycle_id:string
  sequence_no:number
  planned_bed_m:number|null
  planned_first_harvest_date:string|null
  planned_last_harvest_date:string|null
  knowledge_source_snapshot:Record<string,unknown>|null
}
type Allocation = { crop_succession_id:string }
type Canonical = {
  yield_per_week_10m_bed?:number|string|null
  yield_unit?:string|null
  price_per_unit_clp?:number|string|null
  source_file?:string|null
}
type ProjectionCell = { quantity:number; revenue:number; revenueComplete:boolean }
type CropProjection = {
  crop:string
  successionCount:number
  unit:string|null
  mixedUnits:boolean
  sourceReady:number
  priceReady:number
  cells:Map<string,ProjectionCell>
  totalQuantity:number
  totalRevenue:number
  revenueComplete:boolean
}

const copy = {
  en:{eyebrow:"Orchard · Season Harvests",title:"Projected season harvests",description:"Heirloom-style weekly harvest planning using Black Swan canonical evidence only. Quantities come from Dietrich/Corcovado weekly yield references, physical bed meters and exact harvest-window overlap; projected revenue appears only where a canonical CLP unit price exists.",crops:"Crops",weeks:"Weeks",yieldCoverage:"Yield coverage",priceCoverage:"Price coverage",crop:"Crop",unit:"Unit",proj:"Proj.",revenue:"P.Rev.",total:"Total",succ:"successions",source:"Method: yield_per_week_10m_bed × planned bed meters / 10 × active days / 7. No Heirloom yield or price is copied. Missing source yield or price remains blank; incompatible units are never summed.",advanced:"Open weekly availability",none:"—",mixed:"mixed",loadError:"Could not load season harvest projection.",coverage:"source-backed",clp:"CLP"},
  es:{eyebrow:"Huerto · Cosecha temporada",title:"Proyección de cosecha de temporada",description:"Planificación semanal estilo Heirloom usando sólo evidencia canónica de Black Swan. Las cantidades vienen de rendimientos semanales Dietrich/Corcovado, metros físicos de cama y el traslape exacto de la ventana de cosecha; el ingreso proyectado aparece sólo cuando existe precio unitario CLP canónico.",crops:"Cultivos",weeks:"Semanas",yieldCoverage:"Cobertura rendimiento",priceCoverage:"Cobertura precio",crop:"Cultivo",unit:"Unidad",proj:"Proy.",revenue:"Ing. proy.",total:"Total",succ:"sucesiones",source:"Método: yield_per_week_10m_bed × metros planificados / 10 × días activos / 7. No se copia rendimiento ni precio de Heirloom. Rendimiento o precio sin fuente queda vacío; nunca se suman unidades incompatibles.",advanced:"Abrir disponibilidad semanal",none:"—",mixed:"mixto",loadError:"No fue posible cargar la proyección de cosecha.",coverage:"con fuente",clp:"CLP"},
  de:{eyebrow:"Orchard · Saisonernte",title:"Prognostizierte Saisonernte",description:"Heirloom-artige Wochenplanung ausschließlich mit kanonischen Black-Swan-Nachweisen. Mengen stammen aus Dietrich/Corcovado-Wochenerträgen, physischen Beetmetern und dem exakten Überschnitt des Erntefensters; Umsatz erscheint nur bei kanonischem CLP-Einheitspreis.",crops:"Kulturen",weeks:"Wochen",yieldCoverage:"Ertragsabdeckung",priceCoverage:"Preisabdeckung",crop:"Kultur",unit:"Einheit",proj:"Progn.",revenue:"Umsatz",total:"Gesamt",succ:"Folgen",source:"Methode: yield_per_week_10m_bed × geplante Beetmeter / 10 × aktive Tage / 7. Keine Heirloom-Erträge oder Preise werden kopiert. Fehlende Quellen bleiben leer; inkompatible Einheiten werden nie summiert.",advanced:"Wöchentliche Verfügbarkeit öffnen",none:"—",mixed:"gemischt",loadError:"Saisonernte-Prognose konnte nicht geladen werden.",coverage:"quellenbasiert",clp:"CLP"},
} as const

const localeMap:Record<Locale,string> = { en:"en-US", es:"es-CL", de:"de-DE" }
const dateKey = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
const addDays = (value:string,days:number) => { const d=new Date(`${value}T12:00:00`); d.setDate(d.getDate()+days); return dateKey(d) }
const mondayOf = (value:string) => { const d=new Date(`${value}T12:00:00`); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dateKey(d) }
const weekKeys = (start:string,end:string) => { const out:string[]=[]; let key=mondayOf(start); while(key<=end&&out.length<60){ out.push(key); key=addDays(key,7) } return out }
const isoWeek = (value:string) => { const d=new Date(`${value}T12:00:00Z`); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3); const firstThursday=new Date(Date.UTC(d.getUTCFullYear(),0,4)); return 1+Math.round((d.getTime()-firstThursday.getTime())/604800000) }
const overlapDays = (start:string,end:string,weekStart:string) => { const weekEnd=addDays(weekStart,6); const from=start>weekStart?start:weekStart; const to=end<weekEnd?end:weekEnd; if(from>to)return 0; return Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000)+1 }
const asFinite = (value:unknown) => { const n=Number(value); return Number.isFinite(n)?n:null }
const canonicalFor = (snapshot:Record<string,unknown>|null):Canonical => { if(!snapshot)return {}; const value=snapshot["black_swan_canonical"]; return value&&typeof value==="object"?value as Canonical:{} }
const compactUnit = (value:string|null) => value?.trim() || null

export default function OrchardSeasonHarvestProjectionPage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]; const locale=localeMap[lang]
  const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([])
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)

  useEffect(()=>{ let live=true; setLoading(true); setError(null); void Promise.all([
    supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_bed_m,planned_first_harvest_date,planned_last_harvest_date,knowledge_source_snapshot").neq("status","cancelled"),
    supabase.from("orchard_bed_allocations").select("crop_succession_id"),
  ]).then(([p,c,s,a])=>{ if(!live)return; const first=p.error??c.error??s.error??a.error; if(first){setError(`${text.loadError} ${first.message}`);setLoading(false);return} setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);setLoading(false) }); return()=>{live=false} },[supabase,text.loadError])

  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[]; const cycleById=new Map(scopedCycles.map(c=>[c.id,c])); const allocatedIds=new Set(allocations.map(a=>a.crop_succession_id))
  const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&allocatedIds.has(s.id)&&s.planned_first_harvest_date&&s.planned_last_harvest_date&&Number(s.planned_bed_m)>0)
  const minDate=scopedSuccessions.map(s=>s.planned_first_harvest_date!).sort()[0]??"2026-08-01"; const maxDate=scopedSuccessions.map(s=>s.planned_last_harvest_date!).sort().at(-1)??minDate; const weeks=weekKeys(minDate,maxDate)

  const rows=useMemo<CropProjection[]>(()=>{
    const byCrop=new Map<string,CropProjection>()
    for(const succession of scopedSuccessions){
      const cycle=cycleById.get(succession.crop_cycle_id); if(!cycle)continue
      const canonical=canonicalFor(succession.knowledge_source_snapshot); const unit=compactUnit(canonical.yield_unit??null); const weeklyYield10m=asFinite(canonical.yield_per_week_10m_bed); const price=asFinite(canonical.price_per_unit_clp); const bedM=Number(succession.planned_bed_m)
      let row=byCrop.get(cycle.crop_name)
      if(!row){ row={crop:cycle.crop_name,successionCount:0,unit:null,mixedUnits:false,sourceReady:0,priceReady:0,cells:new Map(),totalQuantity:0,totalRevenue:0,revenueComplete:true}; byCrop.set(cycle.crop_name,row) }
      row.successionCount+=1
      if(unit){ if(row.unit&&row.unit!==unit)row.mixedUnits=true; else if(!row.unit)row.unit=unit }
      if(weeklyYield10m==null||!unit)continue
      row.sourceReady+=1; if(price!=null)row.priceReady+=1
      const dailyYield=weeklyYield10m/7*(bedM/10)
      for(const week of weeks){
        const days=overlapDays(succession.planned_first_harvest_date!,succession.planned_last_harvest_date!,week); if(days===0)continue
        const quantity=dailyYield*days; const existing=row.cells.get(week)??{quantity:0,revenue:0,revenueComplete:true}; existing.quantity+=quantity
        if(price==null)existing.revenueComplete=false; else existing.revenue+=quantity*price
        row.cells.set(week,existing); row.totalQuantity+=quantity
        if(price==null)row.revenueComplete=false; else row.totalRevenue+=quantity*price
      }
    }
    return [...byCrop.values()].sort((a,b)=>a.crop.localeCompare(b.crop))
  },[scopedSuccessions,cycleById,weeks])

  const sourceReady=rows.reduce((sum,row)=>sum+row.sourceReady,0); const priceReady=rows.reduce((sum,row)=>sum+row.priceReady,0); const successionCount=scopedSuccessions.length
  const n=(value:number,digits=1)=>value.toLocaleString(locale,{maximumFractionDigits:digits})
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(value)
  const advancedHref=`/${language}/orchard/harvest/desk${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1800px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
    <header className="mb-5 max-w-5xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><div className="mt-1.5 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{text.description}</p></header>
    {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="border-y border-red-400/30 py-4 text-sm text-red-300">{error}</div>:<>
      <section className="mb-5 grid border-y border-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Leaf} label={text.crops} value={rows.length}/><Metric icon={CalendarRange} label={text.weeks} value={weeks.length}/><Metric icon={ShieldCheck} label={text.yieldCoverage} value={`${sourceReady}/${successionCount}`}/><Metric icon={CircleDollarSign} label={text.priceCoverage} value={`${priceReady}/${successionCount}`}/></section>

      <section className="mb-5"><div className="overflow-x-auto border-y border-[var(--bs-divider-subtle)]"><div style={{minWidth:`${330+weeks.length*118+190}px`}}>
        <div className="flex border-b border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] text-[10px] uppercase tracking-[.08em] text-muted-foreground"><div className="sticky left-0 z-20 w-[250px] shrink-0 border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] px-3 py-2">{text.crop}</div><div className="sticky left-[250px] z-20 w-[80px] shrink-0 border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] px-2 py-2">{text.unit}</div>{weeks.map(week=><div key={week} className="w-[118px] shrink-0 border-r border-[var(--bs-divider-subtle)] px-1 py-2 text-center"><span className="block">W{isoWeek(week)}</span><span className="mt-0.5 block normal-case tracking-normal">{new Date(`${week}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short"})}</span><span className="mt-1 grid grid-cols-2 gap-1 normal-case tracking-normal"><i className="not-italic">{text.proj}</i><i className="not-italic">{text.revenue}</i></span></div>)}<div className="w-[190px] shrink-0 px-2 py-2 text-center"><span className="block">{text.total}</span><span className="mt-1 grid grid-cols-2 gap-1 normal-case tracking-normal"><i className="not-italic">{text.proj}</i><i className="not-italic">{text.revenue}</i></span></div></div>
        {rows.map(row=><div key={row.crop} className="flex min-h-14 border-b border-[var(--bs-divider-subtle)] last:border-b-0"><div className="sticky left-0 z-10 flex w-[250px] shrink-0 items-center gap-2 border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-3 py-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:cropColor(row.crop,null)}}/><div className="min-w-0"><p className="truncate text-sm font-medium">{row.crop}</p><p className="text-[10px] text-muted-foreground">{row.successionCount} {text.succ} · {row.sourceReady}/{row.successionCount} {text.coverage}</p></div></div><div className="sticky left-[250px] z-10 flex w-[80px] shrink-0 items-center border-r border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-2 text-[11px] text-muted-foreground">{row.mixedUnits?text.mixed:(row.unit??text.none)}</div>{weeks.map(week=>{const cell=row.cells.get(week);return <div key={week} className="grid w-[118px] shrink-0 grid-cols-2 items-center border-r border-[var(--bs-divider-subtle)] text-center text-[11px] tabular-nums"><span>{cell&&!row.mixedUnits?n(cell.quantity):text.none}</span><span className="text-muted-foreground">{cell&&cell.revenueComplete?money(cell.revenue):text.none}</span></div>})}<div className="grid w-[190px] shrink-0 grid-cols-2 items-center bg-[var(--bs-surface-secondary)] px-1 text-center text-xs font-medium tabular-nums"><span>{!row.mixedUnits&&row.sourceReady?n(row.totalQuantity):text.none}</span><span>{row.revenueComplete&&row.priceReady?money(row.totalRevenue):text.none}</span></div></div>)}
      </div></div></section>

      <div className="flex flex-col gap-4 border-t border-[var(--bs-divider-subtle)] pt-4 sm:flex-row sm:items-start sm:justify-between"><p className="max-w-5xl text-xs leading-5 text-muted-foreground">{text.source}</p><Link href={advancedHref} className="inline-flex shrink-0 items-center gap-2 text-sm text-[var(--orchard-green)]">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
    </>}
  </main></AppLayout>
}

function Metric({icon:Icon,label,value}:{icon:typeof Leaf;label:string;value:string|number}){return <div className="border-r border-[var(--bs-divider-subtle)] px-3 py-3 last:border-r-0"><Icon className="h-4 w-4 text-muted-foreground"/><p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl tabular-nums">{value}</p></div>}

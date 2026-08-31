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
type Harvest={id:string;crop_succession_id:string|null;harvest_date:string;quantity_harvested:number|null;harvest_unit:string|null;harvest_lot_code:string|null}

const copy={
 en:{eyebrow:"Orchard · Harvest",title:"What is coming off the field",description:"A simple harvest desk: planned windows first, recorded output second. Detailed quality, storage and traceability stay available when needed.",planned:"Planned harvest windows",recorded:"Recorded harvest passes",crops:"Crops with windows",next:"Next harvest",none:"No harvest window recorded",noActual:"No harvest has been recorded for this Game Plan yet.",crop:"Crop",window:"Window",actual:"Recorded output",advanced:"Record / manage harvest",source:"Plan windows and actual harvest records from canonical Supabase data."},
 es:{eyebrow:"Huerto · Cosecha",title:"Qué está saliendo del campo",description:"Una mesa simple de cosecha: primero ventanas planificadas, después producción registrada. Calidad, almacenamiento y trazabilidad detallada quedan disponibles cuando se necesiten.",planned:"Ventanas de cosecha",recorded:"Pasadas de cosecha registradas",crops:"Cultivos con ventana",next:"Próxima cosecha",none:"Sin ventana de cosecha",noActual:"Todavía no hay cosechas registradas para este Game Plan.",crop:"Cultivo",window:"Ventana",actual:"Producción registrada",advanced:"Registrar / gestionar cosecha",source:"Ventanas del plan y cosechas reales desde datos canónicos de Supabase."},
 de:{eyebrow:"Orchard · Ernte",title:"Was vom Feld kommt",description:"Ein einfacher Erntetisch: zuerst geplante Fenster, dann erfasster Ertrag. Qualität, Lagerung und Rückverfolgbarkeit bleiben bei Bedarf verfügbar.",planned:"Geplante Erntefenster",recorded:"Erfasste Erntedurchgänge",crops:"Kulturen mit Fenster",next:"Nächste Ernte",none:"Kein Erntefenster",noActual:"Für diesen Game Plan wurde noch keine Ernte erfasst.",crop:"Kultur",window:"Fenster",actual:"Erfasster Ertrag",advanced:"Ernte erfassen / verwalten",source:"Planfenster und reale Ernten aus kanonischen Supabase-Daten."},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateLabel=(v:string,locale:string)=>new Date(`${v}T12:00:00-04:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Santiago"})
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())

export default function DietrichHarvestDesk(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[harvests,setHarvests]=useState<Harvest[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_first_harvest_date,planned_last_harvest_date"),
  supabase.from("orchard_harvest_records").select("id,crop_succession_id,harvest_date,quantity_harvested,harvest_unit,harvest_lot_code").order("harvest_date",{ascending:false}),
 ]).then(([p,c,s,h])=>{if(!live)return;setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setHarvests((h.data??[]) as Harvest[]);setLoading(false)});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null;const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[];const cycleById=new Map(scopedCycles.map(c=>[c.id,c]));const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id));const successionById=new Map(scopedSuccessions.map(s=>[s.id,s]));const scopedHarvests=harvests.filter(h=>h.crop_succession_id&&successionById.has(h.crop_succession_id))
 const windows=scopedSuccessions.filter(s=>s.planned_first_harvest_date&&s.planned_last_harvest_date).map(s=>({s,cycle:cycleById.get(s.crop_cycle_id)!})).sort((a,b)=>a.s.planned_first_harvest_date!.localeCompare(b.s.planned_first_harvest_date!));const next=windows.find(w=>w.s.planned_last_harvest_date!>=today())??null
 const totals=new Map<string,{quantity:number;unit:string|null;passes:number}>();for(const h of scopedHarvests){if(!h.crop_succession_id)continue;const s=successionById.get(h.crop_succession_id);if(!s)continue;const crop=cycleById.get(s.crop_cycle_id)?.crop_name;if(!crop)continue;const current=totals.get(crop)??{quantity:0,unit:h.harvest_unit,passes:0};if(current.unit===h.harvest_unit&&h.quantity_harvested!=null)current.quantity+=Number(h.quantity_harvested);else if(current.unit!==h.harvest_unit)current.unit=null;current.passes+=1;totals.set(crop,current)}
 const advancedHref=`/${language}/orchard/harvest${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:<>
   <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3"><div className="bg-[var(--bs-surface-primary)] p-5"><CalendarRange className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.planned}</p><p className="mt-2 text-3xl tabular-nums">{windows.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><Leaf className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.recorded}</p><p className="mt-2 text-3xl tabular-nums">{scopedHarvests.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.next}</p><p className="mt-2 text-sm font-medium">{next?next.cycle.crop_name:text.none}</p>{next?<p className="mt-1 text-xs text-muted-foreground">{dateLabel(next.s.planned_first_harvest_date!,locale)}</p>:null}</div></section>
   <section className="mb-8"><h2 className="mb-4 text-2xl font-normal">{text.planned}</h2><div className="space-y-px">{windows.map(({s,cycle})=><article key={s.id} className="grid gap-3 bg-[var(--bs-surface-primary)] p-4 sm:grid-cols-[1fr_1fr_1fr]"><div><strong className="font-medium">{cycle.crop_name}</strong><p className="mt-1 text-xs text-muted-foreground">Succession {s.sequence_no}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.window}</p><p className="mt-1 text-sm">{dateLabel(s.planned_first_harvest_date!,locale)} — {dateLabel(s.planned_last_harvest_date!,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.actual}</p><p className="mt-1 text-sm">{totals.has(cycle.crop_name)?`${totals.get(cycle.crop_name)!.quantity.toLocaleString(locale,{maximumFractionDigits:2})} ${totals.get(cycle.crop_name)!.unit??"mixed"} · ${totals.get(cycle.crop_name)!.passes} passes`:"—"}</p></div></article>)}</div></section>
   {scopedHarvests.length===0?<p className="mb-6 bg-[var(--bs-surface-primary)] p-4 text-sm text-muted-foreground">{text.noActual}</p>:null}
   <div className="flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
  </>}
 </main></AppLayout>
}

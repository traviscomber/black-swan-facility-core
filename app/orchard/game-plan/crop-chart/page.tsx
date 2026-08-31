"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BookOpen, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;season:string|null;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;variety:string|null}
type Succession={crop_cycle_id:string;sequence_no:number;knowledge_source_snapshot:Record<string,unknown>|null}
type Canonical={source?:string;source_file?:string;status?:string;dtm_days?:number;yield_unit?:string;nursery_days?:number;rows_per_bed?:string|number;yield_10m_bed?:number;plant_spacing_cm?:number;propagation_type?:string;price_per_unit_clp?:number;harvest_window_days?:number;yield_per_week_10m_bed?:number}

const copy={
 en:{eyebrow:"Dietrich · Crop Chart",title:"The crop standard for this Game Plan",description:"One readable table for the agronomic parameters Dietrich supplied. Values come from the canonical workbook snapshot already attached to each planned succession.",crops:"Crops",direct:"Direct sow",transplant:"Transplant",crop:"Crop",prop:"Propagation",rows:"Rows / bed",spacing:"Spacing",dtm:"DTM",nursery:"Nursery",window:"Harvest window",yield:"Yield / 10 m bed",weekly:"Weekly yield",price:"Price / unit",advanced:"Open advanced agronomic library",source:"Workbook source",days:"days",none:"—"},
 es:{eyebrow:"Dietrich · Crop Chart",title:"El estándar de cultivos de este Game Plan",description:"Una sola tabla legible con los parámetros agronómicos que envió Dietrich. Los valores vienen del snapshot canónico del Excel ya ligado a cada sucesión planificada.",crops:"Cultivos",direct:"Siembra directa",transplant:"Trasplante",crop:"Cultivo",prop:"Propagación",rows:"Filas / cama",spacing:"Distancia",dtm:"DTM",nursery:"Almácigo",window:"Ventana cosecha",yield:"Rendimiento / cama 10 m",weekly:"Rendimiento semanal",price:"Precio / unidad",advanced:"Abrir biblioteca agronómica avanzada",source:"Excel fuente",days:"días",none:"—"},
 de:{eyebrow:"Dietrich · Crop Chart",title:"Der Kulturstandard für diesen Game Plan",description:"Eine lesbare Tabelle mit Dietrichs Anbauparametern. Die Werte stammen aus dem kanonischen Workbook-Snapshot jeder geplanten Folge.",crops:"Kulturen",direct:"Direktsaat",transplant:"Verpflanzung",crop:"Kultur",prop:"Vermehrung",rows:"Reihen / Beet",spacing:"Abstand",dtm:"DTM",nursery:"Anzucht",window:"Erntefenster",yield:"Ertrag / 10-m-Beet",weekly:"Wöchentlicher Ertrag",price:"Preis / Einheit",advanced:"Erweiterte Anbaubibliothek öffnen",source:"Quell-Workbook",days:"Tage",none:"—"},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}

export default function DietrichCropChartPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([])
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety"),
  supabase.from("orchard_crop_successions").select("crop_cycle_id,sequence_no,knowledge_source_snapshot").order("sequence_no"),
 ]).then(([p,c,s])=>{if(!live)return;setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[])});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[]
 const firstSnapshot=new Map<string,Canonical>();for(const s of successions){if(firstSnapshot.has(s.crop_cycle_id))continue;const root=s.knowledge_source_snapshot;const canonical=root&&typeof root==="object"?(root["black_swan_canonical"] as Canonical|undefined):undefined;if(canonical)firstSnapshot.set(s.crop_cycle_id,canonical)}
 const rows=scopedCycles.map(c=>({cycle:c,canonical:firstSnapshot.get(c.id)??{}})).sort((a,b)=>a.cycle.crop_name.localeCompare(b.cycle.crop_name))
 const direct=rows.filter(r=>r.canonical.propagation_type==="DS").length;const transplant=rows.filter(r=>r.canonical.propagation_type==="TR").length
 const source=rows.find(r=>r.canonical.source_file)?.canonical.source_file
 const advancedHref=`/${language}/orchard/library${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 const n=(v:number|undefined,digits=1)=>v==null?text.none:v.toLocaleString(locale,{maximumFractionDigits:digits})
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3"><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.crops}</p><p className="mt-2 text-3xl tabular-nums">{rows.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.direct}</p><p className="mt-2 text-3xl tabular-nums">{direct}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.transplant}</p><p className="mt-2 text-3xl tabular-nums">{transplant}</p></div></section>
  <div className="overflow-x-auto bg-[var(--bs-surface-primary)]"><table className="w-full min-w-[1180px] text-sm"><thead><tr><th className="px-4 py-3 text-left">{text.crop}</th><th className="px-3 py-3 text-left">{text.prop}</th><th className="px-3 py-3 text-right">{text.rows}</th><th className="px-3 py-3 text-right">{text.spacing}</th><th className="px-3 py-3 text-right">{text.dtm}</th><th className="px-3 py-3 text-right">{text.nursery}</th><th className="px-3 py-3 text-right">{text.window}</th><th className="px-3 py-3 text-right">{text.yield}</th><th className="px-3 py-3 text-right">{text.weekly}</th><th className="px-4 py-3 text-right">{text.price}</th></tr></thead><tbody>{rows.map(({cycle,canonical})=><tr key={cycle.id} className="border-t border-[var(--bs-divider-subtle)]"><td className="px-4 py-3"><strong className="font-medium">{cycle.crop_name}</strong>{cycle.variety?<span className="ml-2 text-xs text-muted-foreground">{cycle.variety}</span>:null}</td><td className="px-3 py-3">{canonical.propagation_type??text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.rows_per_bed??text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.plant_spacing_cm!=null?`${n(canonical.plant_spacing_cm)} cm`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.dtm_days!=null?`${canonical.dtm_days} ${text.days}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.nursery_days!=null?`${canonical.nursery_days} ${text.days}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.harvest_window_days!=null?`${canonical.harvest_window_days} ${text.days}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.yield_10m_bed!=null?`${n(canonical.yield_10m_bed)} ${canonical.yield_unit??""}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.yield_per_week_10m_bed!=null?`${n(canonical.yield_per_week_10m_bed)} ${canonical.yield_unit??""}`:text.none}</td><td className="px-4 py-3 text-right tabular-nums">{canonical.price_per_unit_clp!=null?`$${canonical.price_per_unit_clp.toLocaleString("es-CL")}`:text.none}</td></tr>)}</tbody></table></div>
  <div className="mt-5 flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}: {source??text.none}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
 </main></AppLayout>
}

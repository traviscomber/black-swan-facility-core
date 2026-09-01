"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { HEIRLOOM_SEASON_BENCHMARK_SOURCE, heirloomYieldBenchmarkFor } from "@/lib/orchard/heirloom-season-benchmark"

type Locale="en"|"es"|"de"
type Plan={id:string;season:string|null;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;variety:string|null}
type Succession={crop_cycle_id:string;sequence_no:number;knowledge_source_snapshot:Record<string,unknown>|null}
type Canonical={source?:string;source_file?:string;status?:string;dtm_days?:number;yield_unit?:string;nursery_days?:number;rows_per_bed?:string|number;yield_10m_bed?:number;plant_spacing_cm?:number;propagation_type?:string;price_per_unit_clp?:number;harvest_window_days?:number;yield_per_week_10m_bed?:number}
type NormalizedYieldUnit="kg"|"unit"|"bunch"|null

const copy={
 en:{eyebrow:"Dietrich · Crop Chart",title:"Real Corcovado data vs Heirloom reference",description:"Corcovado workbook values remain the operating truth. The authenticated Heirloom 2026 season is shown alongside them as an external benchmark; differences are signals to validate, never automatic replacements.",crops:"Crops",direct:"Direct sow",transplant:"Transplant",crop:"Crop",prop:"Propagation",rows:"Rows / bed",spacing:"Spacing",dtm:"DTM",nursery:"Nursery",window:"Harvest window",yield:"Corcovado yield / 10 m",heirloom:"Heirloom / 10 m",variance:"Difference",weekly:"Weekly yield",price:"Price / unit",advanced:"Open advanced agronomic library",source:"Workbook source",benchmark:"Heirloom benchmark",days:"days",none:"—",exact:"Exact crop match",collapsed:"Heirloom combines profiles",mismatch:"Taxonomy mismatch"},
 es:{eyebrow:"Dietrich · Crop Chart",title:"Datos reales Corcovado vs referencia Heirloom",description:"Los valores del Excel de Corcovado siguen siendo la verdad operativa. La temporada 2026 autenticada de Heirloom se muestra al lado como benchmark externo; las diferencias son señales para validar, nunca reemplazos automáticos.",crops:"Cultivos",direct:"Siembra directa",transplant:"Trasplante",crop:"Cultivo",prop:"Propagación",rows:"Filas / cama",spacing:"Distancia",dtm:"DTM",nursery:"Almácigo",window:"Ventana cosecha",yield:"Rendimiento Corcovado / 10 m",heirloom:"Heirloom / 10 m",variance:"Diferencia",weekly:"Rendimiento semanal",price:"Precio / unidad",advanced:"Abrir biblioteca agronómica avanzada",source:"Excel fuente",benchmark:"Benchmark Heirloom",days:"días",none:"—",exact:"Match exacto de cultivo",collapsed:"Heirloom agrupa perfiles",mismatch:"Taxonomía no equivalente"},
 de:{eyebrow:"Dietrich · Crop Chart",title:"Reale Corcovado-Daten vs. Heirloom-Referenz",description:"Die Corcovado-Workbook-Werte bleiben die operative Wahrheit. Die authentifizierte Heirloom-Saison 2026 wird nur als externer Benchmark daneben angezeigt; Abweichungen sind Prüfhinweise und ersetzen keine Betriebsdaten automatisch.",crops:"Kulturen",direct:"Direktsaat",transplant:"Verpflanzung",crop:"Kultur",prop:"Vermehrung",rows:"Reihen / Beet",spacing:"Abstand",dtm:"DTM",nursery:"Anzucht",window:"Erntefenster",yield:"Corcovado-Ertrag / 10 m",heirloom:"Heirloom / 10 m",variance:"Abweichung",weekly:"Wöchentlicher Ertrag",price:"Preis / Einheit",advanced:"Erweiterte Anbaubibliothek öffnen",source:"Quell-Workbook",benchmark:"Heirloom-Benchmark",days:"Tage",none:"—",exact:"Exakte Kulturzuordnung",collapsed:"Heirloom bündelt Profile",mismatch:"Taxonomie stimmt nicht überein"},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}

function normalizeYieldUnit(value:string|undefined):NormalizedYieldUnit{
 if(!value)return null
 const normalized=value.toLowerCase()
 if(normalized.includes("kilo")||normalized==="kg")return "kg"
 if(normalized.includes("unidad")||normalized.includes("unit"))return "unit"
 if(normalized.includes("ramillete")||normalized.includes("bunch"))return "bunch"
 return null
}

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
 const rows=scopedCycles.map(c=>({cycle:c,canonical:firstSnapshot.get(c.id)??{},heirloom:heirloomYieldBenchmarkFor(c.crop_name)})).sort((a,b)=>a.cycle.crop_name.localeCompare(b.cycle.crop_name))
 const direct=rows.filter(r=>r.canonical.propagation_type==="DS").length;const transplant=rows.filter(r=>r.canonical.propagation_type==="TR").length
 const source=rows.find(r=>r.canonical.source_file)?.canonical.source_file
 const advancedHref=`/${language}/orchard/library${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 const n=(v:number|undefined|null,digits=1)=>v==null?text.none:v.toLocaleString(locale,{maximumFractionDigits:digits})
 const matchLabel=(match:"exact"|"collapsed"|"mismatch")=>match==="exact"?text.exact:match==="collapsed"?text.collapsed:text.mismatch
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1720px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-5xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3"><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.crops}</p><p className="mt-2 text-3xl tabular-nums">{rows.length}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.direct}</p><p className="mt-2 text-3xl tabular-nums">{direct}</p></div><div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.transplant}</p><p className="mt-2 text-3xl tabular-nums">{transplant}</p></div></section>
  <div className="overflow-x-auto bg-[var(--bs-surface-primary)]"><table className="w-full min-w-[1480px] text-sm"><thead><tr><th className="px-4 py-3 text-left">{text.crop}</th><th className="px-3 py-3 text-left">{text.prop}</th><th className="px-3 py-3 text-right">{text.rows}</th><th className="px-3 py-3 text-right">{text.spacing}</th><th className="px-3 py-3 text-right">{text.dtm}</th><th className="px-3 py-3 text-right">{text.nursery}</th><th className="px-3 py-3 text-right">{text.window}</th><th className="px-3 py-3 text-right">{text.yield}</th><th className="px-3 py-3 text-right">{text.heirloom}</th><th className="px-3 py-3 text-right">{text.variance}</th><th className="px-3 py-3 text-right">{text.weekly}</th><th className="px-4 py-3 text-right">{text.price}</th></tr></thead><tbody>{rows.map(({cycle,canonical,heirloom})=>{
    const bsUnit=normalizeYieldUnit(canonical.yield_unit);const comparable=Boolean(heirloom&&canonical.yield_10m_bed!=null&&bsUnit===heirloom.yieldUnit&&heirloom.match!=="mismatch");const variance=comparable&&canonical.yield_10m_bed?((heirloom!.yieldPer10m-canonical.yield_10m_bed)/canonical.yield_10m_bed)*100:null
    return <tr key={cycle.id} className="border-t border-[var(--bs-divider-subtle)]"><td className="px-4 py-3"><strong className="font-medium">{cycle.crop_name}</strong><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{cycle.variety??"Generic"}</span>{heirloom?<Badge variant={heirloom.match==="exact"?"secondary":"outline"}>{matchLabel(heirloom.match)}</Badge>:null}</div></td><td className="px-3 py-3">{canonical.propagation_type??text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.rows_per_bed??text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.plant_spacing_cm!=null?`${n(canonical.plant_spacing_cm)} cm`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.dtm_days!=null?`${canonical.dtm_days} ${text.days}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.nursery_days!=null?`${canonical.nursery_days} ${text.days}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.harvest_window_days!=null?`${canonical.harvest_window_days} ${text.days}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.yield_10m_bed!=null?`${n(canonical.yield_10m_bed)} ${canonical.yield_unit??""}`:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{heirloom?<div><span>{n(heirloom.yieldPer10m)} {heirloom.yieldUnit}</span><div className="mt-1 text-[11px] text-muted-foreground">{heirloom.heirloomCropName} · Generic</div></div>:text.none}</td><td className="px-3 py-3 text-right tabular-nums">{variance==null?text.none:`${variance>0?"+":""}${n(variance,1)}%`}</td><td className="px-3 py-3 text-right tabular-nums">{canonical.yield_per_week_10m_bed!=null?`${n(canonical.yield_per_week_10m_bed)} ${canonical.yield_unit??""}`:text.none}</td><td className="px-4 py-3 text-right tabular-nums">{canonical.price_per_unit_clp!=null?`$${canonical.price_per_unit_clp.toLocaleString("es-CL")}`:text.none}</td></tr>
  })}</tbody></table></div>
  <div className="mt-5 grid gap-2 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:grid-cols-2"><span>{text.source}: {source??text.none}</span><span className="sm:text-right">{text.benchmark}: {HEIRLOOM_SEASON_BENCHMARK_SOURCE.capturedAt} · farm {HEIRLOOM_SEASON_BENCHMARK_SOURCE.farmId} · Generic</span></div>
  <div className="mt-4 flex justify-end"><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
 </main></AppLayout>
}

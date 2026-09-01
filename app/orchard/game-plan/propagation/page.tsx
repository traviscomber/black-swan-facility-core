"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import directSowReference from "@/data/orchard/dietrich-direct-sow-2026-27.json"
import nurseryReference from "@/data/orchard/dietrich-nursery-2026-27.json"

type Locale="en"|"es"|"de"
type Plan={id:string;season:string|null;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;cycle_type:string}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string;planned_transplant_date:string|null;status:string}
type Allocation={crop_succession_id:string}
type DirectRow={crop:string;cultivar:string;seeder:string;rows_per_bed:number;spacing_in:string;spacing_cm:string;calibration:string;brush:string;density_30m:string;density_oz:string;notes:string}
type NurseryRow={cycle_name:string;reference_crop:string;rows_per_bed:number;spacing_cm:string|number|null;row_spacing_cm:string|number|null;tray_cells:string|number;germination_temp:string;days_to_germinate:string|number;days_in_nursery:string|number;seeding_technique:string|null;nursery_notes:string|null;row_marker:string|null;transplant_notes:string|null}

const DIRECT_SOURCE_CROP_BY_CANONICAL:Record<string,string>={
 Arugula:"Rucula",
 "Bush Beans":"Beans (bush)",
 Carrots:"Carrots",
}

const copy={
 en:{eyebrow:"Dietrich · Sowing & Nursery",title:"Propagation on the reconciled field plan",description:"Dates come from the canonical Game Plan. Seeder, calibration, trays and nursery technique remain source-observed workbook references and are shown only where an exact mapping exists.",direct:"Direct sow",transplant:"Nursery & transplant",planned:"reconciled plantings",coverage:"source coverage",crop:"Crop",date:"Sow date",transplantDate:"Transplant date",seeder:"Seeder",calibration:"Calibration",density:"Source density / 30 m",spacing:"Spacing",notes:"Notes",trays:"Tray",temp:"Germination temp",germination:"Germination",nursery:"Days in nursery",technique:"Seeding technique",advanced:"Open advanced seed & nursery management",source:"Reference source: 2026/27 Direct Seeding Chart + Nursery & Transplant Chart",noRows:"No reconciled plantings in this section.",noSource:"No exact source setting",directWarning:"Direct-seeding densities are source values per 30 m reference bed. Current Core beds are 10 m; this screen does not silently convert them.",scopeWarning:"Only plantings with a physical Crop Map allocation are included.",variants:"source variants"},
 es:{eyebrow:"Dietrich · Siembra y Almácigo",title:"Propagación sobre el plan de campo reconciliado",description:"Las fechas vienen del Game Plan canónico. Sembradora, calibración, bandejas y técnica de almácigo siguen siendo referencias observadas en el workbook y sólo aparecen cuando existe un mapeo exacto.",direct:"Siembra directa",transplant:"Almácigo y trasplante",planned:"plantaciones reconciliadas",coverage:"cobertura fuente",crop:"Cultivo",date:"Fecha siembra",transplantDate:"Fecha trasplante",seeder:"Sembradora",calibration:"Calibración",density:"Densidad fuente / 30 m",spacing:"Distancia",notes:"Notas",trays:"Bandeja",temp:"Temp. germinación",germination:"Germinación",nursery:"Días en almácigo",technique:"Técnica siembra",advanced:"Abrir gestión avanzada de semillas y almácigos",source:"Fuente: Direct Seeding Chart + Nursery & Transplant Chart 2026/27",noRows:"No hay plantaciones reconciliadas en esta sección.",noSource:"Sin parámetro fuente exacto",directWarning:"Las densidades de siembra directa son valores fuente por cama de referencia de 30 m. Las camas actuales de Core son de 10 m; esta vista no las convierte silenciosamente.",scopeWarning:"Sólo se incluyen plantaciones con asignación física en Crop Map.",variants:"variantes fuente"},
 de:{eyebrow:"Dietrich · Aussaat & Anzucht",title:"Vermehrung auf dem abgeglichenen Feldplan",description:"Termine stammen aus dem kanonischen Game Plan. Sämaschine, Kalibrierung, Trays und Anzuchttechnik bleiben beobachtete Workbook-Referenzen und werden nur bei exakter Zuordnung gezeigt.",direct:"Direktsaat",transplant:"Anzucht & Verpflanzung",planned:"abgeglichene Pflanzungen",coverage:"Quellabdeckung",crop:"Kultur",date:"Aussaatdatum",transplantDate:"Pflanzdatum",seeder:"Sämaschine",calibration:"Kalibrierung",density:"Quelldichte / 30 m",spacing:"Abstand",notes:"Hinweise",trays:"Tray",temp:"Keimtemperatur",germination:"Keimung",nursery:"Tage in Anzucht",technique:"Aussaattechnik",advanced:"Erweiterte Saatgut- und Anzuchtverwaltung öffnen",source:"Referenzquelle: Direct Seeding Chart + Nursery & Transplant Chart 2026/27",noRows:"Keine abgeglichenen Pflanzungen in diesem Bereich.",noSource:"Keine exakte Quelleinstellung",directWarning:"Direktsaatdichten sind Quellwerte pro 30-m-Referenzbeet. Aktuelle Core-Beete sind 10 m lang; diese Ansicht rechnet nicht stillschweigend um.",scopeWarning:"Es werden nur Pflanzungen mit physischer Crop-Map-Zuordnung einbezogen.",variants:"Quellvarianten"},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateLabel=(v:string|null,locale:string)=>v?new Date(`${v}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"}):"—"

function directRefsFor(crop:string){
 const sourceCrop=DIRECT_SOURCE_CROP_BY_CANONICAL[crop]
 if(!sourceCrop)return []
 return (directSowReference as DirectRow[]).filter(row=>row.crop===sourceCrop)
}

export default function DietrichPropagationPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)
 useEffect(()=>{let live=true;setLoading(true);setError(null);void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,status").neq("status","cancelled").order("planned_sow_date"),
  supabase.from("orchard_bed_allocations").select("crop_succession_id"),
 ]).then(([p,c,s,a])=>{if(!live)return;const first=p.error??c.error??s.error??a.error;if(first){setError(first.message);setLoading(false);return}setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);setLoading(false)});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[]
 const cycleById=new Map(scopedCycles.map(c=>[c.id,c]))
 const allocatedSuccessionIds=new Set(allocations.map(item=>item.crop_succession_id))
 const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&allocatedSuccessionIds.has(s.id))
 const directPlans=scopedSuccessions.filter(s=>cycleById.get(s.crop_cycle_id)?.cycle_type==="direct_sow")
 const transplantPlans=scopedSuccessions.filter(s=>cycleById.get(s.crop_cycle_id)?.cycle_type==="transplant")
 const nurseryByCycle=new Map((nurseryReference as NurseryRow[]).map(r=>[r.cycle_name,r]))
 const directCovered=directPlans.filter(s=>directRefsFor(cycleById.get(s.crop_cycle_id)?.crop_name??"").length>0).length
 const transplantCovered=transplantPlans.filter(s=>nurseryByCycle.has(cycleById.get(s.crop_cycle_id)?.crop_name??"")).length
 const advancedHref=`/${language}/orchard/nursery${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>:<div className="space-y-10">
   <div className="flex gap-3 border border-[#cfe0d5] bg-[#f3f8f5] p-4 text-sm text-[#345744]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/><span>{text.scopeWarning}</span></div>
   <section><div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-normal">{text.direct}</h2><p className="mt-1 text-sm text-muted-foreground">{directPlans.length} {text.planned} · {directCovered}/{directPlans.length} {text.coverage}</p></div><CalendarDays className="h-5 w-5 text-muted-foreground"/></div><div className="mb-4 flex gap-3 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground"><CircleAlert className="mt-1 h-4 w-4 shrink-0"/><span>{text.directWarning}</span></div>{directPlans.length===0?<p className="text-sm text-muted-foreground">{text.noRows}</p>:<div className="space-y-2">{directPlans.map(s=>{const cycle=cycleById.get(s.crop_cycle_id)!;const refs=directRefsFor(cycle.crop_name);return <article key={s.id} className="bg-[var(--bs-surface-primary)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="font-medium">{cycle.crop_name}</strong><p className="mt-1 text-xs text-muted-foreground">Succession {s.sequence_no} · {dateLabel(s.planned_sow_date,locale)}</p></div>{refs.length?<Badge variant="secondary">{refs.length} {text.variants}</Badge>:<Badge variant="outline">{text.noSource}</Badge>}</div>{refs.length?<div className="mt-4 grid gap-3 xl:grid-cols-2">{refs.map((ref,index)=><div key={`${ref.crop}-${ref.cultivar}-${ref.seeder}-${index}`} className="border border-[var(--bs-divider-subtle)] p-3"><div className="grid gap-3 sm:grid-cols-4"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.seeder}</p><p className="mt-1 text-sm">{ref.seeder}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.calibration}</p><p className="mt-1 text-sm">{ref.calibration}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.density}</p><p className="mt-1 text-sm">{ref.density_30m}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.spacing}</p><p className="mt-1 text-sm">{ref.spacing_cm}</p></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{ref.cultivar}{ref.notes?` · ${ref.notes}`:""}</p></div>)}</div>:null}</article>})}</div>}</section>
   <section><div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-normal">{text.transplant}</h2><p className="mt-1 text-sm text-muted-foreground">{transplantPlans.length} {text.planned} · {transplantCovered}/{transplantPlans.length} {text.coverage}</p></div><Sprout className="h-5 w-5 text-muted-foreground"/></div>{transplantPlans.length===0?<p className="text-sm text-muted-foreground">{text.noRows}</p>:<div className="space-y-px">{transplantPlans.map(s=>{const cycle=cycleById.get(s.crop_cycle_id)!;const ref=nurseryByCycle.get(cycle.crop_name);return <article key={s.id} className="bg-[var(--bs-surface-primary)] p-4"><div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr_.8fr_.8fr_.8fr_1fr]"><div><div className="flex flex-wrap items-center gap-2"><strong className="font-medium">{cycle.crop_name}</strong>{ref?<Badge variant="secondary">source</Badge>:<Badge variant="outline">{text.noSource}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">Succession {s.sequence_no}{ref?.reference_crop?` · ${ref.reference_crop}`:""}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.date}</p><p className="mt-1 text-sm">{dateLabel(s.planned_sow_date,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.transplantDate}</p><p className="mt-1 text-sm">{dateLabel(s.planned_transplant_date,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.trays}</p><p className="mt-1 text-sm">{ref?.tray_cells??"—"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.temp}</p><p className="mt-1 text-sm">{ref?.germination_temp??"—"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.technique}</p><p className="mt-1 text-sm">{ref?.seeding_technique??"—"}</p></div></div>{ref&&(ref.nursery_notes||ref.transplant_notes)?<div className="mt-3 grid gap-2 border-t border-[var(--bs-divider-subtle)] pt-3 text-xs leading-5 text-muted-foreground md:grid-cols-2"><span>{ref.nursery_notes??""}</span><span>{ref.transplant_notes??""}</span></div>:null}</article>})}</div>}</section>
   <div className="flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
  </div>}
 </main></AppLayout>
}

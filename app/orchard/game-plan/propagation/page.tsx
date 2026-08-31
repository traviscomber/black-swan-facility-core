"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, Sprout } from "lucide-react"
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

type DirectRow={crop:string;cultivar:string;seeder:string;rows_per_bed:number;spacing_in:string;spacing_cm:string;calibration:string;brush:string;density_30m:string;density_oz:string;notes:string}
type NurseryRow={cycle_name:string;reference_crop:string;rows_per_bed:number;spacing_cm:string|number|null;row_spacing_cm:string|number|null;tray_cells:string|number;germination_temp:string;days_to_germinate:string|number;days_in_nursery:string|number;seeding_technique:string|null;nursery_notes:string|null;row_marker:string|null;transplant_notes:string|null}

const copy={
 en:{eyebrow:"Dietrich · Sowing & Nursery",title:"Propagation without the spreadsheet maze",description:"Plan dates come from the canonical Game Plan. Seeder, calibration, trays and nursery technique come from Dietrich's 2026/27 workbook reference sheets.",direct:"Direct sow",transplant:"Nursery & transplant",planned:"Planned successions",reference:"Reference settings",crop:"Crop",date:"Sow date",transplantDate:"Transplant date",seeder:"Seeder",calibration:"Calibration",density:"Density / 30 m",spacing:"Spacing",notes:"Notes",trays:"Tray",temp:"Germination temp",germination:"Germination",nursery:"Days in nursery",technique:"Seeding technique",marker:"Row marker",advanced:"Open advanced seed & nursery management",source:"Reference source: Copy of Crop Plan 26-27 Black Swan Test.xlsx",noRows:"No planned successions in this section."},
 es:{eyebrow:"Dietrich · Siembra y Almácigo",title:"Propagación sin el laberinto del Excel",description:"Las fechas vienen del Game Plan canónico. Sembradora, calibración, bandejas y técnica de almácigo vienen de las hojas de referencia 2026/27 de Dietrich.",direct:"Siembra directa",transplant:"Almácigo y trasplante",planned:"Sucesiones planificadas",reference:"Parámetros de referencia",crop:"Cultivo",date:"Fecha siembra",transplantDate:"Fecha trasplante",seeder:"Sembradora",calibration:"Calibración",density:"Densidad / 30 m",spacing:"Distancia",notes:"Notas",trays:"Bandeja",temp:"Temp. germinación",germination:"Germinación",nursery:"Días en almácigo",technique:"Técnica siembra",marker:"Marcador de hilera",advanced:"Abrir gestión avanzada de semillas y almácigos",source:"Fuente de referencia: Copy of Crop Plan 26-27 Black Swan Test.xlsx",noRows:"No hay sucesiones planificadas en esta sección."},
 de:{eyebrow:"Dietrich · Aussaat & Anzucht",title:"Vermehrung ohne Tabellen-Labyrinth",description:"Plantermine stammen aus dem kanonischen Game Plan. Sämaschine, Kalibrierung, Trays und Anzuchttechnik stammen aus Dietrichs Referenzblättern 2026/27.",direct:"Direktsaat",transplant:"Anzucht & Verpflanzung",planned:"Geplante Folgen",reference:"Referenzparameter",crop:"Kultur",date:"Aussaatdatum",transplantDate:"Pflanzdatum",seeder:"Sämaschine",calibration:"Kalibrierung",density:"Dichte / 30 m",spacing:"Abstand",notes:"Hinweise",trays:"Tray",temp:"Keimtemperatur",germination:"Keimung",nursery:"Tage in Anzucht",technique:"Aussaattechnik",marker:"Reihenmarkierung",advanced:"Erweiterte Saatgut- und Anzuchtverwaltung öffnen",source:"Referenzquelle: Copy of Crop Plan 26-27 Black Swan Test.xlsx",noRows:"Keine geplanten Folgen in diesem Bereich."},
} as const
const localeMap:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateLabel=(v:string|null,locale:string)=>v?new Date(`${v}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"}):"—"

function normalize(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function directRefsFor(crop:string){
 const key=normalize(crop)
 const aliases:Record<string,string[]>={
  arugula:["rucula"],tatsoi:["asian greens baby"],"bush beans":["beans bush"],"storage beetroot":["beets"],peas:["sweet peas"],"white radish daikon":["winter radishes","radishes"],"new potatoes":["potato"],"storage potatoes":["potato"],shallots:["onion"],corn:["corn"]
 }
 const needles=[key,...(aliases[key]??[])]
 return (directSowReference as DirectRow[]).filter(r=>needles.some(n=>normalize(r.crop).includes(n)||n.includes(normalize(r.crop))))
}

export default function DietrichPropagationPage(){
 const supabase=useMemo(()=>createBrowserClient(),[]);const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;void Promise.all([
  supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,status").order("planned_sow_date"),
 ]).then(([p,c,s])=>{if(!live)return;setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setLoading(false)});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[];const cycleById=new Map(scopedCycles.map(c=>[c.id,c]));const scopedSuccessions=successions.filter(s=>cycleById.has(s.crop_cycle_id))
 const directCycles=scopedCycles.filter(c=>c.cycle_type==="direct_sow");const transplantCycles=scopedCycles.filter(c=>c.cycle_type==="transplant")
 const directIds=new Set(directCycles.map(c=>c.id));const transplantIds=new Set(transplantCycles.map(c=>c.id));const directPlans=scopedSuccessions.filter(s=>directIds.has(s.crop_cycle_id));const transplantPlans=scopedSuccessions.filter(s=>transplantIds.has(s.crop_cycle_id))
 const nurseryByCycle=new Map((nurseryReference as NurseryRow[]).map(r=>[r.cycle_name,r]));const advancedHref=`/${language}/orchard/nursery${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:<div className="space-y-10">
   <section><div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-2xl font-normal">{text.direct}</h2><p className="mt-1 text-sm text-muted-foreground">{directPlans.length} {text.planned.toLowerCase()} · {(directSowReference as DirectRow[]).length} {text.reference.toLowerCase()}</p></div><CalendarDays className="h-5 w-5 text-muted-foreground"/></div>{directPlans.length===0?<p className="text-sm text-muted-foreground">{text.noRows}</p>:<div className="space-y-px">{directPlans.map(s=>{const cycle=cycleById.get(s.crop_cycle_id)!;const refs=directRefsFor(cycle.crop_name);return <article key={s.id} className="bg-[var(--bs-surface-primary)] p-4"><div className="grid gap-4 lg:grid-cols-[1fr_.7fr_2fr]"><div><strong className="font-medium">{cycle.crop_name}</strong><p className="mt-1 text-xs text-muted-foreground">Succession {s.sequence_no} · {dateLabel(s.planned_sow_date,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.seeder}</p><p className="mt-1 text-sm">{refs.length?Array.from(new Set(refs.map(r=>r.seeder))).join(" / "):"—"}</p></div><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.calibration}</p><p className="mt-1 text-sm">{refs[0]?.calibration??"—"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.density}</p><p className="mt-1 text-sm">{refs[0]?.density_30m??"—"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.spacing}</p><p className="mt-1 text-sm">{refs[0]?.spacing_cm??"—"}</p></div></div></div>{refs[0]?.notes?<p className="mt-3 border-l-2 border-[var(--bs-divider-subtle)] pl-3 text-xs leading-5 text-muted-foreground">{refs[0].notes}</p>:null}</article>})}</div>}</section>
   <section><div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-2xl font-normal">{text.transplant}</h2><p className="mt-1 text-sm text-muted-foreground">{transplantPlans.length} {text.planned.toLowerCase()} · {(nurseryReference as NurseryRow[]).length} {text.reference.toLowerCase()}</p></div><Sprout className="h-5 w-5 text-muted-foreground"/></div>{transplantPlans.length===0?<p className="text-sm text-muted-foreground">{text.noRows}</p>:<div className="space-y-px">{transplantPlans.map(s=>{const cycle=cycleById.get(s.crop_cycle_id)!;const ref=nurseryByCycle.get(cycle.crop_name);return <article key={s.id} className="bg-[var(--bs-surface-primary)] p-4"><div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr_.8fr_.8fr_.8fr_1fr]"><div><strong className="font-medium">{cycle.crop_name}</strong><p className="mt-1 text-xs text-muted-foreground">Succession {s.sequence_no}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.date}</p><p className="mt-1 text-sm">{dateLabel(s.planned_sow_date,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.transplantDate}</p><p className="mt-1 text-sm">{dateLabel(s.planned_transplant_date,locale)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.trays}</p><p className="mt-1 text-sm">{ref?.tray_cells??"—"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.temp}</p><p className="mt-1 text-sm">{ref?.germination_temp??"—"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.technique}</p><p className="mt-1 text-sm">{ref?.seeding_technique??"—"}</p></div></div>{ref&&(ref.nursery_notes||ref.transplant_notes)?<div className="mt-3 grid gap-2 border-t border-[var(--bs-divider-subtle)] pt-3 text-xs leading-5 text-muted-foreground md:grid-cols-2"><span>{ref.nursery_notes??""}</span><span>{ref.transplant_notes??""}</span></div>:null}</article>})}</div>}</section>
   <div className="flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
  </div>}
 </main></AppLayout>
}

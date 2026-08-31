"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, CalendarRange, History, Leaf, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id:string; name:string; season:string|null; start_date:string; end_date:string; status:string }
type Cycle = { id:string; game_plan_id:string; crop_name:string }
type Succession = { id:string; crop_cycle_id:string; sequence_no:number }
type Harvest = { id:string; crop_succession_id:string|null; harvest_date:string; quantity_harvested:number|null; harvest_unit:string|null }

const copy = {
  en:{eyebrow:"Orchard · History",title:"What actually happened in previous seasons",description:"History shows completed Black Swan seasons and linked harvest evidence. The current draft plan stays out of historical performance until it becomes real execution.",seasons:"Completed seasons",crops:"Crops",successions:"Successions",passes:"Harvest passes",period:"Recorded harvest period",evidence:"Recent harvest evidence",noEvidence:"No linked harvest evidence for this season.",planning:"Current planning is not history",planningHelp:"The 2026/27 Game Plan remains in preparation and is not mixed into completed-season results.",unlinked:"Historical harvests without a succession link",unlinkedHelp:"These records stay outside season totals until their lineage can be verified. Black Swan does not assign them by date alone.",advanced:"Open advanced season analysis",source:"Completed-season structure and linked harvest records from canonical Supabase data.",none:"—"},
  es:{eyebrow:"Huerto · Historial",title:"Qué ocurrió realmente en temporadas anteriores",description:"Historial muestra temporadas Black Swan completadas y evidencia de cosecha vinculada. El plan draft actual queda fuera del desempeño histórico hasta transformarse en ejecución real.",seasons:"Temporadas completadas",crops:"Cultivos",successions:"Sucesiones",passes:"Pasadas de cosecha",period:"Período de cosecha registrado",evidence:"Evidencia reciente de cosecha",noEvidence:"No hay evidencia de cosecha vinculada para esta temporada.",planning:"La planificación actual no es historial",planningHelp:"El Game Plan 2026/27 sigue en preparación y no se mezcla con los resultados de temporadas completadas.",unlinked:"Cosechas históricas sin vínculo a sucesión",unlinkedHelp:"Estos registros quedan fuera de los totales por temporada hasta verificar su trazabilidad. Black Swan no los asigna sólo por fecha.",advanced:"Abrir análisis avanzado de temporada",source:"Estructura de temporadas completadas y cosechas vinculadas desde datos canónicos de Supabase.",none:"—"},
  de:{eyebrow:"Orchard · Verlauf",title:"Was in früheren Saisons tatsächlich passiert ist",description:"Der Verlauf zeigt abgeschlossene Black-Swan-Saisons und verknüpfte Erntenachweise. Der aktuelle Entwurfsplan bleibt außerhalb historischer Leistung, bis reale Ausführung vorliegt.",seasons:"Abgeschlossene Saisons",crops:"Kulturen",successions:"Folgen",passes:"Erntedurchgänge",period:"Erfasster Erntezeitraum",evidence:"Aktuelle Erntenachweise",noEvidence:"Keine verknüpften Erntenachweise für diese Saison.",planning:"Aktuelle Planung ist kein Verlauf",planningHelp:"Der Game Plan 2026/27 ist noch in Vorbereitung und wird nicht mit abgeschlossenen Saisonergebnissen vermischt.",unlinked:"Historische Ernten ohne Folgeverknüpfung",unlinkedHelp:"Diese Datensätze bleiben außerhalb der Saisonsummen, bis ihre Herkunft verifiziert ist. Black Swan ordnet sie nicht nur anhand des Datums zu.",advanced:"Erweiterte Saisonanalyse öffnen",source:"Abgeschlossene Saisonstruktur und verknüpfte Ernten aus kanonischen Supabase-Daten.",none:"—"},
} as const

const locales:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateLabel=(v:string,locale:string)=>new Date(`${v}T12:00:00-04:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Santiago"})

export default function OrchardHistoryPage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]; const locale=locales[lang]
  const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[harvests,setHarvests]=useState<Harvest[]>([]),[loading,setLoading]=useState(true)

  useEffect(()=>{let live=true;void Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date",{ascending:false}),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no"),
    supabase.from("orchard_harvest_records").select("id,crop_succession_id,harvest_date,quantity_harvested,harvest_unit").order("harvest_date",{ascending:false}),
  ]).then(([p,c,s,h])=>{if(!live)return;setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setHarvests((h.data??[]) as Harvest[]);setLoading(false)});return()=>{live=false}},[supabase])

  const completed=plans.filter(p=>p.status==="completed")
  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const selected=completed.find(p=>p.id===requested)??completed[0]??null
  const draft=plans.find(p=>p.status==="draft")??null
  const allSuccessionIds=new Set(successions.map(s=>s.id))
  const unlinked=harvests.filter(h=>!h.crop_succession_id||!allSuccessionIds.has(h.crop_succession_id))
  const cyclesFor=(planId:string)=>cycles.filter(c=>c.game_plan_id===planId)
  const summaryFor=(planId:string)=>{
    const pc=cyclesFor(planId); const cycleIds=new Set(pc.map(c=>c.id)); const ps=successions.filter(s=>cycleIds.has(s.crop_cycle_id)); const successionIds=new Set(ps.map(s=>s.id)); const ph=harvests.filter(h=>Boolean(h.crop_succession_id&&successionIds.has(h.crop_succession_id))); return {cycles:pc,successions:ps,harvests:ph}
  }
  const scoped=selected?summaryFor(selected.id):{cycles:[] as Cycle[],successions:[] as Succession[],harvests:[] as Harvest[]}
  const cycleById=new Map(scoped.cycles.map(c=>[c.id,c])); const successionById=new Map(scoped.successions.map(s=>[s.id,s]))
  const first=scoped.harvests.length?scoped.harvests.reduce((min,h)=>h.harvest_date<min?h.harvest_date:min,scoped.harvests[0].harvest_date):null
  const last=scoped.harvests.length?scoped.harvests.reduce((max,h)=>h.harvest_date>max?h.harvest_date:max,scoped.harvests[0].harvest_date):null
  const cropFor=(h:Harvest)=>{if(!h.crop_succession_id)return text.none;const s=successionById.get(h.crop_succession_id);return s?cycleById.get(s.crop_cycle_id)?.crop_name??text.none:text.none}
  const href=(path:string,planId?:string)=>`/${language}${path}${planId?`?game_plan=${encodeURIComponent(planId)}`:""}`

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header className="mb-7 max-w-3xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
    {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:<>
      <section className="mb-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-normal">{text.seasons}</h2><History className="h-5 w-5 text-muted-foreground"/></div><div className="grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2">{completed.map(p=>{const s=summaryFor(p.id);const active=selected?.id===p.id;return <Link key={p.id} href={href("/orchard/season-summary",p.id)} className={`bg-[var(--bs-surface-primary)] p-5 ${active?"outline outline-1 outline-[var(--bs-cool-sage)]":""}`}><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{p.season??p.name}</p><p className="mt-2 text-lg">{p.name}</p></div><Badge variant="secondary">{p.status}</Badge></div><div className="mt-5 flex gap-5 text-xs text-muted-foreground"><span>{s.cycles.length} {text.crops.toLowerCase()}</span><span>{s.harvests.length} {text.passes.toLowerCase()}</span></div></Link>})}</div></section>

      {selected?<>
        <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-4">
          <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><Sprout className="h-4 w-4 text-muted-foreground"/><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{text.crops}</p><p className="mt-2 text-3xl tabular-nums">{scoped.cycles.length}</p></div>
          <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.successions}</p><p className="mt-2 text-3xl tabular-nums">{scoped.successions.length}</p></div>
          <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><Leaf className="h-4 w-4 text-muted-foreground"/><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{text.passes}</p><p className="mt-2 text-3xl tabular-nums">{scoped.harvests.length}</p></div>
          <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><CalendarRange className="h-4 w-4 text-muted-foreground"/><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{text.period}</p><p className="mt-2 text-sm">{first&&last?`${dateLabel(first,locale)} — ${dateLabel(last,locale)}`:text.none}</p></div>
        </section>

        <section className="mb-7"><h2 className="mb-4 text-xl font-normal">{text.evidence}</h2>{scoped.harvests.length===0?<p className="bg-[var(--bs-surface-primary)] p-4 text-sm text-muted-foreground">{text.noEvidence}</p>:<div className="space-y-px">{scoped.harvests.slice(0,12).map(h=><article key={h.id} className="grid gap-2 bg-[var(--bs-surface-primary)] p-4 sm:grid-cols-[1fr_150px_150px] sm:items-center"><strong className="font-medium">{cropFor(h)}</strong><time className="text-sm text-muted-foreground">{dateLabel(h.harvest_date,locale)}</time><span className="text-sm tabular-nums sm:text-right">{h.quantity_harvested!=null?`${Number(h.quantity_harvested).toLocaleString(locale,{maximumFractionDigits:2})} ${h.harvest_unit??""}`:text.none}</span></article>)}</div>}</section>
        <div className="mb-7 flex justify-end"><Link href={href("/orchard/season-summary/advanced",selected.id)} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
      </>:null}

      {draft?<section className="mb-6 flex gap-3 bg-[var(--bs-surface-primary)] p-5"><CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"/><div><strong className="font-medium">{text.planning}</strong><p className="mt-1 text-sm leading-6 text-muted-foreground">{text.planningHelp} {draft.season?`(${draft.season})`:""}</p></div></section>:null}
      {unlinked.length?<section className="mb-6 flex gap-3 border-l-2 border-[var(--bs-warm-amber)] pl-4"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-[var(--bs-warm-amber)]"/><div><strong className="text-sm font-medium">{text.unlinked}: {unlinked.length}</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.unlinkedHelp}</p></div></section>:null}
      <p className="border-t border-[var(--bs-divider-subtle)] pt-5 text-xs leading-5 text-muted-foreground">{text.source}</p>
    </>}
  </main></AppLayout>
}

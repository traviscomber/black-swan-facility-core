"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardPenLine, Leaf, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id:string; name:string; season:string|null; start_date:string; end_date:string; status:string }
type Cycle = { id:string; game_plan_id:string; crop_name:string; cycle_type:string }
type Succession = { id:string; crop_cycle_id:string; sequence_no:number; planned_sow_date:string; planned_transplant_date:string|null; planned_first_harvest_date:string|null; status:string }
type FieldEvent = { date:string; kind:"sow"|"transplant"|"harvest"; crop:string; sequence:number }

const copy = {
  en:{eyebrow:"Orchard · Field",title:"Field work, without the software overhead",description:"Dietrich sees only the next physical milestones from the selected Game Plan and three quick recording paths. Detailed operations stay available under advanced tools.",plan:"Game Plan",today:"Today",next7:"Next 7 days",overdue:"Past plan milestones",next:"Next field milestones",sow:"Sow",transplant:"Transplant",harvest:"First harvest",planning:"This Game Plan is still in preparation. These are planning milestones, not evidence that field work happened.",empty:"No field milestone is planned in the next 7 days.",observe:"Record observation",observeHelp:"Capture what was seen in the field.",harvestAction:"Record harvest",harvestHelp:"Open the simple harvest desk.",calendar:"Open calendar",calendarHelp:"See Dietrich's crop task references and dates.",advanced:"Advanced field tools",source:"Canonical sow, transplant and harvest dates from Supabase. No work is completed automatically."},
  es:{eyebrow:"Huerto · Campo",title:"Trabajo en terreno, sin la complejidad del software",description:"Dietrich ve sólo los próximos hitos físicos del Game Plan seleccionado y tres vías rápidas de registro. La operación detallada queda disponible en herramientas avanzadas.",plan:"Game Plan",today:"Hoy",next7:"Próximos 7 días",overdue:"Hitos del plan vencidos",next:"Próximos hitos en terreno",sow:"Sembrar",transplant:"Trasplantar",harvest:"Primera cosecha",planning:"Este Game Plan todavía está en preparación. Estos son hitos de planificación, no evidencia de que el trabajo en terreno haya ocurrido.",empty:"No hay hitos de terreno planificados en los próximos 7 días.",observe:"Registrar observación",observeHelp:"Registrar lo observado en terreno.",harvestAction:"Registrar cosecha",harvestHelp:"Abrir la mesa simple de cosecha.",calendar:"Abrir calendario",calendarHelp:"Ver las tareas de referencia y fechas de Dietrich.",advanced:"Herramientas de campo avanzadas",source:"Fechas canónicas de siembra, trasplante y cosecha desde Supabase. Ningún trabajo se completa automáticamente."},
  de:{eyebrow:"Orchard · Feld",title:"Feldarbeit ohne Software-Overhead",description:"Dietrich sieht nur die nächsten physischen Meilensteine des gewählten Game Plans und drei schnelle Erfassungswege. Detaillierte Abläufe bleiben unter erweiterten Werkzeugen verfügbar.",plan:"Game Plan",today:"Heute",next7:"Nächste 7 Tage",overdue:"Überfällige Planmeilensteine",next:"Nächste Feldmeilensteine",sow:"Aussaat",transplant:"Verpflanzen",harvest:"Erste Ernte",planning:"Dieser Game Plan ist noch in Vorbereitung. Dies sind Planungsmeilensteine, kein Nachweis ausgeführter Feldarbeit.",empty:"In den nächsten 7 Tagen sind keine Feldmeilensteine geplant.",observe:"Beobachtung erfassen",observeHelp:"Beobachtungen aus dem Feld erfassen.",harvestAction:"Ernte erfassen",harvestHelp:"Die einfache Ernteansicht öffnen.",calendar:"Kalender öffnen",calendarHelp:"Dietrichs Aufgabenreferenzen und Termine ansehen.",advanced:"Erweiterte Feldwerkzeuge",source:"Kanonische Aussaat-, Pflanz- und Erntedaten aus Supabase. Arbeit wird nie automatisch abgeschlossen."},
} as const

const locales:Record<Locale,string> = { en:"en-US", es:"es-CL", de:"de-DE" }
const chileDate = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
const addDays = (value:string, days:number) => { const d=new Date(`${value}T12:00:00-04:00`); d.setDate(d.getDate()+days); return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(d) }
const dateLabel = (value:string, locale:string) => new Date(`${value}T12:00:00-04:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Santiago"})

export default function OrchardFieldPage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]; const locale=locales[lang]
  const [plans,setPlans]=useState<Plan[]>([]), [cycles,setCycles]=useState<Cycle[]>([]), [successions,setSuccessions]=useState<Succession[]>([]), [loading,setLoading]=useState(true)

  useEffect(()=>{ let live=true; void Promise.all([
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date",{ascending:false}),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,status").order("planned_sow_date"),
  ]).then(([p,c,s])=>{ if(!live)return; setPlans((p.data??[]) as Plan[]); setCycles((c.data??[]) as Cycle[]); setSuccessions((s.data??[]) as Succession[]); setLoading(false) }); return()=>{live=false} },[supabase])

  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[]
  const cycleById=new Map(scopedCycles.map(c=>[c.id,c]))
  const scoped=successions.filter(s=>cycleById.has(s.crop_cycle_id)&&!["cancelled","canceled","cancelada"].includes(s.status))
  const events:FieldEvent[]=[]
  for(const s of scoped){ const c=cycleById.get(s.crop_cycle_id)!; events.push({date:s.planned_sow_date,kind:"sow",crop:c.crop_name,sequence:s.sequence_no}); if(s.planned_transplant_date)events.push({date:s.planned_transplant_date,kind:"transplant",crop:c.crop_name,sequence:s.sequence_no}); if(s.planned_first_harvest_date)events.push({date:s.planned_first_harvest_date,kind:"harvest",crop:c.crop_name,sequence:s.sequence_no}) }
  events.sort((a,b)=>a.date.localeCompare(b.date))
  const today=chileDate(), end=addDays(today,7)
  const todayEvents=events.filter(e=>e.date===today), upcoming=events.filter(e=>e.date>today&&e.date<=end), overdue=events.filter(e=>e.date<today)
  const visible=[...todayEvents,...upcoming].slice(0,12)
  const href=(path:string)=>`/${language}${path}${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
  const kindLabel=(kind:FieldEvent["kind"])=>kind==="sow"?text.sow:kind==="transplant"?text.transplant:text.harvest

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header className="mb-7 max-w-3xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
    {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:!plan?<div className="py-12 text-sm text-muted-foreground">No Game Plan</div>:<>
      <section className="mb-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-4">
        <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.plan}</p><p className="mt-2 text-lg">{plan.season??plan.name}</p><Badge className="mt-2" variant="secondary">{plan.status}</Badge></div>
        <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.today}</p><p className="mt-2 text-3xl tabular-nums">{todayEvents.length}</p></div>
        <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.next7}</p><p className="mt-2 text-3xl tabular-nums">{upcoming.length}</p></div>
        <div className="bg-[var(--bs-surface-primary)] p-4 sm:p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.overdue}</p><p className="mt-2 text-3xl tabular-nums">{overdue.length}</p></div>
      </section>
      {plan.status==="draft"?<div className="mb-6 flex gap-3 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground"><AlertTriangle className="mt-1 h-4 w-4 shrink-0"/><p>{text.planning}</p></div>:null}

      <section className="mb-8"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-2xl font-normal">{text.next}</h2><Sprout className="h-5 w-5 text-muted-foreground"/></div>
        {visible.length===0?<p className="bg-[var(--bs-surface-primary)] p-4 text-sm text-muted-foreground">{text.empty}</p>:<div className="space-y-px">{visible.map(e=><article key={`${e.kind}-${e.crop}-${e.sequence}-${e.date}`} className="grid gap-2 bg-[var(--bs-surface-primary)] p-4 sm:grid-cols-[130px_1fr_auto] sm:items-center"><time className="text-sm tabular-nums">{dateLabel(e.date,locale)}</time><div><strong className="font-medium">{e.crop}</strong><p className="mt-0.5 text-xs text-muted-foreground">Succession {e.sequence}</p></div><Badge variant="secondary">{kindLabel(e.kind)}</Badge></article>)}</div>}
      </section>

      <section className="grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3">
        <Link href={href("/orchard/mobile")} className="group min-h-32 bg-[var(--bs-surface-primary)] p-5"><ClipboardPenLine className="h-5 w-5 text-muted-foreground"/><div className="mt-6 flex items-end justify-between gap-3"><div><strong className="font-medium">{text.observe}</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.observeHelp}</p></div><ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"/></div></Link>
        <Link href={href("/orchard/harvest/desk")} className="group min-h-32 bg-[var(--bs-surface-primary)] p-5"><Leaf className="h-5 w-5 text-muted-foreground"/><div className="mt-6 flex items-end justify-between gap-3"><div><strong className="font-medium">{text.harvestAction}</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.harvestHelp}</p></div><ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"/></div></Link>
        <Link href={href("/orchard/game-plan/tasks")} className="group min-h-32 bg-[var(--bs-surface-primary)] p-5"><CalendarDays className="h-5 w-5 text-muted-foreground"/><div className="mt-6 flex items-end justify-between gap-3"><div><strong className="font-medium">{text.calendar}</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.calendarHelp}</p></div><ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"/></div></Link>
      </section>
      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={href("/orchard/field/advanced")} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
    </>}
  </main></AppLayout>
}

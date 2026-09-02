"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CircleAlert, FlaskConical, PackageOpen, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { cropChipStyle, cropColor } from "@/lib/orchard/crop-identity"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import nurseryReference from "@/data/orchard/dietrich-nursery-2026-27.json"
import containerPlan from "@/data/orchard/dietrich-nursery-container-plan-2026-27.json"

type Locale = "en" | "es" | "de"
type Plan = { id:string; season:string|null; status:string }
type Cycle = { id:string; game_plan_id:string; crop_name:string; cycle_type:string }
type Succession = { id:string; crop_cycle_id:string; sequence_no:number; planned_sow_date:string; planned_transplant_date:string|null; planned_plants:number|null; germination_rate_pct:number|null; status:string }
type Allocation = { crop_succession_id:string }
type CropProfile = { crop_name:string; crop_family:string|null }
type NurseryRef = { cycle_name:string; reference_crop:string; tray_cells:string|number; germination_temp:string; days_to_germinate:string|number; days_in_nursery:string|number; seeding_technique:string|null; nursery_notes:string|null }
type ContainerRow = { container:string; max_projected:number; total_usage:number; current_in_use:number }

const copy = {
  en:{eyebrow:"Orchard · Nursery plan",title:"Nursery capacity before the first tray is sown",description:"The 22 physically reconciled transplant successions are shown as a projection. Crop identity uses the same canonical family color as Calendar and Crop Map.",transplantPlantings:"Transplant plantings",seedLots:"Seed lots",batches:"Observed batches",observedGerm:"Observed germination",none:"None yet",projection:"Projected container demand",projectionHelp:"Reconciled planning values from Dietrich's Nursery/Crop Chart and the authenticated Heirloom projection. Current use remains zero because no nursery batch has been recorded.",container:"Container",maxProjected:"Max projected",totalUsage:"Total usage",currentUse:"Current in use",schedule:"Propagation schedule",crop:"Crop",sow:"Nursery sow",transplant:"Field transplant",plants:"Planned plants",refContainer:"Source container",germDays:"Germination",nurseryDays:"Nursery",technique:"Technique",evidence:"Evidence",unresolved:"Expected germination unresolved",days:"d",advanced:"Open seed & nursery management",methods:"Open sowing methods",source:"Planning projection only. Actual nursery evidence comes from orchard_nursery_batches; actual seed inventory comes from orchard_seed_lots.",loadError:"Could not load the reconciled nursery plan."},
  es:{eyebrow:"Huerto · Plan de almácigo",title:"Capacidad de almácigo antes de sembrar la primera bandeja",description:"Las 22 sucesiones de trasplante físicamente reconciliadas se muestran como proyección. La identidad del cultivo usa el mismo color canónico de familia que Calendario y Crop Map.",transplantPlantings:"Trasplantes planificados",seedLots:"Lotes de semilla",batches:"Batches observados",observedGerm:"Germinación observada",none:"Aún no existe",projection:"Demanda proyectada de contenedores",projectionHelp:"Valores de planificación reconciliados desde Nursery/Crop Chart de Dietrich y la proyección autenticada de Heirloom. El uso actual sigue en cero porque no existe ningún batch de almácigo registrado.",container:"Contenedor",maxProjected:"Máximo proyectado",totalUsage:"Uso total",currentUse:"En uso ahora",schedule:"Programa de propagación",crop:"Cultivo",sow:"Siembra almácigo",transplant:"Trasplante campo",plants:"Plantas planificadas",refContainer:"Contenedor fuente",germDays:"Germinación",nurseryDays:"Almácigo",technique:"Técnica",evidence:"Evidencia",unresolved:"Germinación esperada sin resolver",days:"d",advanced:"Abrir gestión de semillas y almácigos",methods:"Abrir métodos de siembra",source:"Sólo proyección de planificación. La evidencia real de almácigo viene de orchard_nursery_batches; el inventario real de semillas viene de orchard_seed_lots.",loadError:"No fue posible cargar el plan reconciliado de almácigo."},
  de:{eyebrow:"Orchard · Anzuchtplan",title:"Anzuchtkapazität vor der ersten Aussaat",description:"Die 22 physisch abgeglichenen Transplant-Folgen werden als Projektion gezeigt. Kulturidentität verwendet dieselbe kanonische Familienfarbe wie Kalender und Crop Map.",transplantPlantings:"Geplante Transplants",seedLots:"Saatgutlose",batches:"Beobachtete Chargen",observedGerm:"Beobachtete Keimung",none:"Noch keine",projection:"Projizierter Behälterbedarf",projectionHelp:"Abgeglichene Planwerte aus Dietrich Nursery/Crop Chart und der authentifizierten Heirloom-Projektion. Aktuelle Nutzung bleibt null, da keine Anzuchtcharge erfasst ist.",container:"Behälter",maxProjected:"Projiziertes Maximum",totalUsage:"Gesamtnutzung",currentUse:"Aktuell in Nutzung",schedule:"Vermehrungsplan",crop:"Kultur",sow:"Aussaat Anzucht",transplant:"Feldpflanzung",plants:"Geplante Pflanzen",refContainer:"Quellbehälter",germDays:"Keimung",nurseryDays:"Anzucht",technique:"Technik",evidence:"Nachweis",unresolved:"Erwartete Keimung ungeklärt",days:"T",advanced:"Saatgut- & Anzuchtverwaltung öffnen",methods:"Aussaatmethoden öffnen",source:"Nur Planprojektion. Reale Anzuchtnachweise stammen aus orchard_nursery_batches; reales Saatgutinventar aus orchard_seed_lots.",loadError:"Der abgeglichene Anzuchtplan konnte nicht geladen werden."}
} as const

const localeMap:Record<Locale,string> = { en:"en-US", es:"es-CL", de:"de-DE" }
const dateLabel = (value:string|null, locale:string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale,{day:"2-digit",month:"short",year:"numeric"}) : "—"
const normalize=(value:string)=>value.trim().toLowerCase()

export default function NurseryOverviewPage(){
  const supabase = useMemo(()=>createBrowserClient(),[])
  const { language } = useLanguage(); const lang:Locale = language; const text = copy[lang]; const locale = localeMap[lang]
  const [plans,setPlans] = useState<Plan[]>([]), [cycles,setCycles] = useState<Cycle[]>([]), [successions,setSuccessions] = useState<Succession[]>([]), [allocations,setAllocations] = useState<Allocation[]>([]), [profiles,setProfiles] = useState<CropProfile[]>([])
  const [seedLots,setSeedLots] = useState(0), [batches,setBatches] = useState(0), [loading,setLoading] = useState(true), [error,setError] = useState<string|null>(null)

  useEffect(()=>{ let live=true; setLoading(true); setError(null); void Promise.all([
    supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_plants,germination_rate_pct,status").neq("status","cancelled").order("planned_sow_date"),
    supabase.from("orchard_bed_allocations").select("crop_succession_id"),
    supabase.from("orchard_seed_lots").select("id",{count:"exact",head:true}),
    supabase.from("orchard_nursery_batches").select("id",{count:"exact",head:true}),
    supabase.from("orchard_crop_library").select("crop_name,crop_family").eq("is_active",true).eq("classification_scheme","black_swan_canonical").eq("classification_code","fundo_corcovado"),
  ]).then(([p,c,s,a,l,b,f])=>{ if(!live)return; const first=p.error??c.error??s.error??a.error??l.error??b.error??f.error; if(first){setError(`${text.loadError} ${first.message}`);setLoading(false);return} setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);setSeedLots(l.count??0);setBatches(b.count??0);setProfiles((f.data??[]) as CropProfile[]);setLoading(false) }); return()=>{live=false} },[supabase,text.loadError])

  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const familyByCrop=new Map(profiles.map(profile=>[normalize(profile.crop_name),profile.crop_family]));const familyFor=(crop:string)=>familyByCrop.get(normalize(crop))??null
  const cycleById=new Map(cycles.filter(c=>c.game_plan_id===plan?.id).map(c=>[c.id,c]))
  const allocatedIds=new Set(allocations.map(a=>a.crop_succession_id))
  const transplantSuccessions=successions.filter(s=>allocatedIds.has(s.id)&&cycleById.get(s.crop_cycle_id)?.cycle_type==="transplant")
  const refByCycle=new Map((nurseryReference as NurseryRef[]).map(r=>[r.cycle_name,r]))
  const rows=transplantSuccessions.map(s=>({s,cycle:cycleById.get(s.crop_cycle_id)!,ref:refByCycle.get(cycleById.get(s.crop_cycle_id)!.crop_name)??null})).sort((a,b)=>a.s.planned_sow_date.localeCompare(b.s.planned_sow_date))
  const observedGermination=batches>0?"—":text.none
  const maxUsage=Math.max(...(containerPlan.containers as ContainerRow[]).map(r=>r.total_usage),1)
  const advancedHref=`/${language}/orchard/nursery${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
  const methodsHref=`/${language}/orchard/game-plan/propagation${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
    <header className="mb-4 max-w-5xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><div className="mt-1.5 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div><p className="mt-2 max-w-4xl text-sm leading-5 text-muted-foreground">{text.description}</p></header>
    {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="border-y border-red-400/30 py-4 text-sm text-red-300">{error}</div>:<>
      <section className="mb-4 grid border-y border-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Sprout} label={text.transplantPlantings} value={String(rows.length)}/><Metric icon={PackageOpen} label={text.seedLots} value={String(seedLots)}/><Metric icon={FlaskConical} label={text.batches} value={String(batches)}/><Metric icon={CircleAlert} label={text.observedGerm} value={observedGermination}/></section>

      <section className="mb-5 border-y border-[var(--bs-divider-subtle)]"><div className="grid gap-3 py-3 lg:grid-cols-[290px_1fr] lg:items-start"><div><h2 className="text-lg font-normal">{text.projection}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.projectionHelp}</p></div><div className="overflow-x-auto"><div className="min-w-[700px]"><div className="grid grid-cols-[1.4fr_120px_120px_120px_1fr] border-b border-[var(--bs-divider-subtle)] py-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground"><span>{text.container}</span><span>{text.maxProjected}</span><span>{text.totalUsage}</span><span>{text.currentUse}</span><span/></div>{(containerPlan.containers as ContainerRow[]).map(row=><div key={row.container} className="grid grid-cols-[1.4fr_120px_120px_120px_1fr] items-center border-b border-[var(--bs-divider-subtle)] py-2 text-sm last:border-b-0"><strong className="font-medium">{row.container}</strong><span className="tabular-nums">{row.max_projected}</span><span className="tabular-nums">{row.total_usage}</span><span className="tabular-nums">{row.current_in_use}</span><div className="h-1.5 bg-[var(--bs-surface-tertiary)]"><div className="h-full bg-[var(--orchard-green)]" style={{width:`${Math.max(1,(row.total_usage/maxUsage)*100)}%`}}/></div></div>)}</div></div></div></section>

      <section className="mb-6"><div className="mb-2 flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-muted-foreground">{text.schedule}</p><h2 className="mt-1 text-2xl font-normal">{rows.length} · {plan?.season??"—"}</h2></div></div><div className="overflow-x-auto border-y border-[var(--bs-divider-subtle)]"><div className="min-w-[1200px]"><div className="grid grid-cols-[220px_135px_135px_110px_160px_105px_105px_150px_1fr] border-b border-[var(--bs-divider-subtle)] py-2 text-[10px] uppercase tracking-[.11em] text-muted-foreground"><span>{text.crop}</span><span>{text.sow}</span><span>{text.transplant}</span><span>{text.plants}</span><span>{text.refContainer}</span><span>{text.germDays}</span><span>{text.nurseryDays}</span><span>{text.technique}</span><span>{text.evidence}</span></div>{rows.map(({s,cycle,ref})=>{const family=familyFor(cycle.crop_name);const chip=cropChipStyle(cycle.crop_name,family);const color=cropColor(cycle.crop_name,family);return <div key={s.id} className="grid grid-cols-[220px_135px_135px_110px_160px_105px_105px_150px_1fr] items-center border-b border-[var(--bs-divider-subtle)] py-2.5 text-sm last:border-b-0" style={{boxShadow:`inset 2px 0 0 ${color}`}}><div className="pl-3"><strong className="inline-flex items-center gap-2 font-medium"><i className="h-2 w-2 rounded-full" style={{backgroundColor:color}}/>{cycle.crop_name}</strong><p className="mt-0.5 text-[10px]" style={{color:chip.color}}>#{s.sequence_no}{family?` · ${family}`:""}</p></div><span>{dateLabel(s.planned_sow_date,locale)}</span><span>{dateLabel(s.planned_transplant_date,locale)}</span><span className="tabular-nums">{s.planned_plants?.toLocaleString(locale)??"—"}</span><span>{ref?.tray_cells??"—"}</span><span>{ref?`${ref.days_to_germinate} ${text.days}`:"—"}</span><span>{ref?`${ref.days_in_nursery} ${text.days}`:"—"}</span><span>{ref?.seeding_technique??"—"}</span><span className={s.germination_rate_pct?"":"text-[var(--bs-warm-amber)]"}>{s.germination_rate_pct?`${s.germination_rate_pct}%`:text.unresolved}</span></div>})}</div></div></section>

      <footer className="flex flex-col gap-4 border-t border-[var(--bs-divider-subtle)] pt-4 text-xs leading-5 text-muted-foreground lg:flex-row lg:items-center lg:justify-between"><span className="max-w-4xl">{text.source}</span><div className="flex flex-wrap gap-4"><Link href={methodsHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.methods}<ArrowRight className="h-4 w-4"/></Link><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div></footer>
    </>}
  </main></AppLayout>
}

function Metric({icon:Icon,label,value}:{icon:typeof Sprout;label:string;value:string}){return <div className="border-r border-[var(--bs-divider-subtle)] px-3 py-3 last:border-r-0"><Icon className="h-3.5 w-3.5 text-muted-foreground"/><p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl tabular-nums">{value}</p></div>}

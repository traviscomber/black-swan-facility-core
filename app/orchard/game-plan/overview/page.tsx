"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BookOpen, CalendarDays, CalendarRange, ChartNoAxesCombined, Leaf, Map, Sprout, Target } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Plan = { id:string; name:string; season:string|null; start_date:string; end_date:string; status:string }
type Cycle = { id:string; game_plan_id:string }
type Succession = { id:string; crop_cycle_id:string }
type Locale = "en" | "es" | "de"

type Section = {
  href:string
  icon:typeof Target
  title:Record<Locale,string>
  description:Record<Locale,string>
}

const sections:Section[]=[
  {href:"/orchard/game-plan/objectives",icon:Target,title:{en:"Objectives",es:"Objetivos",de:"Ziele"},description:{en:"Mission, annual objectives and the written operating plan.",es:"Misión, objetivos anuales y plan operativo escrito.",de:"Mission, Jahresziele und schriftlicher Betriebsplan."}},
  {href:"/orchard/game-plan",icon:CalendarRange,title:{en:"Season plan",es:"Plan de temporada",de:"Saisonplan"},description:{en:"Codified Game Plan, crop cycles and successions.",es:"Game Plan codificado, ciclos y sucesiones.",de:"Kodifizierter Game Plan, Kulturzyklen und Folgen."}},
  {href:"/orchard/library",icon:BookOpen,title:{en:"Crop Chart",es:"Crop Chart",de:"Crop Chart"},description:{en:"Agronomic parameters, propagation, spacing, yield and crop evidence.",es:"Parámetros agronómicos, propagación, distancias, rendimiento y evidencia.",de:"Anbauparameter, Vermehrung, Abstände, Ertrag und Evidenz."}},
  {href:"/orchard/nursery",icon:Sprout,title:{en:"Sowing & nursery",es:"Siembra y almácigo",de:"Aussaat & Anzucht"},description:{en:"Direct sow, transplant demand, seeds and nursery execution.",es:"Siembra directa, trasplante, semillas y ejecución de almácigos.",de:"Direktsaat, Pflanzbedarf, Saatgut und Anzucht."}},
  {href:"/orchard/work",icon:CalendarDays,title:{en:"Calendar & tasks",es:"Calendario y tareas",de:"Kalender & Aufgaben"},description:{en:"Production calendar converted into accountable field work.",es:"Calendario de producción convertido en trabajo responsable en terreno.",de:"Produktionskalender als verantwortliche Feldarbeit."}},
  {href:"/orchard/crop-map",icon:Map,title:{en:"Beds & capacity",es:"Camas y capacidad",de:"Beete & Kapazität"},description:{en:"Garden map, bed allocation and physical capacity when verified.",es:"Mapa del huerto, asignación de camas y capacidad física cuando esté verificada.",de:"Gartenkarte, Beetzuordnung und verifizierte physische Kapazität."}},
  {href:"/orchard/game-plan/forecast",icon:ChartNoAxesCombined,title:{en:"Production forecast",es:"Forecast de producción",de:"Produktionsprognose"},description:{en:"Harvest windows and planned availability without inventing volume.",es:"Ventanas de cosecha y disponibilidad planificada sin inventar volumen.",de:"Erntefenster und geplante Verfügbarkeit ohne erfundene Mengen."}},
  {href:"/orchard/harvest",icon:Leaf,title:{en:"Harvest",es:"Cosecha",de:"Ernte"},description:{en:"Actual harvest evidence and traceable output.",es:"Evidencia real de cosecha y producción trazable.",de:"Reale Erntenachweise und rückverfolgbare Produktion."}},
]

const copy={
  en:{eyebrow:"Fundo Corcovado · Dietrich Game Plan",title:"One Game Plan, all the operating detail",description:"The workbook structure stays intact, but its helper sheets no longer become separate software modules.",season:"Season",status:"Status",crops:"Crop cycles",successions:"Successions",source:"Canonical operating data from Supabase; workbook structure from Dietrich's Black Swan crop plans.",loading:"Loading Game Plan…",empty:"No Game Plan is registered."},
  es:{eyebrow:"Fundo Corcovado · Game Plan Dietrich",title:"Un Game Plan, todo el detalle operativo",description:"Se conserva la estructura de los Excel, pero las hojas auxiliares dejan de convertirse en módulos separados del software.",season:"Temporada",status:"Estado",crops:"Ciclos de cultivo",successions:"Sucesiones",source:"Datos operativos canónicos desde Supabase; estructura del workbook desde los Crop Plans de Dietrich.",loading:"Cargando Game Plan…",empty:"No hay Game Plan registrado."},
  de:{eyebrow:"Fundo Corcovado · Dietrich Game Plan",title:"Ein Game Plan, alle Betriebsdetails",description:"Die Workbook-Struktur bleibt erhalten, aber Hilfsblätter werden nicht mehr zu separaten Software-Modulen.",season:"Saison",status:"Status",crops:"Kulturzyklen",successions:"Folgen",source:"Kanonische Betriebsdaten aus Supabase; Workbook-Struktur aus Dietrichs Black Swan Crop Plans.",loading:"Game Plan wird geladen…",empty:"Kein Game Plan erfasst."},
} as const

const statusLabel:Record<Locale,Record<string,string>>={
  en:{draft:"Draft",active:"Active",completed:"Completed",archived:"Archived"},
  es:{draft:"En preparación",active:"Activo",completed:"Completado",archived:"Archivado"},
  de:{draft:"In Vorbereitung",active:"Aktiv",completed:"Abgeschlossen",archived:"Archiviert"},
}

export default function DietrichGamePlanOverview(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage()
  const lang:Locale=language
  const text=copy[lang]
  const [plans,setPlans]=useState<Plan[]>([])
  const [cycles,setCycles]=useState<Cycle[]>([])
  const [successions,setSuccessions]=useState<Succession[]>([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    let live=true
    void Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date",{ascending:false}),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id"),
    ]).then(([p,c,s])=>{
      if(!live)return
      setPlans((p.data??[]) as Plan[])
      setCycles((c.data??[]) as Cycle[])
      setSuccessions((s.data??[]) as Succession[])
      setLoading(false)
    })
    return()=>{live=false}
  },[supabase])

  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const scopedCycles=plan?cycles.filter(c=>c.game_plan_id===plan.id):[]
  const cycleIds=new Set(scopedCycles.map(c=>c.id))
  const scopedSuccessions=successions.filter(s=>cycleIds.has(s.crop_cycle_id))
  const href=(path:string)=>`/${language}${path}${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8 max-w-4xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p>
      <h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p>
    </header>

    {loading?<div className="py-12 text-sm text-muted-foreground">{text.loading}</div>:!plan?<div className="py-12 text-sm text-muted-foreground">{text.empty}</div>:<>
      <section className="mb-8 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3">
        <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.season}</p><p className="mt-2 text-2xl">{plan.season??plan.name}</p><Badge className="mt-3" variant="secondary">{statusLabel[lang][plan.status]??plan.status}</Badge></div>
        <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.crops}</p><p className="mt-2 text-3xl tabular-nums">{scopedCycles.length}</p></div>
        <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.successions}</p><p className="mt-2 text-3xl tabular-nums">{scopedSuccessions.length}</p></div>
      </section>

      <section className="grid gap-px bg-[var(--bs-divider-subtle)] md:grid-cols-2 xl:grid-cols-4">
        {sections.map(section=>{const Icon=section.icon;return <Link key={section.href} href={href(section.href)} className="group min-h-48 bg-[var(--bs-surface-primary)] p-5 transition-colors hover:bg-[var(--bs-surface-secondary)]">
          <div className="flex items-start justify-between gap-4"><Icon className="h-5 w-5 text-[var(--bs-cool-sage)]"/><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"/></div>
          <h2 className="mt-10 text-xl font-normal">{section.title[lang]}</h2>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{section.description[lang]}</p>
        </Link>})}
      </section>

      <p className="mt-5 text-xs leading-5 text-muted-foreground">{text.source}</p>
    </>}
  </main></AppLayout>
}

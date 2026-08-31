"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenText, Target } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import sourcePlan from "@/data/orchard/dietrich-game-plan-2026-27.json"

type Locale = "en" | "es" | "de"
type Plan = { id:string; season:string|null; status:string }
type CropPlan = { crop:string; lines:string[] }
type SourcePlan = { sourceFile:string; mission:string; annualGoals:Array<Record<string,unknown>>; writtenGlobal:Array<{title:string;lines:string[]}>; writtenCrops:CropPlan[] }

const copy = {
  en:{eyebrow:"Dietrich · Written Game Plan",title:"The written operating plan, preserved from the workbook",description:"This view keeps the source wording instead of reducing Dietrich's plan to dashboard labels. It is reference material for the 2026/27 Game Plan; canonical dates and execution remain in the Season Plan.",mission:"Mission and annual objectives",global:"Operating framework",cropPlans:"Crop-specific written plan",source:"Workbook source",blank:"Detailed annual-objective rows are blank in the 2026/27 workbook. Black Swan does not invent them.",currentOnly:"This source view is the 2026/27 written plan. Historical seasons remain available through Historial."},
  es:{eyebrow:"Dietrich · Written Game Plan",title:"El plan operativo escrito, preservado desde el Excel",description:"Esta vista conserva el texto fuente en vez de reducir el plan de Dietrich a etiquetas de dashboard. Es material de referencia del Game Plan 2026/27; las fechas canónicas y la ejecución siguen en Plan de temporada.",mission:"Misión y objetivos anuales",global:"Marco operativo",cropPlans:"Plan escrito por cultivo",source:"Excel fuente",blank:"Las filas detalladas de objetivos anuales están vacías en el Excel 2026/27. Black Swan no las inventa.",currentOnly:"Esta vista fuente corresponde al plan escrito 2026/27. Las temporadas históricas siguen disponibles en Historial."},
  de:{eyebrow:"Dietrich · Written Game Plan",title:"Der schriftliche Betriebsplan aus dem Workbook",description:"Diese Ansicht bewahrt Dietrichs Quelltext, statt ihn auf Dashboard-Bezeichnungen zu reduzieren. Sie ist Referenz für den Game Plan 2026/27; kanonische Termine und Ausführung bleiben im Saisonplan.",mission:"Mission und Jahresziele",global:"Betriebsrahmen",cropPlans:"Schriftlicher Plan je Kultur",source:"Quell-Workbook",blank:"Die detaillierten Jahresziel-Zeilen sind im Workbook 2026/27 leer. Black Swan erfindet keine Inhalte.",currentOnly:"Diese Quellansicht entspricht dem schriftlichen Plan 2026/27. Historische Saisons bleiben unter Historie verfügbar."},
} as const

export default function DietrichWrittenGamePlanPage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]
  const [plans,setPlans]=useState<Plan[]>([])
  useEffect(()=>{let live=true;void supabase.from("orchard_game_plans").select("id,season,status").order("start_date",{ascending:false}).then(r=>{if(live)setPlans((r.data??[]) as Plan[])});return()=>{live=false}},[supabase])
  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const source=sourcePlan as SourcePlan
  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8 max-w-4xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1><Badge variant="secondary">2026/27</Badge></div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p>
      {plan?.season&&plan.season!=="2026/27"?<p className="mt-4 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.currentOnly}</p>:null}
    </header>

    <section className="mb-px bg-[var(--bs-surface-primary)] p-6 sm:p-8">
      <div className="flex items-center gap-3"><Target className="h-5 w-5 text-[var(--bs-cool-sage)]"/><h2 className="text-2xl font-normal">{text.mission}</h2></div>
      <div className="mt-5 whitespace-pre-line text-sm leading-7 text-[var(--bs-text-primary)]">{source.mission}</div>
      {source.annualGoals.length===0?<p className="mt-5 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.blank}</p>:null}
    </section>

    <section className="mb-px bg-[var(--bs-surface-primary)] p-6 sm:p-8">
      <div className="flex items-center gap-3"><BookOpenText className="h-5 w-5 text-[var(--bs-cool-sage)]"/><h2 className="text-2xl font-normal">{text.global}</h2></div>
      <div className="mt-6 grid gap-px bg-[var(--bs-divider-subtle)] md:grid-cols-2">
        {source.writtenGlobal.map(section=><article key={section.title} className="bg-[var(--bs-surface-secondary)] p-5"><h3 className="text-lg font-normal">{section.title}</h3><div className="mt-3 space-y-2">{section.lines.map((line,index)=><p key={`${section.title}-${index}`} className="text-sm leading-6 text-muted-foreground">{line}</p>)}</div></article>)}
      </div>
    </section>

    <section className="bg-[var(--bs-surface-primary)] p-6 sm:p-8">
      <h2 className="text-2xl font-normal">{text.cropPlans}</h2>
      <div className="mt-6 grid gap-px bg-[var(--bs-divider-subtle)] md:grid-cols-2 xl:grid-cols-3">
        {source.writtenCrops.map(item=><article key={item.crop} className="bg-[var(--bs-surface-secondary)] p-5"><h3 className="text-lg font-normal">{item.crop}</h3><div className="mt-3 space-y-2">{item.lines.filter(line=>line.trim()!=="Objective:"&&line.trim()!=="Notes:").map((line,index)=><p key={`${item.crop}-${index}`} className="text-sm leading-6 text-muted-foreground">{line}</p>)}</div></article>)}
      </div>
    </section>

    <p className="mt-5 text-xs text-muted-foreground">{text.source}: {source.sourceFile}</p>
  </main></AppLayout>
}

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BookOpen, CalendarRange, Home, Target, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;status:string}

type SourcePlan={
  mission:string[]
  annualGoals:Array<{goal:string;why:string;how:string;strategy:string;date:string}>
  operatingPeriod:string
  restaurant:string
  workers:string
  fieldSeason:string
  springFrost:string
  autumnFrost:string
  infrastructure:string
  detailedGoalsBlank:boolean
  sourceFile:string
}

const plansBySeason:Record<string,SourcePlan>={
  "2024/25":{
    mission:[
      "Provide fresh food: take the first step toward a local food production system in Corcovado that supplies high-quality, nutritious products to visitors and residents and builds a resilient food supply.",
      "Contribute to scenic beauty: create an experiential garden where people can visit, find inspiration and connect with the relationship between people and agriculture.",
      "Be a gathering place: create a comfortable space that invites people to come together.",
    ],
    annualGoals:[
      {goal:"Establish 33 cultivation beds equivalent to 264 m²",why:"Validate the garden as a food source",how:"Follow the established work plan",strategy:"Construct no-till beds using a mini excavator",date:"Gantt chart"},
      {goal:"Establish cell gardens",why:"Establish the garden as a point of interest and scenic beauty",how:"Follow the established work plan",strategy:"Use wood chips as mulch and compost as substrate",date:"Gantt chart"},
      {goal:"Establish biological corridors",why:"Promote beneficial habitats",how:"Follow the established work plan",strategy:"Purchase plants from the nursery",date:"Gantt chart"},
      {goal:"Record yields and data for the next season",why:"Project production and establish continuity strategies",how:"Follow the established work plan",strategy:"Assign a person responsible for weekly monitoring and record-keeping",date:"Gantt chart"},
    ],
    operatingPeriod:"January and February",
    restaurant:"The main customer of the garden is the restaurant at the guesthouse.",
    workers:"Farm workers are supplied year-round; the goal is to supply families living on the farm through a trial season.",
    fieldSeason:"September 20 to May 13 · 236 days",
    springFrost:"November 1",
    autumnFrost:"May 13",
    infrastructure:"Processing Room, Warehouse, Tools",
    detailedGoalsBlank:false,
    sourceFile:"Copy of Plan de Cultivos 24-25 Black Swan.xlsx",
  },
  "2025/26":{
    mission:[
      "Consolidate Fresh Food Production: strengthen and stabilize the local food production system launched in 2024 and maintain a steady supply for residents and visitors.",
      "Enhance the Visitor Experience through Flowers and Berries: add edible and ornamental flowers plus strawberries and raspberries to enrich the sensory and visual experience.",
      "Build the Main Gathering Structures: create shaded seating, a small outdoor kitchen or fire pit and communal resting areas for learning, sharing and community.",
    ],
    annualGoals:[],
    operatingPeriod:"December 15 to March 15",
    restaurant:"The main customer of the garden is the restaurant at the guesthouse.",
    workers:"Farm workers are supplied year-round; the goal is to supply families living on the farm through a trial season.",
    fieldSeason:"September 20 to May 13 · 236 days",
    springFrost:"November 1",
    autumnFrost:"May 13",
    infrastructure:"Processing Room, Warehouse, Tools",
    detailedGoalsBlank:true,
    sourceFile:"Kopie von Crop Plan 25-26 Black Swan.xlsx",
  },
  "2026/27":{
    mission:[
      "Consolidate Fresh Food Production: strengthen and stabilize the local food production system launched in 2024 and maintain a steady supply for residents and visitors.",
      "Enhance the Visitor Experience through Flowers and Berries: add edible and ornamental flowers plus strawberries and raspberries to enrich the sensory and visual experience.",
      "Build the Main Gathering Structures: create shaded seating, a small outdoor kitchen or fire pit and communal resting areas for learning, sharing and community.",
    ],
    annualGoals:[],
    operatingPeriod:"December 15 to March 15",
    restaurant:"The main customer of the garden is the restaurant at the guesthouse.",
    workers:"Farm workers are supplied year-round; the goal is to supply families living on the farm through a trial season.",
    fieldSeason:"September 20 to May 13 · 236 days",
    springFrost:"November 1",
    autumnFrost:"May 13",
    infrastructure:"Processing Room, Warehouse, Tools",
    detailedGoalsBlank:true,
    sourceFile:"Copy of Crop Plan 26-27 Black Swan Test.xlsx",
  },
}

const copy={
 en:{eyebrow:"Mission & Written Game Plan",title:"Why the orchard exists and how the season is meant to work",mission:"Mission and annual objectives",annual:"Annual objectives",written:"Written Game Plan",blank:"The detailed annual-objective rows are blank in the source workbook. Black Swan does not invent them.",customer:"Primary customer",period:"Primary operating period",workers:"Farm workers",season:"Field season",frost:"Frost boundaries",infra:"Infrastructure",cropPlan:"Crop-specific objectives and notes continue in the Crop Chart and Season Plan.",openCrop:"Open Crop Chart",source:"Source workbook"},
 es:{eyebrow:"Misión y Written Game Plan",title:"Por qué existe el huerto y cómo debe funcionar la temporada",mission:"Misión y objetivos anuales",annual:"Objetivos anuales",written:"Written Game Plan",blank:"Las filas detalladas de objetivos anuales están vacías en el Excel fuente. Black Swan no las inventa.",customer:"Cliente principal",period:"Período operativo principal",workers:"Trabajadores del fundo",season:"Temporada de campo",frost:"Límites de heladas",infra:"Infraestructura",cropPlan:"Los objetivos y notas específicos por cultivo continúan en Crop Chart y Plan de Temporada.",openCrop:"Abrir Crop Chart",source:"Excel fuente"},
 de:{eyebrow:"Mission & Written Game Plan",title:"Warum der Garten existiert und wie die Saison funktionieren soll",mission:"Mission und Jahresziele",annual:"Jahresziele",written:"Written Game Plan",blank:"Die detaillierten Jahresziel-Zeilen sind im Quell-Workbook leer. Black Swan erfindet keine Inhalte.",customer:"Hauptkunde",period:"Hauptbetriebszeit",workers:"Mitarbeiter",season:"Feldsaison",frost:"Frostgrenzen",infra:"Infrastruktur",cropPlan:"Kulturspezifische Ziele und Hinweise bleiben im Crop Chart und Saisonplan.",openCrop:"Crop Chart öffnen",source:"Quell-Workbook"},
} as const

export default function OrchardObjectivesPage(){
 const supabase=useMemo(()=>createBrowserClient(),[])
 const {language}=useLanguage();const lang:Locale=language;const text=copy[lang]
 const [plans,setPlans]=useState<Plan[]>([])
 useEffect(()=>{let live=true;void supabase.from("orchard_game_plans").select("id,name,season,status").order("start_date",{ascending:false}).then(r=>{if(live)setPlans((r.data??[]) as Plan[])});return()=>{live=false}},[supabase])
 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const season=plan?.season??"2026/27";const source=plansBySeason[season]??plansBySeason["2026/27"]
 const href=(path:string)=>`/${language}${path}${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
  <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season?<Badge variant="secondary">{plan.season}</Badge>:null}</div></header>
  <section className="mb-px bg-[var(--bs-surface-primary)] p-6 sm:p-8"><div className="flex items-center gap-3"><Target className="h-5 w-5 text-[var(--bs-cool-sage)]"/><h2 className="text-2xl font-normal">{text.mission}</h2></div><div className="mt-6 grid gap-px bg-[var(--bs-divider-subtle)] lg:grid-cols-3">{source.mission.map((item,index)=><article key={index} className="bg-[var(--bs-surface-secondary)] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">0{index+1}</p><p className="mt-3 text-sm leading-6">{item}</p></article>)}</div>
   {source.detailedGoalsBlank?<p className="mt-5 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.blank}</p>:<div className="mt-6"><h3 className="mb-3 text-lg font-normal">{text.annual}</h3><div className="space-y-px">{source.annualGoals.map((g,index)=><div key={g.goal} className="grid gap-2 bg-[var(--bs-surface-secondary)] p-4 md:grid-cols-[40px_1.4fr_1fr_1fr]"><span className="text-sm text-muted-foreground">{index+1}</span><strong className="font-medium">{g.goal}</strong><span className="text-sm text-muted-foreground">{g.why}</span><span className="text-sm text-muted-foreground">{g.strategy}</span></div>)}</div></div>}
  </section>
  <section className="bg-[var(--bs-surface-primary)] p-6 sm:p-8"><div className="flex items-center gap-3"><CalendarRange className="h-5 w-5 text-[var(--bs-cool-sage)]"/><h2 className="text-2xl font-normal">{text.written}</h2></div><div className="mt-6 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 lg:grid-cols-3">
    <div className="bg-[var(--bs-surface-secondary)] p-5"><Home className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.customer}</p><p className="mt-2 text-sm leading-6">{source.restaurant}</p></div>
    <div className="bg-[var(--bs-surface-secondary)] p-5"><CalendarRange className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.period}</p><p className="mt-2 text-lg">{source.operatingPeriod}</p></div>
    <div className="bg-[var(--bs-surface-secondary)] p-5"><Users className="h-4 w-4 text-muted-foreground"/><p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{text.workers}</p><p className="mt-2 text-sm leading-6">{source.workers}</p></div>
    <div className="bg-[var(--bs-surface-secondary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.season}</p><p className="mt-2 text-lg">{source.fieldSeason}</p></div>
    <div className="bg-[var(--bs-surface-secondary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.frost}</p><p className="mt-2 text-sm">Spring: {source.springFrost}</p><p className="mt-1 text-sm">Autumn: {source.autumnFrost}</p></div>
    <div className="bg-[var(--bs-surface-secondary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{text.infra}</p><p className="mt-2 text-sm">{source.infrastructure}</p></div>
  </div>
  <Link href={href("/orchard/library")} className="group mt-6 flex items-center justify-between gap-4 bg-[var(--bs-surface-secondary)] p-5"><div><div className="flex items-center gap-2"><BookOpen className="h-4 w-4"/><strong className="font-medium">{text.cropPlan}</strong></div><p className="mt-2 text-xs text-muted-foreground">{text.source}: {source.sourceFile}</p></div><span className="inline-flex items-center gap-2 text-sm">{text.openCrop}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/></span></Link>
  </section>
 </main></AppLayout>
}

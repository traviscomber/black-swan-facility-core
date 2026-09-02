"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  FlaskConical,
  Hammer,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  Settings,
  ShieldAlert,
  Sprout,
  TestTube2,
  X,
} from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

type Locale = "en" | "es" | "de"
type Plan = { id:string; name:string; season:string|null; status:string }
type NavItem = { href:string; label:Record<Locale,string>; icon:typeof Home; includeChildren?:boolean }

const topItems:NavItem[] = [
  { href:"/orchard/getting-started", label:{en:"Getting started",es:"Iniciación",de:"Einrichtung"}, icon:Home },
  { href:"/orchard", label:{en:"Dashboard",es:"Pantalla principal",de:"Übersicht"}, icon:LayoutDashboard },
]

const seasonItems:NavItem[] = [
  { href:"/orchard/crops/catalog", label:{en:"Crops",es:"Cultivos",de:"Kulturen"}, icon:Sprout, includeChildren:true },
  { href:"/orchard/game-plan/season", label:{en:"Game plan",es:"Plan estratégico",de:"Saisonplan"}, icon:CalendarRange },
  { href:"/orchard/crop-map/overview", label:{en:"Crop map",es:"Mapa de cultivos",de:"Anbaukarte"}, icon:Map, includeChildren:true },
  { href:"/orchard/game-plan/propagation", label:{en:"Seeds & transplants",es:"Semillas y trasplantes",de:"Saatgut & Jungpflanzen"}, icon:FlaskConical },
  { href:"/orchard/nursery/overview", label:{en:"Nursery",es:"Vivero",de:"Anzucht"}, icon:Sprout },
  { href:"/orchard/harvest/desk", label:{en:"Harvests",es:"Cosechas",de:"Ernten"}, icon:Leaf, includeChildren:true },
  { href:"/orchard/work/week-board", label:{en:"Tasks",es:"Tareas",de:"Aufgaben"}, icon:ClipboardList, includeChildren:true },
]

const advancedItems:NavItem[] = [
  { href:"/orchard/crops", label:{en:"Live crop operations",es:"En terreno",de:"Aktive Kulturen"}, icon:Sprout },
  { href:"/orchard/library", label:{en:"Agronomic library",es:"Biblioteca agronómica",de:"Agronomische Bibliothek"}, icon:BookOpen, includeChildren:true },
  { href:"/orchard/care", label:{en:"Care",es:"Cuidados",de:"Pflege"}, icon:Leaf },
  { href:"/orchard/pests", label:{en:"Plant health",es:"Sanidad",de:"Pflanzengesundheit"}, icon:ShieldAlert },
  { href:"/orchard/soil", label:{en:"Soil",es:"Suelo",de:"Boden"}, icon:TestTube2 },
  { href:"/orchard/equipment", label:{en:"Equipment",es:"Equipos",de:"Geräte"}, icon:Hammer },
  { href:"/orchard/performance", label:{en:"Plan vs actual",es:"Plan vs real",de:"Plan vs. Ist"}, icon:ChartNoAxesCombined },
  { href:"/orchard/decisions", label:{en:"Decisions",es:"Decisiones",de:"Entscheidungen"}, icon:ShieldAlert },
  { href:"/orchard/analytics", label:{en:"Data & analytics",es:"Datos y análisis",de:"Daten & Analyse"}, icon:BarChart3 },
]

const copy = {
  en:{farm:"Black Swan Orchard",owner:"Owner · BS",season:"Season",mySeason:"MY SEASON",myFarm:"MY FARM",more:"MORE",logout:"Sign out",loading:"Loading season…",settings:"Settings"},
  es:{farm:"Black Swan Orchard",owner:"Propietario · BS",season:"Temporada",mySeason:"MI TEMPORADA",myFarm:"MI GRANJA",more:"MÁS",logout:"Cerrar sesión",loading:"Cargando temporada…",settings:"Configuración"},
  de:{farm:"Black Swan Orchard",owner:"Eigentümer · BS",season:"Saison",mySeason:"MEINE SAISON",myFarm:"MEIN HOF",more:"MEHR",logout:"Abmelden",loading:"Saison wird geladen…",settings:"Einstellungen"},
} as const

function stripLocale(pathname:string){return pathname.replace(/^\/(en|es|de)(?=\/|$)/,"")||"/"}
function itemActive(pathname:string,item:NavItem){
  if(pathname===item.href)return true
  if(item.href==="/orchard" )return pathname==="/orchard"
  if(item.href==="/orchard/crops/catalog")return pathname.startsWith("/orchard/crops")
  if(item.href==="/orchard/crop-map/overview")return pathname.startsWith("/orchard/crop-map")
  if(item.href==="/orchard/harvest/desk")return pathname.startsWith("/orchard/harvest")
  if(item.href==="/orchard/work/week-board")return pathname.startsWith("/orchard/work")
  return Boolean(item.includeChildren&&pathname.startsWith(`${item.href}/`))
}

export function OrchardSidebar({isOpen=true,onClose}:{isOpen?:boolean;onClose?:()=>void}){
  const pathname = usePathname()||"/"
  const internalPathname = stripLocale(pathname)
  const searchParams = useSearchParams()
  const router = useRouter()
  const {language} = useLanguage()
  const locale:Locale = language
  const text = copy[locale]
  const supabase = useMemo(()=>createClient(),[])
  const [plans,setPlans] = useState<Plan[]>([])
  const [loading,setLoading] = useState(true)
  const [userInitials,setUserInitials] = useState("BS")

  useEffect(()=>{
    let cancelled=false
    void Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,status").order("start_date",{ascending:false}),
      supabase.auth.getUser(),
    ]).then(([planResult,userResult])=>{
      if(cancelled)return
      setPlans((planResult.data??[]) as Plan[])
      const user=userResult.data.user
      const parts=user?.user_metadata?.full_name?.split(" ")??user?.email?.split("@")[0].split(".")??[]
      const initials=parts.slice(0,2).map((part:string)=>part[0]?.toUpperCase()).join("")
      if(initials)setUserInitials(initials)
      setLoading(false)
    })
    return()=>{cancelled=true}
  },[supabase])

  const requested=searchParams.get("game_plan")
  const selected=plans.find(plan=>plan.id===requested)??plans.find(plan=>plan.status==="active")??plans.find(plan=>plan.status==="draft")??plans[0]??null
  const localizedHref=(href:string)=>{
    const params=new URLSearchParams(searchParams.toString())
    if(selected?.id)params.set("game_plan",selected.id)
    const query=params.toString()
    return `/${language}${href}${query?`?${query}`:""}`
  }
  const changePlan=(id:string)=>{
    const params=new URLSearchParams(searchParams.toString())
    params.set("game_plan",id)
    router.push(`${pathname}?${params.toString()}`)
  }
  const logout=async()=>{await supabase.auth.signOut();router.push(`/${language}/auth/login`)}
  const renderItem=(item:NavItem)=>{const Icon=item.icon;const active=itemActive(internalPathname,item);return <Link key={item.href} href={localizedHref(item.href)} onClick={onClose} aria-current={active?"page":undefined} className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",active?"bg-primary/10 font-medium text-primary":"text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4 shrink-0"/><span className="truncate">{item.label[locale]}</span></Link>}

  return <div data-orchard-sidebar className={cn("fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-300 md:relative md:inset-auto md:z-auto md:h-full md:translate-x-0",isOpen?"translate-x-0":"-translate-x-full")}>
    <div className="border-b border-border px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={localizedHref("/orchard")} onClick={onClose} className="flex min-w-0 items-center gap-3">
          <img src="/blackswan-logo.png" alt="Black Swan" className="h-9 w-9 shrink-0 object-contain"/>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{text.farm}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{text.owner}</p></div>
        </Link>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted md:hidden" aria-label="Close"><X className="h-4 w-4"/></button>
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{text.season}</span>
        <select value={selected?.id??""} onChange={event=>changePlan(event.target.value)} disabled={loading||!plans.length} className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary">
          {loading?<option>{text.loading}</option>:plans.map(plan=><option key={plan.id} value={plan.id}>{plan.season??plan.name}</option>)}
        </select>
      </label>
    </div>

    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-1">{topItems.map(renderItem)}</div>
      <div className="my-4 border-t border-border"/>
      <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[.14em] text-muted-foreground">{text.mySeason}</p>
      <div className="space-y-1">{seasonItems.map(renderItem)}</div>
      <div className="my-4 border-t border-border"/>
      <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[.14em] text-muted-foreground">{text.myFarm}</p>
      <details className="group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground marker:content-none [&::-webkit-details-marker]:hidden"><span>{text.more}</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180"/></summary>
        <div className="mt-1 space-y-1 border-l border-border pl-2">{advancedItems.map(renderItem)}</div>
      </details>
      <Link href={localizedHref("/orchard/analytics")} onClick={onClose} className="mt-1 flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Settings className="h-4 w-4"/><span>{text.settings}</span></Link>
    </nav>

    <div className="space-y-3 border-t border-border p-3">
      <LanguageSwitcher/>
      <button type="button" onClick={logout} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{userInitials}</span><span className="flex-1 text-left">{text.logout}</span><LogOut className="h-4 w-4"/></button>
    </div>
  </div>
}

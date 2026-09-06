"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BarChart3, BookOpen, CalendarRange, ChartNoAxesCombined, ChevronDown, ClipboardList, FlaskConical, Hammer, Home, LayoutDashboard, Leaf, LogOut, Map, Settings, ShieldAlert, Sprout, StickyNote, TestTube2, X } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

type Locale = "en" | "es" | "de"
type Plan = { id:string; name:string; season:string|null; status:string }
type NavItem = { href:string; label:Record<Locale,string>; icon:typeof Home; includeChildren?:boolean }
type GroupItem = { href:string; label:Record<Locale,string> }

const topItems:NavItem[] = [
  { href:"/orchard/getting-started", label:{en:"Getting started",es:"Iniciación",de:"Einrichtung"}, icon:Home },
  { href:"/orchard/dashboard", label:{en:"Dashboard",es:"Pantalla principal",de:"Übersicht"}, icon:LayoutDashboard },
]
const seasonItems:NavItem[] = [
  { href:"/orchard/crops/catalog", label:{en:"Crops",es:"Cultivos",de:"Kulturen"}, icon:Sprout, includeChildren:true },
  { href:"/orchard/game-plan/season", label:{en:"Game plan",es:"Plan estratégico",de:"Saisonplan"}, icon:CalendarRange },
  { href:"/orchard/crop-map/overview", label:{en:"Crop map",es:"Mapa de cultivos",de:"Anbaukarte"}, icon:Map, includeChildren:true },
  { href:"/orchard/seed-orders", label:{en:"Seeds & transplants",es:"Semillas y trasplantes",de:"Saatgut & Jungpflanzen"}, icon:FlaskConical },
  { href:"/orchard/nursery/overview", label:{en:"Nursery",es:"Vivero",de:"Anzucht"}, icon:Sprout },
  { href:"/orchard/harvest/season", label:{en:"Harvests",es:"Cosechas",de:"Ernten"}, icon:Leaf, includeChildren:true },
]
const taskItems:GroupItem[] = [
  { href:"/orchard/work/list", label:{en:"List",es:"Lista",de:"Liste"} },
  { href:"/orchard/work/week-board", label:{en:"Week Board",es:"Week Board",de:"Wochenboard"} },
  { href:"/orchard/work/workload-graph", label:{en:"My Workload Graph",es:"Mi gráfico de carga",de:"Meine Arbeitslast"} },
]
const farmItems:NavItem[] = [
  { href:"/orchard/farm-map", label:{en:"Farm map",es:"Mapa de la granja",de:"Hofkarte"}, icon:Map },
  { href:"/orchard/notes", label:{en:"Notes",es:"Notas",de:"Notizen"}, icon:StickyNote },
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
const chartItems:GroupItem[] = [
  { href:"/orchard/charts/direct-seeding", label:{en:"Direct seeding",es:"Siembra directa",de:"Direktsaat"} },
  { href:"/orchard/charts/transplantation", label:{en:"Transplantation",es:"Trasplante",de:"Auspflanzung"} },
  { href:"/orchard/charts/nursery", label:{en:"Nursery",es:"Vivero",de:"Anzucht"} },
  { href:"/orchard/charts/tasks", label:{en:"Tasks",es:"Tareas",de:"Aufgaben"} },
  { href:"/orchard/charts/seeders", label:{en:"Seeders",es:"Sembradoras",de:"Sägeräte"} },
  { href:"/orchard/charts/crop-yield", label:{en:"Crop yield",es:"Rendimiento de cultivos",de:"Kulturertrag"} },
]
const settingsItem:NavItem = {
  href:"/orchard/settings",
  label:{en:"Settings",es:"Configuración",de:"Einstellungen"},
  icon:Settings,
  includeChildren:true,
}
const copy = {
  en:{farm:"Black Swan Orchard",owner:"Owner · BS",season:"Season",mySeason:"MY SEASON",myFarm:"MY FARM",more:"MORE",logout:"Sign out",loading:"Loading season…",charts:"Charts",tasks:"Tasks"},
  es:{farm:"Black Swan Orchard",owner:"Propietario · BS",season:"Temporada",mySeason:"MI TEMPORADA",myFarm:"MI GRANJA",more:"MÁS",logout:"Cerrar sesión",loading:"Cargando temporada…",charts:"Gráficos",tasks:"Tareas"},
  de:{farm:"Black Swan Orchard",owner:"Eigentümer · BS",season:"Saison",mySeason:"MEINE SAISON",myFarm:"MEIN HOF",more:"MEHR",logout:"Abmelden",loading:"Saison wird geladen…",charts:"Diagramme",tasks:"Aufgaben"},
} as const

function stripLocale(pathname:string){return pathname.replace(/^\/(en|es|de)(?=\/|$)/,"")||"/"}
function itemActive(pathname:string,item:NavItem){
  if(pathname===item.href)return true
  if(item.href==="/orchard/dashboard")return pathname==="/orchard/dashboard"
  if(item.href==="/orchard/crops/catalog")return pathname.startsWith("/orchard/crops")
  if(item.href==="/orchard/crop-map/overview")return pathname.startsWith("/orchard/crop-map")
  if(item.href==="/orchard/harvest/season")return pathname.startsWith("/orchard/harvest")
  return Boolean(item.includeChildren&&pathname.startsWith(`${item.href}/`))
}

export function OrchardSidebar({isOpen=true,onClose}:{isOpen?:boolean;onClose?:()=>void}){
  const pathname=usePathname()||"/"; const internalPathname=stripLocale(pathname); const searchParams=useSearchParams(); const router=useRouter(); const {language}=useLanguage(); const locale:Locale=language; const text=copy[locale]; const supabase=useMemo(()=>createClient(),[])
  const [plans,setPlans]=useState<Plan[]>([]); const [loading,setLoading]=useState(true); const [userInitials,setUserInitials]=useState("BS")
  useEffect(()=>{let cancelled=false;void Promise.all([supabase.from("orchard_game_plans").select("id,name,season,status").order("start_date",{ascending:false}),supabase.auth.getUser()]).then(([planResult,userResult])=>{if(cancelled)return;setPlans((planResult.data??[]) as Plan[]);const user=userResult.data.user;const parts=user?.user_metadata?.full_name?.split(" ")??user?.email?.split("@")[0].split(".")??[];const initials=parts.slice(0,2).map((part:string)=>part[0]?.toUpperCase()).join("");if(initials)setUserInitials(initials);setLoading(false)});return()=>{cancelled=true}},[supabase])
  const requested=searchParams.get("game_plan"); const selected=plans.find(plan=>plan.id===requested)??plans.find(plan=>plan.status==="active")??plans.find(plan=>plan.status==="draft")??plans[0]??null
  const localizedHref=(href:string)=>{const params=new URLSearchParams(searchParams.toString());params.delete("tab");if(selected?.id)params.set("game_plan",selected.id);const query=params.toString();return `/${language}${href}${query?`?${query}`:""}`}
  const changePlan=(id:string)=>{const params=new URLSearchParams(searchParams.toString());params.set("game_plan",id);router.push(`${pathname}?${params.toString()}`)}
  const logout=async()=>{await supabase.auth.signOut();router.push(`/${language}/auth/login`)}
  const renderItem=(item:NavItem)=>{const Icon=item.icon;const active=itemActive(internalPathname,item);return <Link key={item.href} href={localizedHref(item.href)} onClick={onClose} aria-current={active?"page":undefined} className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] transition-colors",active?"bg-[#14382d] font-medium text-[#9bd8b8]":"text-[#c2bbb0] hover:bg-[#24231f] hover:text-[#f1eee7]")}><Icon className="h-4 w-4 shrink-0"/><span className="truncate">{item.label[locale]}</span></Link>}
  const renderGroup=(label:string,Icon:typeof Home,items:GroupItem[],open:boolean)=> <details className="group mt-0.5" open={open||undefined}><summary className={cn("flex min-h-10 cursor-pointer list-none items-center gap-3 rounded-md px-3 text-[13px] text-[#c2bbb0] hover:bg-[#24231f] hover:text-[#f1eee7] marker:content-none [&::-webkit-details-marker]:hidden",open&&"text-[#f1eee7]")}><Icon className="h-4 w-4 shrink-0"/><span className="flex-1">{label}</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180"/></summary><div className="space-y-0.5 py-0.5">{items.map(item=>{const active=internalPathname===item.href;return <Link key={item.href} href={localizedHref(item.href)} onClick={onClose} aria-current={active?"page":undefined} className={cn("flex min-h-9 items-center gap-3 rounded-md pl-5 pr-3 text-[13px] transition-colors",active?"bg-[#14382d] text-[#9bd8b8]":"text-[#c2bbb0] hover:bg-[#24231f] hover:text-[#f1eee7]")}><span className="ml-1 h-1 w-1 shrink-0 rounded-full bg-current opacity-60"/><span>{item.label[locale]}</span></Link>})}</div></details>
  const ownerRole=text.owner.split(" · ")[0]

  return <div data-orchard-sidebar className={cn("fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-[#302e29] bg-[#11110f] text-[#f1eee7] transition-transform duration-300 md:relative md:inset-auto md:z-auto md:h-full md:translate-x-0",isOpen?"translate-x-0":"-translate-x-full")}>
    <div className="border-b border-[#302e29] px-3 pb-3 pt-4">
      <div className="flex items-center justify-between gap-2 px-1"><Link href={localizedHref("/orchard/dashboard")} onClick={onClose} className="flex min-w-0 items-center gap-2.5 text-[#9bd8b8] hover:text-[#bde1cf]"><img src="/blackswan-logo.png" alt="Black Swan" className="h-7 w-7 shrink-0 object-contain"/><span className="truncate text-[15px] font-semibold tracking-[-0.02em]">{text.farm}</span></Link><button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#24231f] md:hidden" aria-label="Close"><X className="h-4 w-4"/></button></div>
      <Link href={localizedHref("/orchard/dashboard")} onClick={onClose} className="mt-3 flex min-w-0 items-center gap-3 rounded-md bg-[#24231f] px-3 py-2.5 transition-colors hover:bg-[#2a2924]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#174335] text-[11px] font-semibold text-[#bde1cf]">BS</span><div className="min-w-0 flex-1"><p className="text-[10px] text-[#918b82]">{ownerRole}</p><p className="mt-0.5 truncate text-[13px] font-medium text-[#f1eee7]">BS</p></div></Link>
      <label className="mt-3 block md:hidden"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[#918b82]">{text.season}</span><select value={selected?.id??""} onChange={event=>changePlan(event.target.value)} disabled={loading||!plans.length} className="h-10 w-full rounded-md border border-[#3a3731] bg-[#1a1917] px-2.5 text-xs text-[#f1eee7] outline-none focus:border-[#8bcba8]">{loading?<option>{text.loading}</option>:plans.map(plan=><option key={plan.id} value={plan.id}>{plan.season??plan.name}</option>)}</select></label>
    </div>
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className="space-y-0.5">{topItems.map(renderItem)}</div><div className="my-3 border-t border-[#302e29]"/><p className="px-3 pb-1.5 text-[9px] font-semibold tracking-[.15em] text-[#777169]">{text.mySeason}</p><div className="space-y-0.5">{seasonItems.map(renderItem)}{renderGroup(text.tasks,ClipboardList,taskItems,internalPathname.startsWith("/orchard/work"))}</div><div className="my-3 border-t border-[#302e29]"/><p className="px-3 pb-1.5 text-[9px] font-semibold tracking-[.15em] text-[#777169]">{text.myFarm}</p><div className="space-y-0.5">{farmItems.map(renderItem)}</div>
      {renderGroup(text.charts,BarChart3,chartItems,internalPathname.startsWith("/orchard/charts"))}
      {renderItem(settingsItem)}
      <details className="group mt-0.5"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md px-3 text-[13px] text-[#c2bbb0] hover:bg-[#24231f] hover:text-[#f1eee7] marker:content-none [&::-webkit-details-marker]:hidden"><span>{text.more}</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180"/></summary><div className="mt-0.5 space-y-0.5 border-l border-[#302e29] pl-2">{advancedItems.map(renderItem)}</div></details>
    </nav>
    <div className="space-y-2 border-t border-[#302e29] p-3"><LanguageSwitcher/><button type="button" onClick={logout} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-[13px] text-[#c2bbb0] hover:bg-[#24231f] hover:text-[#f1eee7]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#174335] text-[11px] font-semibold text-[#bde1cf]">{userInitials}</span><span className="flex-1 text-left">{text.logout}</span><LogOut className="h-4 w-4"/></button></div>
  </div>
}

"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Bug,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  ChevronDown,
  FileText,
  Hammer,
  LayoutDashboard,
  Leaf,
  Map,
  ShieldAlert,
  Sprout,
  TestTube2,
} from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"
import { OrchardAiDock } from "@/components/orchard/orchard-ai-dock"

type OrchardLocale = "en" | "es" | "de"
type NavItem = { href: string; label: Record<OrchardLocale, string>; icon: typeof LayoutDashboard; includeChildren?: boolean }

const primaryItems: NavItem[] = [
  { href: "/orchard", label: { en: "Today", es: "Hoy", de: "Heute" }, icon: LayoutDashboard },
  { href: "/orchard/game-plan/season", label: { en: "Calendar", es: "Calendario", de: "Kalender" }, icon: CalendarRange },
  { href: "/orchard/crop-map/overview", label: { en: "Crop Map", es: "Crop Map", de: "Crop Map" }, icon: Map, includeChildren: true },
  { href: "/orchard/nursery/overview", label: { en: "Nursery", es: "Almácigo", de: "Anzucht" }, icon: Sprout, includeChildren: true },
  { href: "/orchard/work/week-board", label: { en: "Tasks", es: "Tareas", de: "Aufgaben" }, icon: CalendarDays, includeChildren: true },
  { href: "/orchard/harvest/desk", label: { en: "Harvest", es: "Cosecha", de: "Ernte" }, icon: Leaf, includeChildren: true },
  { href: "/orchard/crops", label: { en: "Crops", es: "Cultivos", de: "Kulturen" }, icon: Sprout, includeChildren: true },
]

const moreItems: NavItem[] = [
  { href: "/orchard/game-plan/overview", label: { en: "Game Plan", es: "Game Plan", de: "Game Plan" }, icon: CalendarRange, includeChildren: true },
  { href: "/orchard/field", label: { en: "Field", es: "Campo", de: "Feld" }, icon: Map, includeChildren: true },
  { href: "/orchard/care", label: { en: "Care", es: "Cuidados", de: "Pflege" }, icon: Activity },
  { href: "/orchard/pests", label: { en: "Health", es: "Sanidad", de: "Gesundheit" }, icon: Bug },
  { href: "/orchard/soil", label: { en: "Soil", es: "Suelo", de: "Boden" }, icon: TestTube2 },
  { href: "/orchard/equipment", label: { en: "Equipment", es: "Equipos", de: "Geräte" }, icon: Hammer },
  { href: "/orchard/performance", label: { en: "Plan vs Actual", es: "Plan vs Real", de: "Plan vs. Ist" }, icon: ChartNoAxesCombined },
  { href: "/orchard/decisions", label: { en: "Decisions", es: "Decisiones", de: "Entscheidungen" }, icon: ShieldAlert },
  { href: "/orchard/analytics", label: { en: "Analytics", es: "Análisis", de: "Analyse" }, icon: BarChart3 },
  { href: "/orchard/library", label: { en: "Crop Library", es: "Biblioteca", de: "Bibliothek" }, icon: BookOpen, includeChildren: true },
  { href: "/orchard/reports", label: { en: "Reports", es: "Reportes", de: "Berichte" }, icon: FileText },
  { href: "/orchard/assistant", label: { en: "Orchard AI", es: "IA Orchard", de: "Orchard AI" }, icon: Bot },
]

const ORCHARD_BRAND_CSS = `
body:has([data-orchard-navigation]) {
  --orchard-nav-height: 58px;
  --orchard-green: #1f624d;
  --orchard-green-soft: #e7f0eb;
  --orchard-ink: #2f332f;
  --orchard-muted: #727872;
  --orchard-line: #dfe4df;
  --orchard-canvas: #f7f8f6;
  --orchard-radius: 12px;
  --orchard-radius-sm: 9px;
  --bs-bg-primary: var(--orchard-canvas);
  --bs-surface-primary: #ffffff;
  --bs-surface-secondary: #f1f4f1;
  --bs-surface-tertiary: #e7ece8;
  --bs-text-primary: var(--orchard-ink);
  --bs-text-secondary: var(--orchard-muted);
  --bs-divider-subtle: var(--orchard-line);
  --bs-cool-sage: var(--orchard-green);
  background: var(--orchard-canvas);
  color: var(--orchard-ink);
}
body:has([data-orchard-navigation]) [data-orchard-navigation] {
  background: rgba(255,255,255,.97) !important;
  border-color: var(--orchard-line) !important;
  color: var(--orchard-ink);
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
body:has([data-orchard-navigation]) main {
  background: var(--orchard-canvas);
  color: var(--orchard-ink);
  font-family: var(--bs-font-body);
}
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) { display:flex; flex-direction:column; }
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) > [data-orchard-navigation] { order:0; }
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) > [data-slot="page-header"] { order:1; }
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) > :not([data-orchard-navigation]):not([data-slot="page-header"]) { order:2; }
body:has([data-orchard-navigation]) main h1,
body:has([data-orchard-navigation]) main h2,
body:has([data-orchard-navigation]) main h3,
body:has([data-orchard-navigation]) main h4,
body:has([data-orchard-navigation]) main h5,
body:has([data-orchard-navigation]) main h6 {
  font-family: var(--bs-font-heading) !important;
  font-weight: 500 !important;
  color: var(--orchard-ink) !important;
}
body:has([data-orchard-navigation]) main h1 { font-size:clamp(30px,3vw,48px)!important; line-height:1.06!important; letter-spacing:-.035em!important; }
body:has([data-orchard-navigation]) main h2 { font-size:clamp(24px,2.2vw,34px)!important; letter-spacing:-.025em!important; }
body:has([data-orchard-navigation]) main [data-slot="card"],
body:has([data-orchard-navigation]) [data-slot="dialog-content"] {
  background: #fff !important;
  border: 1px solid var(--orchard-line) !important;
  border-radius: var(--orchard-radius) !important;
  box-shadow: 0 2px 5px rgba(39,55,45,.06) !important;
  overflow: hidden;
}
body:has([data-orchard-navigation]) main button,
body:has([data-orchard-navigation]) main [role="button"],
body:has([data-orchard-navigation]) main [data-slot="button"] { min-height:42px; border-radius:8px!important; box-shadow:none!important; }
body:has([data-orchard-navigation]) main input,
body:has([data-orchard-navigation]) main textarea,
body:has([data-orchard-navigation]) main select,
body:has([data-orchard-navigation]) main [data-slot="input"],
body:has([data-orchard-navigation]) main [data-slot="textarea"],
body:has([data-orchard-navigation]) main [data-slot="select-trigger"] {
  min-height:42px;
  background:#fff!important;
  color:var(--orchard-ink)!important;
  border:1px solid #ccd3cd!important;
  border-radius:var(--orchard-radius-sm)!important;
  box-shadow:none!important;
}
body:has([data-orchard-navigation]) main table { border-collapse:separate; border-spacing:0; background:#fff; border:1px solid var(--orchard-line); border-radius:12px; overflow:hidden; }
body:has([data-orchard-navigation]) main th { color:#626862!important; font-weight:500; background:#f4f6f3; }
body:has([data-orchard-navigation]) main td { color:var(--orchard-ink); border-color:#edf0ed!important; }
body:has([data-orchard-navigation]) main .text-muted-foreground,
body:has([data-orchard-navigation]) main [data-slot="card-description"] { color:var(--orchard-muted)!important; }
body:has([data-orchard-navigation]) main :focus-visible,
body:has([data-orchard-navigation]) [data-orchard-navigation] :focus-visible { outline:2px solid var(--orchard-green)!important; outline-offset:2px; }
body:has([data-orchard-navigation]) main [class*="border-dashed"] { border-color:#cdd4cd!important; }
body:has([data-orchard-navigation]) main [class*="bg-card"] { background-color:#fff!important; }
body:has([data-orchard-navigation]) main [class*="transition"] { transition-duration:180ms; }
@media (hover:hover) {
  body:has([data-orchard-navigation]) main [data-slot="card"]:hover { border-color:#b8cabe!important; box-shadow:0 5px 16px rgba(39,55,45,.08)!important; }
}
@media (max-width:639px) {
  body:has([data-orchard-navigation]) [data-orchard-navigation] { padding-left:8px!important; padding-right:8px!important; }
  body:has([data-orchard-navigation]) [data-orchard-navigation] a,
  body:has([data-orchard-navigation]) [data-orchard-navigation] summary { min-height:44px; }
  body:has([data-orchard-navigation]) { --orchard-radius:14px; --orchard-radius-sm:10px; }
}
`

function internalPath(pathname: string) { return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/" }
function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true
  if (!item.includeChildren) return false
  if (item.href === "/orchard/crop-map/overview") return pathname.startsWith("/orchard/crop-map")
  if (item.href === "/orchard/nursery/overview") return pathname.startsWith("/orchard/nursery")
  if (item.href === "/orchard/work/week-board") return pathname.startsWith("/orchard/work")
  if (item.href === "/orchard/harvest/desk") return pathname.startsWith("/orchard/harvest")
  return pathname.startsWith(`${item.href}/`)
}

export function OrchardNavigation() {
  const pathname = internalPath(usePathname() || "/")
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const locale: OrchardLocale = language
  const navAria: Record<OrchardLocale, string> = { en: "Orchard navigation", es: "Navegación del huerto", de: "Orchard-Navigation" }
  const moreLabel: Record<OrchardLocale, string> = { en: "More", es: "Más", de: "Mehr" }
  const gamePlanId = searchParams.get("game_plan")
  const scopedHref = (href: string) => {
    const base = `/${language}${href}`
    if (!gamePlanId) return base
    return `${base}${base.includes("?") ? "&" : "?"}game_plan=${encodeURIComponent(gamePlanId)}`
  }
  const moreActive = moreItems.some((item) => isActive(pathname, item))
  const renderLink = (item: NavItem) => {
    const active = isActive(pathname, item)
    const Icon = item.icon
    return <Link key={item.href} href={scopedHref(item.href)} aria-label={item.label[locale]} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none", active ? "border-[#1f624d] text-[#1f624d]" : "border-transparent text-[#687069] hover:text-[#27342c]")}><Icon className="h-4 w-4" aria-hidden="true"/><span>{item.label[locale]}</span></Link>
  }
  const assistantHidden = pathname === "/orchard/assistant"

  return <>
    <style>{ORCHARD_BRAND_CSS}</style>
    <nav data-orchard-navigation aria-label={navAria[locale]} className="sticky top-0 z-[70] border-b px-3 md:px-8">
      <div className="mx-auto flex min-h-[58px] w-full max-w-[1560px] items-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {primaryItems.map(renderLink)}
        <details className="group relative z-[80] ml-1 shrink-0">
          <summary aria-label={moreLabel[locale]} className={cn("flex min-h-10 cursor-pointer list-none items-center gap-2 border-b-2 px-3 text-sm font-medium marker:content-none focus-visible:outline-none [&::-webkit-details-marker]:hidden", moreActive ? "border-[#1f624d] text-[#1f624d]" : "border-transparent text-[#687069] hover:text-[#27342c]")}><span>{moreLabel[locale]}</span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180"/></summary>
          <div className="fixed left-2 right-2 top-[64px] z-[90] max-h-[calc(100dvh-76px)] overflow-y-auto rounded-xl border border-[#dfe4df] bg-white/98 p-2 text-[#2f332f] shadow-xl backdrop-blur-xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[min(70vh,620px)] sm:w-72">
            <div className="grid gap-1">{moreItems.map((item) => { const active = isActive(pathname, item); const Icon = item.icon; return <Link key={item.href} href={scopedHref(item.href)} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "bg-[#e6f0ea] text-[#1f624d]" : "text-[#626a63] hover:bg-[#f1f4f1] hover:text-[#27342c]")}><Icon className="h-4 w-4 shrink-0"/><span>{item.label[locale]}</span></Link> })}</div>
          </div>
        </details>
      </div>
    </nav>
    <OrchardAiDock hidden={assistantHidden}/>
  </>
}

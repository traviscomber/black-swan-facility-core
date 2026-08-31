"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Bot,
  Bug,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  ChartSpline,
  ChevronDown,
  Database,
  FileText,
  GitBranch,
  Hammer,
  History,
  LayoutDashboard,
  Leaf,
  Map,
  Route,
  ShieldAlert,
  Smartphone,
  Sprout,
  Target,
  TestTube2,
  UtensilsCrossed,
  WandSparkles,
} from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

type OrchardLocale = "en" | "es" | "de"
type NavItem = {
  href: string
  label: Record<OrchardLocale, string>
  icon: typeof LayoutDashboard
  includeChildren?: boolean
}

const primaryItems: NavItem[] = [
  { href: "/orchard", label: { en: "Today", es: "Hoy", de: "Heute" }, icon: LayoutDashboard },
  { href: "/orchard/field", label: { en: "Field", es: "Campo", de: "Feld" }, icon: Smartphone, includeChildren: true },
  { href: "/orchard/harvest/desk", label: { en: "Harvest", es: "Cosecha", de: "Ernte" }, icon: Leaf },
  { href: "/orchard/season-summary", label: { en: "History", es: "Historial", de: "Verlauf" }, icon: History },
]

const gamePlanItems: NavItem[] = [
  { href: "/orchard/game-plan/overview", label: { en: "Game Plan home", es: "Inicio Game Plan", de: "Game-Plan-Start" }, icon: CalendarRange },
  { href: "/orchard/game-plan/objectives", label: { en: "Objectives", es: "Objetivos", de: "Ziele" }, icon: Target },
  { href: "/orchard/game-plan/season", label: { en: "Season plan", es: "Plan de temporada", de: "Saisonplan" }, icon: CalendarRange },
  { href: "/orchard/game-plan/crop-chart", label: { en: "Crop Chart", es: "Crop Chart", de: "Crop Chart" }, icon: BookOpen },
  { href: "/orchard/game-plan/propagation", label: { en: "Sowing & nursery", es: "Siembra y almácigo", de: "Aussaat & Anzucht" }, icon: Sprout },
  { href: "/orchard/game-plan/tasks", label: { en: "Calendar & tasks", es: "Calendario y tareas", de: "Kalender & Aufgaben" }, icon: CalendarDays },
  { href: "/orchard/game-plan/capacity", label: { en: "Beds & capacity", es: "Camas y capacidad", de: "Beete & Kapazität" }, icon: Map },
  { href: "/orchard/game-plan/forecast", label: { en: "Production forecast", es: "Forecast de producción", de: "Produktionsprognose" }, icon: ChartNoAxesCombined },
]

const advancedItems: NavItem[] = [
  { href: "/orchard/game-plan", label: { en: "Game Plan editor", es: "Editor Game Plan", de: "Game-Plan-Editor" }, icon: CalendarRange },
  { href: "/orchard/assistant", label: { en: "Orchard AI", es: "IA Orchard", de: "Orchard AI" }, icon: Bot },
  { href: "/orchard/demand", label: { en: "Food Demand", es: "Demanda", de: "Lebensmittelbedarf" }, icon: UtensilsCrossed },
  { href: "/orchard/library", label: { en: "Agronomic library", es: "Biblioteca agronómica", de: "Anbaubibliothek" }, icon: BookOpen },
  { href: "/orchard/library/fao", label: { en: "FAO Catalog", es: "Catálogo FAO", de: "FAO-Katalog" }, icon: Database },
  { href: "/orchard/nursery", label: { en: "Seed & nursery management", es: "Gestión de semillas", de: "Saatgutverwaltung" }, icon: Sprout },
  { href: "/orchard/work", label: { en: "Accountable work", es: "Trabajo responsable", de: "Verbindliche Arbeit" }, icon: CalendarDays },
  { href: "/orchard/harvest", label: { en: "Harvest management", es: "Gestión de cosecha", de: "Ernteverwaltung" }, icon: Leaf },
  { href: "/orchard/crop-map", label: { en: "Crop map workspace", es: "Workspace de mapa", de: "Karten-Arbeitsbereich" }, icon: Map },
  { href: "/orchard/crop-map/auto-place", label: { en: "Auto-place", es: "Auto-ubicar", de: "Auto-Platzierung" }, icon: WandSparkles },
  { href: "/orchard/crops", label: { en: "Crops", es: "Cultivos", de: "Kulturen" }, icon: Sprout },
  { href: "/orchard/lifecycle", label: { en: "Lifecycle", es: "Ciclo", de: "Lebenszyklus" }, icon: GitBranch },
  { href: "/orchard/care", label: { en: "Care", es: "Cuidados", de: "Pflege" }, icon: Activity },
  { href: "/orchard/pests", label: { en: "Health", es: "Sanidad", de: "Gesundheit" }, icon: Bug },
  { href: "/orchard/soil", label: { en: "Soil", es: "Suelo", de: "Boden" }, icon: TestTube2 },
  { href: "/orchard/equipment", label: { en: "Equipment", es: "Equipos", de: "Geräte" }, icon: Hammer },
  { href: "/orchard/mobile", label: { en: "Mobile App", es: "App móvil", de: "Mobile App" }, icon: Smartphone },
  { href: "/orchard/commercial", label: { en: "Commercial", es: "Comercial", de: "Vermarktung" }, icon: BadgeDollarSign },
  { href: "/orchard/performance", label: { en: "Plan vs Actual", es: "Plan vs Real", de: "Plan vs. Ist" }, icon: ChartNoAxesCombined },
  { href: "/orchard/decisions", label: { en: "Decisions", es: "Decisiones", de: "Entscheidungen" }, icon: ShieldAlert },
  { href: "/orchard/charts", label: { en: "Custom Charts", es: "Gráficos", de: "Eigene Diagramme" }, icon: ChartSpline },
  { href: "/orchard/analytics", label: { en: "Insights", es: "Análisis", de: "Einblicke" }, icon: BarChart3 },
  { href: "/orchard/traceability", label: { en: "Traceability", es: "Trazabilidad", de: "Rückverfolgbarkeit" }, icon: Route },
  { href: "/orchard/reports", label: { en: "Reports", es: "Reportes", de: "Berichte" }, icon: FileText },
]

const ORCHARD_BRAND_CSS = `
body:has([data-orchard-navigation]) {
  --orchard-nav-height: 56px;
  background: var(--bs-bg-primary);
  color: var(--bs-text-primary);
}
body:has([data-orchard-navigation]) [data-orchard-navigation] {
  background: var(--bs-bg-secondary) !important;
  border-color: var(--bs-divider-subtle) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
body:has([data-orchard-navigation]) main {
  background: var(--bs-bg-primary);
  color: var(--bs-text-primary);
  font-family: var(--bs-font-body);
}
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) {
  display: flex;
  flex-direction: column;
}
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) > [data-orchard-navigation] { order: 0; }
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) > [data-slot="page-header"] { order: 1; }
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) > :not([data-orchard-navigation]):not([data-slot="page-header"]) { order: 2; }
body:has([data-orchard-navigation]) main:has(> [data-orchard-navigation]) > div:not([data-slot]):not([class*="fixed"]) {
  width: 100%;
  max-width: 1560px;
  margin-left: auto;
  margin-right: auto;
}
body:has([data-orchard-navigation]) main h1,
body:has([data-orchard-navigation]) main h2,
body:has([data-orchard-navigation]) main h3,
body:has([data-orchard-navigation]) main h4,
body:has([data-orchard-navigation]) main h5,
body:has([data-orchard-navigation]) main h6 {
  font-family: var(--bs-font-heading) !important;
  font-weight: 400 !important;
  color: var(--bs-text-primary) !important;
}
body:has([data-orchard-navigation]) main h1 {
  font-size: clamp(28px, 2.8vw, 40px) !important;
  line-height: 1.08 !important;
  letter-spacing: -0.015em !important;
}
body:has([data-orchard-navigation]) main h2 { font-size: clamp(22px, 2vw, 30px) !important; }
body:has([data-orchard-navigation]) main [class*="rounded"],
body:has([data-orchard-navigation]) [data-slot="dialog-content"],
body:has([data-orchard-navigation]) [data-slot="dropdown-menu-content"],
body:has([data-orchard-navigation]) [data-slot="popover-content"] { border-radius: 0 !important; }
body:has([data-orchard-navigation]) main [class*="shadow"],
body:has([data-orchard-navigation]) [data-slot="dialog-content"],
body:has([data-orchard-navigation]) [data-slot="dropdown-menu-content"] { box-shadow: none !important; }
body:has([data-orchard-navigation]) main [class*="backdrop-blur"] {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
body:has([data-orchard-navigation]) main [class*="bg-gradient"] {
  background-image: none !important;
  background-color: var(--bs-overlay) !important;
}
body:has([data-orchard-navigation]) main [data-slot="card"],
body:has([data-orchard-navigation]) [data-slot="dialog-content"] {
  background: var(--bs-surface-primary) !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
body:has([data-orchard-navigation]) main [data-slot="card"] [data-slot="card"] { background: var(--bs-surface-secondary) !important; }
body:has([data-orchard-navigation]) main button,
body:has([data-orchard-navigation]) main [role="button"],
body:has([data-orchard-navigation]) main [data-slot="button"] {
  min-height: 40px;
  border-radius: 0 !important;
  box-shadow: none !important;
}
body:has([data-orchard-navigation]) main input,
body:has([data-orchard-navigation]) main textarea,
body:has([data-orchard-navigation]) main select,
body:has([data-orchard-navigation]) main [data-slot="input"],
body:has([data-orchard-navigation]) main [data-slot="textarea"],
body:has([data-orchard-navigation]) main [data-slot="select-trigger"] {
  min-height: 40px;
  background: var(--bs-surface-secondary) !important;
  color: var(--bs-text-primary) !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
body:has([data-orchard-navigation]) main label,
body:has([data-orchard-navigation]) main [data-slot="label"] { color: var(--bs-text-secondary) !important; font-weight: 500; }
body:has([data-orchard-navigation]) main [data-slot="badge"] { border-radius: 0 !important; box-shadow: none !important; }
body:has([data-orchard-navigation]) main table { border-collapse: collapse; background: var(--bs-surface-primary); }
body:has([data-orchard-navigation]) main th { color: var(--bs-text-secondary) !important; font-weight: 500; background: var(--bs-bg-secondary); }
body:has([data-orchard-navigation]) main td { color: var(--bs-text-primary); }
body:has([data-orchard-navigation]) main tbody tr:nth-child(even) { background: rgba(57, 52, 45, 0.34); }
body:has([data-orchard-navigation]) main [class*="bg-white"],
body:has([data-orchard-navigation]) main [class*="bg-gray-50"],
body:has([data-orchard-navigation]) main [class*="bg-slate-50"],
body:has([data-orchard-navigation]) main [class*="bg-zinc-50"] { background-color: var(--bs-surface-primary) !important; }
body:has([data-orchard-navigation]) main button[class*="bg-white"] { background-color: var(--bs-cool-sage) !important; color: var(--bs-bg-primary) !important; }
body:has([data-orchard-navigation]) main [class*="text-black"] { color: var(--bs-text-primary) !important; }
body:has([data-orchard-navigation]) main button[class*="text-black"] { color: var(--bs-bg-primary) !important; }
body:has([data-orchard-navigation]) main [class*="bg-blue-"],
body:has([data-orchard-navigation]) main [class*="bg-cyan-"] { background-color: rgba(70, 121, 174, 0.28) !important; color: var(--bs-text-primary) !important; }
body:has([data-orchard-navigation]) main [class*="bg-emerald-"],
body:has([data-orchard-navigation]) main [class*="bg-green-"] { background-color: rgba(139, 203, 168, 0.20) !important; color: var(--bs-text-primary) !important; }
body:has([data-orchard-navigation]) main [class*="bg-amber-"],
body:has([data-orchard-navigation]) main [class*="bg-yellow-"] { background-color: rgba(253, 211, 44, 0.18) !important; color: var(--bs-text-primary) !important; }
body:has([data-orchard-navigation]) main [class*="bg-orange-"] { background-color: rgba(214, 105, 66, 0.22) !important; color: var(--bs-text-primary) !important; }
body:has([data-orchard-navigation]) main [class*="bg-red-"],
body:has([data-orchard-navigation]) main [class*="bg-rose-"] { background-color: rgba(236, 43, 2, 0.18) !important; color: var(--bs-text-primary) !important; }
body:has([data-orchard-navigation]) main .text-muted-foreground,
body:has([data-orchard-navigation]) main [data-slot="card-description"] { color: var(--bs-text-secondary) !important; }
body:has([data-orchard-navigation]) main [id^="entity-"],
body:has([data-orchard-navigation]) main [id^="task-"] { scroll-margin-top: calc(var(--orchard-nav-height) + 24px); }
body:has([data-orchard-navigation]) main :focus-visible,
body:has([data-orchard-navigation]) [data-orchard-navigation] :focus-visible {
  outline: 2px solid var(--bs-cool-sky) !important;
  outline-offset: 2px;
}
@media (min-width: 1280px) {
  body:has([data-orchard-navigation]) main [class*="xl:sticky"][class*="xl:top-24"] {
    top: calc(var(--orchard-nav-height) + 24px) !important;
  }
}
@media (max-width: 639px) {
  body:has([data-orchard-navigation]) [data-orchard-navigation] { padding-left: 8px !important; padding-right: 8px !important; }
  body:has([data-orchard-navigation]) [data-orchard-navigation] a,
  body:has([data-orchard-navigation]) [data-orchard-navigation] summary { min-height: 44px; }
  body:has([data-orchard-navigation]) main [data-slot="page-header"] { padding-left: 16px; padding-right: 16px; }
}
`

function internalPath(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true
  return Boolean(item.includeChildren && pathname.startsWith(`${item.href}/`))
}

export function OrchardNavigation() {
  const pathname = internalPath(usePathname() || "/")
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const locale: OrchardLocale = language
  const navAria: Record<OrchardLocale, string> = { en: "Orchard navigation", es: "Navegación del huerto", de: "Orchard-Navigation" }
  const gamePlanLabel: Record<OrchardLocale, string> = { en: "Game Plan", es: "Game Plan", de: "Game Plan" }
  const moreLabel: Record<OrchardLocale, string> = { en: "More", es: "Más", de: "Mehr" }
  const gamePlanId = searchParams.get("game_plan")
  const scopedHref = (href: string) => {
    const base = `/${language}${href}`
    if (!gamePlanId) return base
    const separator = base.includes("?") ? "&" : "?"
    return `${base}${separator}game_plan=${encodeURIComponent(gamePlanId)}`
  }
  const gamePlanActive = gamePlanItems.some(item => isActive(pathname, item))
  const advancedActive = advancedItems.some(item => isActive(pathname, item))

  const renderLink = (item: NavItem) => {
    const active = isActive(pathname, item)
    const Icon = item.icon
    return <Link key={item.href} href={scopedHref(item.href)} aria-label={item.label[locale]} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none",active?"bg-[var(--bs-cool-river)] text-[var(--bs-text-primary)]":"text-muted-foreground hover:bg-[var(--bs-surface-secondary)] hover:text-foreground")}><Icon className="h-4 w-4" aria-hidden="true"/><span>{item.label[locale]}</span></Link>
  }

  return (
    <>
      <style>{ORCHARD_BRAND_CSS}</style>
      <nav data-orchard-navigation aria-label={navAria[locale]} className="sticky top-0 z-[70] border-b border-border bg-background px-3 md:px-8">
        <div className="mx-auto flex min-h-14 w-full max-w-[1560px] items-center gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {renderLink(primaryItems[0])}

          <details className="group relative z-[80] shrink-0">
            <summary aria-label={gamePlanLabel[locale]} className={cn("flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium transition-colors marker:content-none focus-visible:outline-none [&::-webkit-details-marker]:hidden",gamePlanActive?"bg-[var(--bs-cool-river)] text-[var(--bs-text-primary)]":"text-muted-foreground hover:bg-[var(--bs-surface-secondary)] hover:text-foreground")}>
              <CalendarRange className="h-4 w-4" aria-hidden="true"/><span>{gamePlanLabel[locale]}</span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true"/>
            </summary>
            <div className="fixed left-2 right-2 top-[60px] z-[90] max-h-[calc(100dvh-72px)] overflow-y-auto border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-elevated)] p-2 text-popover-foreground sm:absolute sm:left-0 sm:right-auto sm:top-auto sm:mt-2 sm:max-h-[min(70vh,560px)] sm:w-80">
              <div className="mb-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{gamePlanLabel[locale]}</div>
              <div className="grid gap-1">{gamePlanItems.map(item=>{const active=isActive(pathname,item);const Icon=item.icon;return <Link key={item.href} href={scopedHref(item.href)} aria-current={active?"page":undefined} className={cn("flex min-h-11 items-center gap-3 px-3 text-sm transition-colors",active?"bg-[var(--bs-cool-river)] text-[var(--bs-text-primary)]":"hover:bg-[var(--bs-surface-hover)]")}><Icon className="h-4 w-4 shrink-0" aria-hidden="true"/><span>{item.label[locale]}</span></Link>})}</div>
            </div>
          </details>

          {primaryItems.slice(1).map(renderLink)}

          <div className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

          <details className="group relative z-[80] shrink-0">
            <summary aria-label={moreLabel[locale]} className={cn("flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium transition-colors marker:content-none focus-visible:outline-none [&::-webkit-details-marker]:hidden",advancedActive?"bg-[var(--bs-surface-elevated)] text-foreground":"text-muted-foreground hover:bg-[var(--bs-surface-secondary)] hover:text-foreground")}>
              <Activity className="h-4 w-4" aria-hidden="true"/><span>{moreLabel[locale]}</span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true"/>
            </summary>
            <div className="fixed left-2 right-2 top-[60px] z-[90] max-h-[calc(100dvh-72px)] overflow-y-auto border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-elevated)] p-2 text-popover-foreground sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[min(70vh,620px)] sm:w-80">
              <div className="mb-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{moreLabel[locale]}</div>
              <div className="grid gap-1">{advancedItems.map(item=>{const active=isActive(pathname,item);const Icon=item.icon;return <Link key={item.href} href={scopedHref(item.href)} aria-current={active?"page":undefined} className={cn("flex min-h-11 items-center gap-3 px-3 text-sm transition-colors",active?"bg-[var(--bs-cool-river)] text-[var(--bs-text-primary)]":"hover:bg-[var(--bs-surface-hover)]")}><Icon className="h-4 w-4 shrink-0" aria-hidden="true"/><span>{item.label[locale]}</span></Link>})}</div>
            </div>
          </details>
        </div>
      </nav>
    </>
  )
}

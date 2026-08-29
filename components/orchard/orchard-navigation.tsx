"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  LayoutDashboard,
  Leaf,
  Map,
  PanelsTopLeft,
  Route,
  ShieldAlert,
  Smartphone,
  Sprout,
  TestTube2,
  WandSparkles,
} from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: { en: string; es: string }
  icon: typeof LayoutDashboard
  includeChildren?: boolean
}

const primaryItems: NavItem[] = [
  { href: "/orchard", label: { en: "Overview", es: "Resumen" }, icon: LayoutDashboard },
  { href: "/orchard/field", label: { en: "Field", es: "Terreno" }, icon: Smartphone, includeChildren: true },
  { href: "/orchard/game-plan", label: { en: "Game Plan", es: "Plan" }, icon: CalendarRange },
  { href: "/orchard/work", label: { en: "Work", es: "Trabajo" }, icon: CalendarDays },
  { href: "/orchard/harvest", label: { en: "Harvest", es: "Cosecha" }, icon: Leaf },
  { href: "/orchard/assistant", label: { en: "Orchard AI", es: "IA Orchard" }, icon: Bot },
]

const groups = [
  {
    key: "planning",
    label: { en: "Planning", es: "Planificación" },
    icon: PanelsTopLeft,
    items: [
      { href: "/orchard/library", label: { en: "Crop Library", es: "Biblioteca" }, icon: BookOpen },
      { href: "/orchard/library/fao", label: { en: "FAO Catalog", es: "Catálogo FAO" }, icon: Database },
      { href: "/orchard/crop-map", label: { en: "Crop Map", es: "Mapa" }, icon: Map },
      { href: "/orchard/crop-map/auto-place", label: { en: "Auto-place", es: "Auto-ubicar" }, icon: WandSparkles },
      { href: "/orchard/nursery", label: { en: "Seeds & Nursery", es: "Semillas" }, icon: Sprout },
    ] satisfies NavItem[],
  },
  {
    key: "operations",
    label: { en: "Operations", es: "Operación" },
    icon: Activity,
    items: [
      { href: "/orchard/crops", label: { en: "Crops", es: "Cultivos" }, icon: Sprout },
      { href: "/orchard/lifecycle", label: { en: "Lifecycle", es: "Ciclo" }, icon: GitBranch },
      { href: "/orchard/care", label: { en: "Care", es: "Cuidados" }, icon: Activity },
      { href: "/orchard/pests", label: { en: "Health", es: "Sanidad" }, icon: Bug },
      { href: "/orchard/soil", label: { en: "Soil", es: "Suelo" }, icon: TestTube2 },
      { href: "/orchard/equipment", label: { en: "Equipment", es: "Equipos" }, icon: Hammer },
      { href: "/orchard/mobile", label: { en: "Mobile App", es: "App Móvil" }, icon: Smartphone },
    ] satisfies NavItem[],
  },
  {
    key: "performance",
    label: { en: "Performance", es: "Rendimiento" },
    icon: BarChart3,
    items: [
      { href: "/orchard/commercial", label: { en: "Commercial", es: "Comercial" }, icon: BadgeDollarSign },
      { href: "/orchard/performance", label: { en: "Plan vs Actual", es: "Plan vs Real" }, icon: ChartNoAxesCombined },
      { href: "/orchard/decisions", label: { en: "Decisions", es: "Decisiones" }, icon: ShieldAlert },
      { href: "/orchard/charts", label: { en: "Custom Charts", es: "Gráficos" }, icon: ChartSpline },
      { href: "/orchard/analytics", label: { en: "Insights", es: "Análisis" }, icon: BarChart3 },
      { href: "/orchard/season-summary", label: { en: "Season Summary", es: "Temporada" }, icon: Leaf },
      { href: "/orchard/traceability", label: { en: "Traceability", es: "Trazabilidad" }, icon: Route },
      { href: "/orchard/reports", label: { en: "Reports", es: "Reportes" }, icon: FileText },
    ] satisfies NavItem[],
  },
] as const

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
body:has([data-orchard-navigation]) main:has(> [data-slot="page-header"] + [data-orchard-navigation]) {
  display: flex;
  flex-direction: column;
}
body:has([data-orchard-navigation]) main:has(> [data-slot="page-header"] + [data-orchard-navigation]) > [data-orchard-navigation] { order: 0; }
body:has([data-orchard-navigation]) main:has(> [data-slot="page-header"] + [data-orchard-navigation]) > [data-slot="page-header"] { order: 1; }
body:has([data-orchard-navigation]) main:has(> [data-slot="page-header"] + [data-orchard-navigation]) > :not([data-orchard-navigation]):not([data-slot="page-header"]) { order: 2; }
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
  const { language } = useLanguage()
  const locale = language === "es" ? "es" : "en"

  return (
    <>
      <style>{ORCHARD_BRAND_CSS}</style>
      <nav
        data-orchard-navigation
        aria-label={locale === "es" ? "Navegación del huerto" : "Orchard navigation"}
        className="sticky top-0 z-[70] border-b border-border bg-background px-3 md:px-8"
      >
        <div className="mx-auto flex min-h-14 w-full max-w-[1560px] items-center gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {primaryItems.map((item) => {
            const active = isActive(pathname, item)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={`/${language}${item.href}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none",
                  active
                    ? "bg-[var(--bs-cool-river)] text-[var(--bs-text-primary)]"
                    : "text-muted-foreground hover:bg-[var(--bs-surface-secondary)] hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className={cn(item.href !== "/orchard" && "hidden sm:inline")}>{item.label[locale]}</span>
              </Link>
            )
          })}

          <div className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

          {groups.map((group) => {
            const groupActive = group.items.some((item) => isActive(pathname, item))
            const GroupIcon = group.icon
            return (
              <details key={group.key} className="group relative z-[80] shrink-0">
                <summary
                  className={cn(
                    "flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium transition-colors marker:content-none focus-visible:outline-none [&::-webkit-details-marker]:hidden",
                    groupActive
                      ? "bg-[var(--bs-surface-elevated)] text-foreground"
                      : "text-muted-foreground hover:bg-[var(--bs-surface-secondary)] hover:text-foreground",
                  )}
                >
                  <GroupIcon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{group.label[locale]}</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="fixed left-2 right-2 top-[60px] z-[90] max-h-[calc(100dvh-72px)] overflow-y-auto border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-elevated)] p-2 text-popover-foreground sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[min(70vh,520px)] sm:w-72">
                  <div className="mb-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label[locale]}
                  </div>
                  <div className="grid gap-1">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item)
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={`/${language}${item.href}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 items-center gap-3 px-3 text-sm transition-colors",
                            active
                              ? "bg-[var(--bs-cool-river)] text-[var(--bs-text-primary)]"
                              : "hover:bg-[var(--bs-surface-hover)]",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label[locale]}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      </nav>
    </>
  )
}

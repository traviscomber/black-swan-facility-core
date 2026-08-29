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
  GitBranch,
  Hammer,
  LayoutDashboard,
  Leaf,
  Map,
  PanelsTopLeft,
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
    ] satisfies NavItem[],
  },
] as const

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
    <nav
      aria-label={locale === "es" ? "Navegación del huerto" : "Orchard navigation"}
      className="relative z-50 border-b border-border bg-background/95 px-3 backdrop-blur md:px-8"
    >
      <div className="flex min-h-14 items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {primaryItems.map((item) => {
          const active = isActive(pathname, item)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={`/${language}${item.href}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
            <details key={group.key} className="group relative z-50 shrink-0">
              <summary
                className={cn(
                  "flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
                  groupActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <GroupIcon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{group.label[locale]}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="fixed left-3 right-3 z-[100] mt-2 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl sm:absolute sm:left-auto sm:right-0 sm:w-72">
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
                          "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                          active
                            ? "bg-foreground text-background"
                            : "hover:bg-muted",
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
  )
}

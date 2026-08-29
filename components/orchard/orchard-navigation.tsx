"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, BarChart3, Bot, Bug, CalendarDays, CalendarRange, ChartNoAxesCombined, GitBranch, Hammer, LayoutDashboard, Leaf, Map, ShieldAlert, Smartphone, Sprout, TestTube2 } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

const items = [
  { href: "/orchard", label: { en: "Overview", es: "Resumen" }, icon: LayoutDashboard },
  { href: "/orchard/field", label: { en: "Field Mode", es: "Terreno" }, icon: Smartphone },
  { href: "/orchard/game-plan", label: { en: "Game Plan", es: "Plan" }, icon: CalendarRange },
  { href: "/orchard/crop-map", label: { en: "Crop Map", es: "Mapa" }, icon: Map },
  { href: "/orchard/nursery", label: { en: "Seeds & Nursery", es: "Semillas" }, icon: Sprout },
  { href: "/orchard/work", label: { en: "Tasks & Calendar", es: "Tareas" }, icon: CalendarDays },
  { href: "/orchard/crops", label: { en: "Crops", es: "Cultivos" }, icon: Sprout },
  { href: "/orchard/lifecycle", label: { en: "Lifecycle", es: "Ciclo" }, icon: GitBranch },
  { href: "/orchard/care", label: { en: "Care", es: "Cuidados" }, icon: Activity },
  { href: "/orchard/harvest", label: { en: "Harvest", es: "Cosecha" }, icon: Leaf },
  { href: "/orchard/pests", label: { en: "Health", es: "Sanidad" }, icon: Bug },
  { href: "/orchard/soil", label: { en: "Soil", es: "Suelo" }, icon: TestTube2 },
  { href: "/orchard/equipment", label: { en: "Equipment", es: "Equipos" }, icon: Hammer },
  { href: "/orchard/performance", label: { en: "Plan vs Actual", es: "Plan vs Real" }, icon: ChartNoAxesCombined },
  { href: "/orchard/decisions", label: { en: "Decisions", es: "Decisiones" }, icon: ShieldAlert },
  { href: "/orchard/analytics", label: { en: "Insights", es: "Análisis" }, icon: BarChart3 },
  { href: "/orchard/assistant", label: { en: "Orchard AI", es: "IA Orchard" }, icon: Bot },
] as const

function internalPath(pathname: string) { return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/" }
export function OrchardNavigation() {
  const pathname = internalPath(usePathname() || "/")
  const { language } = useLanguage()
  const locale = language === "es" ? "es" : "en"
  return <nav aria-label={locale === "es" ? "Navegación del huerto" : "Orchard navigation"} className="border-b border-border bg-muted/20 px-4 md:px-8"><div className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{items.map(({ href, label, icon: Icon }) => { const active = pathname === href || (href === "/orchard/field" && pathname.startsWith("/orchard/field/")); return <Link key={href} href={`/${language}${href}`} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4" aria-hidden="true" />{label[locale]}</Link> })}</div></nav>
}

"use client"

import Link from "next/link"
import { CalendarRange, Database, Leaf, Settings2, Store, Users } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { channels: "Sales Channels", season: "Season Harvests", weekly: "Weekly Harvests", farmSettings: "Farm settings", farmData: "Farm data", team: "Team" },
  es: { channels: "Canales de venta", season: "Cosecha temporada", weekly: "Cosechas semanales", farmSettings: "Configuración de granja", farmData: "Datos de granja", team: "Equipo" },
  de: { channels: "Verkaufskanäle", season: "Saisonernte", weekly: "Wochenernten", farmSettings: "Hofeinstellungen", farmData: "Hofdaten", team: "Team" },
} as const

const SETTINGS_DENSITY_CSS = `
@media (min-width:768px) {
  body:has(nav[aria-label="Settings workspace"]) main h1 {
    display: none !important;
  }
}
`

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

export function OrchardHarvestSectionNav() {
  const pathname = stripLocale(usePathname() || "/")
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const text = copy[language as keyof typeof copy] ?? copy.en

  const inHarvestWorkspace = pathname === "/orchard/commercial" || pathname.startsWith("/orchard/harvest")
  const inSettingsWorkspace = pathname === "/orchard/settings" || pathname.startsWith("/orchard/settings/")
  if (!inHarvestWorkspace && !inSettingsWorkspace) return null

  const query = searchParams.toString()
  const href = (path: string) => `/${language}${path}${query ? `?${query}` : ""}`
  const items = inSettingsWorkspace
    ? [
        { href: "/orchard/settings", label: text.farmSettings, icon: Settings2, active: pathname === "/orchard/settings" },
        { href: "/orchard/settings/farm-data", label: text.farmData, icon: Database, active: pathname === "/orchard/settings/farm-data" },
        { href: "/orchard/settings/team", label: text.team, icon: Users, active: pathname === "/orchard/settings/team" },
      ]
    : [
        { href: "/orchard/commercial", label: text.channels, icon: Store, active: pathname === "/orchard/commercial" },
        { href: "/orchard/harvest/season", label: text.season, icon: CalendarRange, active: pathname === "/orchard/harvest/season" },
        { href: "/orchard/harvest/desk", label: text.weekly, icon: Leaf, active: pathname === "/orchard/harvest/desk" },
      ]

  return <>
    {inSettingsWorkspace ? <style>{SETTINGS_DENSITY_CSS}</style> : null}
    <nav
      aria-label={inSettingsWorkspace ? "Settings workspace" : "Harvest workspace"}
      className="sticky top-0 z-30 flex min-h-12 w-full items-stretch overflow-x-auto border-b border-[var(--bs-divider-subtle)] bg-[var(--orchard-canvas,#171512)] px-3 sm:px-5"
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={href(item.href)}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex min-w-max items-center gap-2 px-3 py-3 text-sm transition-colors ${item.active ? "text-[var(--orchard-green,#8bcba8)]" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.active ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[var(--orchard-green,#8bcba8)]" /> : null}
          </Link>
        )
      })}
    </nav>
  </>
}

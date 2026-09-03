"use client"

import Link from "next/link"
import { CalendarRange, Leaf, Store } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { channels: "Sales Channels", season: "Season Harvests", weekly: "Weekly Harvests" },
  es: { channels: "Canales de venta", season: "Cosecha temporada", weekly: "Cosechas semanales" },
  de: { channels: "Verkaufskanäle", season: "Saisonernte", weekly: "Wochenernten" },
} as const

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

export function OrchardHarvestSectionNav() {
  const pathname = stripLocale(usePathname() || "/")
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const text = copy[language as keyof typeof copy] ?? copy.en

  const inHarvestWorkspace = pathname === "/orchard/commercial" || pathname.startsWith("/orchard/harvest")
  if (!inHarvestWorkspace) return null

  const query = searchParams.toString()
  const href = (path: string) => `/${language}${path}${query ? `?${query}` : ""}`
  const items = [
    { href: "/orchard/commercial", label: text.channels, icon: Store, active: pathname === "/orchard/commercial" },
    { href: "/orchard/harvest/desk", label: text.season, icon: CalendarRange, active: pathname === "/orchard/harvest/desk" },
    { href: "/orchard/harvest", label: text.weekly, icon: Leaf, active: pathname === "/orchard/harvest" || (pathname.startsWith("/orchard/harvest/") && pathname !== "/orchard/harvest/desk") },
  ]

  return (
    <nav
      aria-label="Harvest workspace"
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
  )
}

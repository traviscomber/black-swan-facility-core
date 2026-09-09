"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Map, ListChecks } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

const COPY = {
  en: { map: "Crop Map", work: "Work" },
  es: { map: "Mapa", work: "Trabajo" },
  de: { map: "Anbaukarte", work: "Arbeit" },
} as const

const PRIORITY_SURFACE_CSS = `
@media (max-width: 767px) {
  body:has([data-orchard-priority-surface="work"]) main section[class*="min-h-"][class*="overflow-hidden"] {
    min-height: 0 !important;
  }

  body:has([data-orchard-priority-surface="work"]) main section[class*="min-h-"][class*="overflow-hidden"] > img[class*="absolute"][class*="inset-0"],
  body:has([data-orchard-priority-surface="work"]) main section[class*="min-h-"][class*="overflow-hidden"] > div[class*="absolute"][class*="inset-0"] {
    display: none !important;
  }

  body:has([data-orchard-priority-surface="work"]) main section[class*="min-h-"][class*="overflow-hidden"] > div[class*="relative"][class*="min-h-"] {
    min-height: 0 !important;
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
  }

  body:has([data-orchard-priority-surface="work"]) main div[class*="xl:grid-cols-7"] {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  body:has([data-orchard-priority-surface="crop-map"]) main [class*="grid-cols-12"] {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  body:has([data-orchard-priority-surface="crop-map"]) main [class*="col-span-"] {
    grid-column: 1 / -1 !important;
  }

  body:has([data-orchard-priority-surface="crop-map"]) main [class*="overflow-x-auto"] {
    scroll-padding-inline: 1rem;
    overscroll-behavior-inline: contain;
  }
}

@media (min-width: 640px) and (max-width: 767px) {
  body:has([data-orchard-priority-surface="work"]) main div[class*="xl:grid-cols-7"] {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
`

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

export function OrchardPrioritySurface() {
  const pathname = usePathname() || "/"
  const internalPath = stripLocale(pathname)
  const surface = internalPath === "/orchard/crop-map" ? "crop-map" : internalPath === "/orchard/work" ? "work" : null
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const text = COPY[language as keyof typeof COPY] ?? COPY.en

  if (!surface) return null

  const gamePlan = searchParams.get("game_plan")
  const suffix = gamePlan ? `?game_plan=${encodeURIComponent(gamePlan)}` : ""
  const items = [
    { key: "crop-map", href: `/${language}/orchard/crop-map${suffix}`, label: text.map, icon: Map },
    { key: "work", href: `/${language}/orchard/work${suffix}`, label: text.work, icon: ListChecks },
  ] as const

  return <>
    <style>{PRIORITY_SURFACE_CSS}</style>
    <span data-orchard-priority-surface={surface} hidden aria-hidden="true" />
    <nav aria-label="Orchard field view" className="mx-3 mt-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1 md:hidden">
      {items.map((item) => {
        const Icon = item.icon
        const active = item.key === surface
        return <Link
          key={item.key}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
            active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      })}
    </nav>
  </>
}

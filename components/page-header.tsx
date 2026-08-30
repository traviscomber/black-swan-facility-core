"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

type HeaderIcon = React.ReactNode | React.ElementType

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
  icon?: HeaderIcon
  backHref?: string
}

type OrchardHeroConfig = {
  image: string
  kicker: string
  signals?: readonly string[]
}

const ORCHARD_HERO_IMAGES = {
  performance: "https://images.unsplash.com/photo-1592982537447-6f2a6a0c7f8c?auto=format&fit=crop&w=2200&q=92",
  cropMap: "https://unsplash.com/photos/x25GQ49K_JI/download?force=true&w=2200",
  seeds: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=2200&q=92",
} as const

const ORCHARD_HERO_EXCLUSIONS = new Set([
  "/orchard",
  "/orchard/field",
  "/orchard/work",
  "/orchard/harvest",
  "/orchard/assistant",
  "/orchard/game-plan",
  "/orchard/crops",
  "/orchard/nursery",
  "/orchard/charts",
  "/orchard/analytics",
  "/orchard/season-summary",
  "/orchard/traceability",
  "/orchard/reports",
  "/orchard/mobile",
  "/orchard/health",
  "/orchard/notes",
  "/orchard/tasks",
  "/orchard/library",
  "/orchard/fao",
  "/orchard/game-plans",
  "/orchard/crop-cycles",
  "/orchard/successions",
  "/orchard/beds",
  "/orchard/plots",
])

const OPERATIONS_ROUTES = [
  "/orchard/lifecycle",
  "/orchard/care",
  "/orchard/pests",
  "/orchard/soil",
  "/orchard/equipment",
]

const PERFORMANCE_ROUTES = [
  "/orchard/commercial",
  "/orchard/performance",
  "/orchard/decisions",
]

const ROUTE_HEROES: Array<{ match: (pathname: string) => boolean; config: OrchardHeroConfig }> = [
  {
    match: (pathname) => pathname === "/orchard/crop-map" || pathname.startsWith("/orchard/crop-map/"),
    config: { image: ORCHARD_HERO_IMAGES.cropMap, kicker: "Spatial planning", signals: ["Beds", "Occupancy", "Rotation"] },
  },
  {
    match: (pathname) => pathname === "/orchard/seeds" || pathname.startsWith("/orchard/seeds/"),
    config: { image: ORCHARD_HERO_IMAGES.seeds, kicker: "Seed inventory", signals: ["Lots", "Viability", "Sowing readiness"] },
  },
]

function internalPath(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

function orchardHeroForPath(rawPathname: string): OrchardHeroConfig | null {
  const pathname = internalPath(rawPathname)
  if (!pathname.startsWith("/orchard") || ORCHARD_HERO_EXCLUSIONS.has(pathname)) return null
  const specific = ROUTE_HEROES.find((item) => item.match(pathname))
  if (specific) return specific.config
  if (OPERATIONS_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null
  if (PERFORMANCE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return { image: ORCHARD_HERO_IMAGES.performance, kicker: "Performance intelligence" }
  return null
}

function renderIcon(icon: HeaderIcon | undefined) {
  if (!icon) return null
  if (React.isValidElement(icon) || typeof icon === "string" || typeof icon === "number") return icon
  const Icon = icon as React.ElementType
  return <Icon className="h-5 w-5" />
}

export function PageHeader({
  title,
  description,
  actions,
  children,
  action,
  actionLabel,
  onAction,
  icon,
  backHref,
}: PageHeaderProps) {
  const pathname = usePathname()
  const normalizedPath = internalPath(pathname)
  const isOrchard = normalizedPath === "/orchard" || normalizedPath.startsWith("/orchard/")
  const orchardHero = orchardHeroForPath(pathname)
  const resolvedActions = actions ?? action ?? children ?? (actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null)

  if (orchardHero) {
    return (
      <div
        data-slot="page-header"
        data-orchard-hero="true"
        className="relative isolate min-h-[230px] overflow-hidden border-b border-white/10 md:min-h-[270px]"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(10, 12, 10, 0.95) 0%, rgba(10, 12, 10, 0.80) 40%, rgba(10, 12, 10, 0.30) 72%, rgba(10, 12, 10, 0.10) 100%), linear-gradient(0deg, rgba(10, 12, 10, 0.70) 0%, rgba(10, 12, 10, 0.04) 62%), url("${orchardHero.image}")`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_36%,rgba(134,239,172,0.11),transparent_28%)]" />
        <div className="relative z-10 mx-auto flex min-h-[230px] w-full max-w-[1560px] flex-col justify-end gap-5 px-4 py-7 md:min-h-[270px] md:flex-row md:items-end md:justify-between md:px-8 md:py-8">
          <div className="min-w-0 max-w-3xl space-y-3">
            <div className="flex items-center gap-2">
              {backHref && (
                <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8 text-white hover:bg-white/10 hover:text-white" aria-label="Back">
                  <Link href={backHref}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
              )}
              {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/15 bg-black/25 text-emerald-200">{renderIcon(icon)}</span>}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200">Black Swan Facility Core · {orchardHero.kicker}</p>
                <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-white md:text-4xl">{title}</h1>
              </div>
            </div>
            {description && <p className="max-w-2xl text-sm leading-6 text-white/72 md:text-[15px]">{description}</p>}
            {orchardHero.signals && (
              <div className="flex flex-wrap gap-2 pt-1">
                {orchardHero.signals.map((signal) => <span key={signal} className="border border-white/14 bg-black/25 px-3 py-1 text-[11px] font-medium tracking-wide text-white/78">{signal}</span>)}
              </div>
            )}
          </div>
          {resolvedActions && <div className="flex shrink-0 flex-wrap items-center gap-2">{resolvedActions}</div>}
        </div>
      </div>
    )
  }

  if (isOrchard) {
    return (
      <div data-slot="page-header" className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {backHref && (
                <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8" aria-label="Back">
                  <Link href={backHref}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
              )}
              {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary">{renderIcon(icon)}</span>}
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">Black Swan Facility Core · Orchard</p>
                <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em] text-foreground md:text-3xl">{title}</h1>
              </div>
            </div>
            {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
          {resolvedActions && <div className="flex shrink-0 flex-wrap items-center gap-2">{resolvedActions}</div>}
        </div>
      </div>
    )
  }

  return (
    <div data-slot="page-header" className="flex flex-col gap-3 border-b border-border bg-background px-4 py-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {backHref && (
            <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8" aria-label="Back">
              <Link href={backHref}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
          )}
          {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary">{renderIcon(icon)}</span>}
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">Black Swan Facility Core</p>
            <h1 className="truncate text-2xl font-semibold tracking-[-0.025em] text-foreground md:text-3xl">{title}</h1>
          </div>
        </div>
        {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {resolvedActions && <div className="mt-2 flex shrink-0 items-center gap-2 md:mt-0">{resolvedActions}</div>}
    </div>
  )
}
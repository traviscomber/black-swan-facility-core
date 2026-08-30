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
  image?: string
  kicker: string
  signals?: readonly string[]
  suppressFirstContentHero?: boolean
}

const ORCHARD_HERO_IMAGES = {
  gamePlan: "https://images.unsplash.com/photo-1498579397066-22750a3cb424?auto=format&fit=crop&w=2200&q=92",
  nursery: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=2200&q=92",
  cropMap: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2200&q=92",
  autoPlace: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=2200&q=92",
  observation: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=2200&q=92",
  seasonClose: "https://images.unsplash.com/photo-1471194402529-8e0f5a675de6?auto=format&fit=crop&w=2200&q=92",
  traceability: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=2200&q=92",
} as const

const ORCHARD_HERO_EXCLUSIONS = new Set([
  "/orchard",
  "/orchard/field",
  "/orchard/work",
  "/orchard/harvest",
  "/orchard/assistant",
  "/orchard/crops",
  "/orchard/lifecycle",
  "/orchard/care",
  "/orchard/pests",
  "/orchard/soil",
  "/orchard/equipment",
  "/orchard/commercial",
  "/orchard/performance",
  "/orchard/decisions",
  "/orchard/mobile",
  "/orchard/health",
  "/orchard/notes",
  "/orchard/tasks",
])

const ROUTE_HEROES: Array<{ match: (pathname: string) => boolean; config: OrchardHeroConfig }> = [
  {
    match: (pathname) => pathname === "/orchard/game-plan" || pathname.startsWith("/orchard/game-plan/"),
    config: { image: ORCHARD_HERO_IMAGES.gamePlan, kicker: "Season planning", signals: ["Crop cycles", "Succession cadence", "Harvest windows"] },
  },
  {
    match: (pathname) => pathname === "/orchard/nursery" || pathname.startsWith("/orchard/nursery/"),
    config: { image: ORCHARD_HERO_IMAGES.nursery, kicker: "Propagation nursery", signals: ["Seed lots", "Germination", "Transplant readiness"] },
  },
  {
    match: (pathname) => pathname === "/orchard/library/fao" || pathname.startsWith("/orchard/library/fao/"),
    config: { kicker: "Reference catalog", signals: ["WCA 2020", "Botanical identity", "Reference sync"] },
  },
  {
    match: (pathname) => pathname === "/orchard/library" || pathname.startsWith("/orchard/library/"),
    config: { kicker: "Agronomic knowledge", signals: ["Profiles", "Provenance", "Planning defaults"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/crop-map/auto-place" || pathname.startsWith("/orchard/crop-map/auto-place/"),
    config: { image: ORCHARD_HERO_IMAGES.autoPlace, kicker: "Spatial allocation", signals: ["Contiguous beds", "Available area", "Rotation"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/crop-map" || pathname.startsWith("/orchard/crop-map/"),
    config: { image: ORCHARD_HERO_IMAGES.cropMap, kicker: "Spatial planning", signals: ["Layout", "Occupancy", "Rotation"] },
  },
  {
    match: (pathname) => pathname === "/orchard/charts" || pathname.startsWith("/orchard/charts/"),
    config: { kicker: "Operational analytics", signals: ["Datasets", "Metrics", "Saved views"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/analytics" || pathname.startsWith("/orchard/analytics/"),
    config: { image: ORCHARD_HERO_IMAGES.observation, kicker: "Field intelligence", signals: ["Observations", "Signals", "Notes"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/season-summary" || pathname.startsWith("/orchard/season-summary/"),
    config: { image: ORCHARD_HERO_IMAGES.seasonClose, kicker: "Season closeout", signals: ["Yield", "Harvest", "Operational record"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/traceability" || pathname.startsWith("/orchard/traceability/"),
    config: { image: ORCHARD_HERO_IMAGES.traceability, kicker: "Crop lineage", signals: ["Nursery", "Field", "Harvest"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/reports" || pathname.startsWith("/orchard/reports/"),
    config: { kicker: "Reporting layer", signals: ["Evidence", "Closeout", "Export"], suppressFirstContentHero: true },
  },
]

function internalPath(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

function orchardHeroForPath(rawPathname: string): OrchardHeroConfig | null {
  const pathname = internalPath(rawPathname)
  if (!pathname.startsWith("/orchard") || ORCHARD_HERO_EXCLUSIONS.has(pathname)) return null
  return ROUTE_HEROES.find((item) => item.match(pathname))?.config ?? null
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
    const backgroundImage = orchardHero.image
      ? `linear-gradient(90deg, rgba(10, 12, 10, 0.95) 0%, rgba(10, 12, 10, 0.80) 40%, rgba(10, 12, 10, 0.30) 72%, rgba(10, 12, 10, 0.10) 100%), linear-gradient(0deg, rgba(10, 12, 10, 0.70) 0%, rgba(10, 12, 10, 0.04) 62%), url("${orchardHero.image}")`
      : "linear-gradient(115deg, rgba(12,16,13,1) 0%, rgba(25,34,28,1) 52%, rgba(41,48,43,1) 100%)"

    return (
      <>
        {orchardHero.suppressFirstContentHero && (
          <style>{`
            body:has([data-orchard-navigation]) main:has([data-slot="page-header"][data-orchard-suppress-first-hero="true"]) > div:not([data-slot]):not([class*="fixed"]) > section:first-of-type {
              display: none !important;
            }
          `}</style>
        )}
        <div
          data-slot="page-header"
          data-orchard-hero="true"
          data-orchard-suppress-first-hero={orchardHero.suppressFirstContentHero ? "true" : undefined}
          className="relative isolate min-h-[230px] overflow-hidden border-b border-white/10 md:min-h-[270px]"
          style={{
            backgroundImage,
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
      </>
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

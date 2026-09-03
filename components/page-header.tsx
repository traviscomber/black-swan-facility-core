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
  kicker: string
  signals?: readonly string[]
  suppressFirstContentHero?: boolean
}

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
  "/orchard/traceability",
  "/orchard/mobile",
  "/orchard/health",
  "/orchard/notes",
  "/orchard/tasks",
])

const ROUTE_HEROES: Array<{ match: (pathname: string) => boolean; config: OrchardHeroConfig }> = [
  {
    match: (pathname) => pathname === "/orchard/game-plan" || pathname.startsWith("/orchard/game-plan/"),
    config: { kicker: "Season planning", signals: ["Crop cycles", "Succession cadence", "Harvest windows"] },
  },
  {
    match: (pathname) => pathname === "/orchard/nursery" || pathname.startsWith("/orchard/nursery/"),
    config: { kicker: "Propagation nursery", signals: ["Seed lots", "Germination", "Transplant readiness"] },
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
    config: { kicker: "Spatial allocation", signals: ["Contiguous beds", "Available area", "Rotation"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/crop-map" || pathname.startsWith("/orchard/crop-map/"),
    config: { kicker: "Spatial planning", signals: ["Layout", "Occupancy", "Rotation"] },
  },
  {
    match: (pathname) => pathname === "/orchard/charts" || pathname.startsWith("/orchard/charts/"),
    config: { kicker: "Operational analytics", signals: ["Datasets", "Metrics", "Saved views"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/analytics" || pathname.startsWith("/orchard/analytics/"),
    config: { kicker: "Field intelligence", signals: ["Observations", "Signals", "Notes"], suppressFirstContentHero: true },
  },
  {
    match: (pathname) => pathname === "/orchard/season-summary" || pathname.startsWith("/orchard/season-summary/"),
    config: { kicker: "Season closeout", signals: ["Yield", "Harvest", "Operational record"], suppressFirstContentHero: true },
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
          className="relative isolate overflow-hidden border-b border-border bg-background"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34%] border-l border-border/50 lg:block">
            <div className="grid h-full grid-cols-4 divide-x divide-border/35">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="relative z-10 mx-auto flex min-h-[156px] w-full max-w-[1560px] flex-col justify-end gap-4 px-4 py-5 md:min-h-[174px] md:flex-row md:items-end md:justify-between md:px-8 md:py-6">
            <div className="min-w-0 max-w-3xl space-y-2.5">
              <div className="flex items-center gap-2">
                {backHref && (
                  <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8" aria-label="Back">
                    <Link href={backHref}><ArrowLeft className="h-4 w-4" /></Link>
                  </Button>
                )}
                {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-muted/30 text-primary">{renderIcon(icon)}</span>}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Black Swan Facility Core · {orchardHero.kicker}</p>
                  <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-foreground md:text-[2.1rem]">{title}</h1>
                </div>
              </div>
              {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
              {orchardHero.signals && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                  {orchardHero.signals.map((signal) => <span key={signal} className="border-l border-primary/45 pl-2 text-[11px] font-medium tracking-wide text-muted-foreground">{signal}</span>)}
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

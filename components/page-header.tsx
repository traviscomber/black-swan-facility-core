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
  /** @deprecated Prefer actions. Kept while legacy pages converge on the shared contract. */
  action?: React.ReactNode
  /** @deprecated Prefer actions. */
  actionLabel?: string
  /** @deprecated Prefer actions. */
  onAction?: () => void
  icon?: HeaderIcon
  backHref?: string
}

const ORCHARD_HERO_IMAGES = {
  planning: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=2200&q=92",
  operations: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2200&q=92",
  performance: "https://images.unsplash.com/photo-1592982537447-6f2a6a0c7f8c?auto=format&fit=crop&w=2200&q=92",
  planningDetail: "https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?auto=format&fit=crop&w=2200&q=92",
} as const

const ORCHARD_HERO_EXCLUSIONS = new Set([
  "/orchard",
  "/orchard/field",
  "/orchard/work",
  "/orchard/harvest",
  "/orchard/assistant",
])

const PLANNING_ROUTES = [
  "/orchard/library",
  "/orchard/crop-map",
  "/orchard/auto-place",
  "/orchard/nursery",
  "/orchard/fao",
  "/orchard/game-plan",
  "/orchard/game-plans",
  "/orchard/crop-cycles",
  "/orchard/successions",
  "/orchard/seeds",
  "/orchard/beds",
  "/orchard/plots",
]

const OPERATIONS_ROUTES = [
  "/orchard/crops",
  "/orchard/lifecycle",
  "/orchard/care",
  "/orchard/pests",
  "/orchard/soil",
  "/orchard/equipment",
  "/orchard/mobile",
  "/orchard/health",
  "/orchard/notes",
  "/orchard/tasks",
]

const PERFORMANCE_ROUTES = [
  "/orchard/commercial",
  "/orchard/performance",
  "/orchard/decisions",
  "/orchard/charts",
  "/orchard/analytics",
  "/orchard/season-summary",
  "/orchard/traceability",
  "/orchard/reports",
]

function orchardHeroForPath(pathname: string) {
  if (!pathname.startsWith("/orchard") || ORCHARD_HERO_EXCLUSIONS.has(pathname)) return null
  if (pathname.startsWith("/orchard/game-plan")) return ORCHARD_HERO_IMAGES.planningDetail
  if (PLANNING_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return ORCHARD_HERO_IMAGES.planning
  if (OPERATIONS_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return ORCHARD_HERO_IMAGES.operations
  if (PERFORMANCE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return ORCHARD_HERO_IMAGES.performance
  return ORCHARD_HERO_IMAGES.operations
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
  const orchardHero = orchardHeroForPath(pathname)
  const resolvedActions = actions ?? action ?? children ?? (actionLabel && onAction ? (
    <Button onClick={onAction}>{actionLabel}</Button>
  ) : null)

  if (orchardHero) {
    return (
      <div
        data-slot="page-header"
        data-orchard-hero="true"
        className="relative isolate flex min-h-[220px] overflow-hidden border-b border-white/10 px-4 py-7 md:min-h-[250px] md:items-end md:px-8 md:py-8"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(10, 12, 10, 0.94) 0%, rgba(10, 12, 10, 0.78) 42%, rgba(10, 12, 10, 0.28) 72%, rgba(10, 12, 10, 0.12) 100%), linear-gradient(0deg, rgba(10, 12, 10, 0.62) 0%, rgba(10, 12, 10, 0.05) 58%), url("${orchardHero}")`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="relative z-10 flex w-full flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 max-w-3xl space-y-2">
            <div className="flex items-center gap-2">
              {backHref && (
                <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8 text-white hover:bg-white/10 hover:text-white" aria-label="Back">
                  <Link href={backHref}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
              )}
              {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/25 text-emerald-200 backdrop-blur-sm">{renderIcon(icon)}</span>}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200">Black Swan Facility Core · Orchard</p>
                <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-white drop-shadow-sm md:text-4xl">{title}</h1>
              </div>
            </div>
            {description && <p className="max-w-2xl text-sm leading-6 text-white/72 md:text-[15px]">{description}</p>}
          </div>
          {resolvedActions && <div className="flex shrink-0 flex-wrap items-center gap-2 [&_button]:border-white/15 [&_button]:shadow-lg">{resolvedActions}</div>}
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
          {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{renderIcon(icon)}</span>}
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

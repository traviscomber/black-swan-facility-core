import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

type HeaderIcon = React.ReactNode | React.ElementType

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  /** @deprecated Prefer actions. Kept while legacy pages converge on the shared contract. */
  action?: React.ReactNode
  /** @deprecated Prefer actions. */
  actionLabel?: string
  /** @deprecated Prefer actions. */
  onAction?: () => void
  icon?: HeaderIcon
  backHref?: string
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
  action,
  actionLabel,
  onAction,
  icon,
  backHref,
}: PageHeaderProps) {
  const resolvedActions = actions ?? action ?? (actionLabel && onAction ? (
    <Button onClick={onAction}>{actionLabel}</Button>
  ) : null)

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

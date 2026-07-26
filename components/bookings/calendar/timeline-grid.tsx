"use client"

import type React from "react"
import { format, isSameDay } from "date-fns"
import { CheckSquare, Square } from "lucide-react"
import type { CalendarBed, CalendarInventoryEvent } from "@/app/bookings/calendar/calendar-types"

export interface TimelineGridRenderRowContext {
  bed: CalendarBed
  events: CalendarInventoryEvent[]
  index: number
}

interface TimelineGridProps {
  beds: CalendarBed[]
  eventsByBed: Map<string, CalendarInventoryEvent[]>
  dates: Date[]
  dayWidth: number
  labelWidth: number
  timelineWidth: number
  loading?: boolean
  emptyMessage?: string
  visibleReservationCount?: number
  isBulkMode?: boolean
  onSelectAll?: () => void
  onClearSelection?: () => void
  renderRow: (context: TimelineGridRenderRowContext) => React.ReactNode
  scrollContainerRef?: React.Ref<HTMLDivElement>
  headerLabel?: React.ReactNode
  loadingLabel?: React.ReactNode
}

export function TimelineGrid({
  beds,
  eventsByBed,
  dates,
  dayWidth,
  labelWidth,
  timelineWidth,
  loading = false,
  emptyMessage = "No hay unidades para los filtros seleccionados.",
  visibleReservationCount = 0,
  isBulkMode = false,
  onSelectAll,
  onClearSelection,
  renderRow,
  scrollContainerRef,
  headerLabel = "Propiedad / habitación / cama",
  loadingLabel = "Cargando disponibilidad…",
}: TimelineGridProps) {
  const canToggleSelection = visibleReservationCount > 0 && onSelectAll && onClearSelection

  return (
    <div ref={scrollContainerRef} className="overflow-auto">
      <div style={{ minWidth: labelWidth + timelineWidth }}>
        <div className="sticky top-0 z-30 flex border-b bg-background">
          <div
            className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r bg-background px-4 font-medium"
            style={{ width: labelWidth, height: 58 }}
          >
            {canToggleSelection ? (
              <button
                type="button"
                onClick={isBulkMode ? onClearSelection : onSelectAll}
                className="shrink-0 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={isBulkMode ? "Deseleccionar todo" : "Seleccionar todo"}
              >
                {isBulkMode ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
            ) : null}
            <span>{headerLabel}</span>
          </div>

          <div
            className="grid"
            style={{
              width: timelineWidth,
              gridTemplateColumns: `repeat(${dates.length}, ${dayWidth}px)`,
            }}
          >
            {dates.map((date) => (
              <div
                key={date.toISOString()}
                className={`flex flex-col items-center justify-center border-r text-center ${isSameDay(date, new Date()) ? "bg-amber-100" : ""}`}
                style={{ height: 58 }}
              >
                <div className="text-xs text-muted-foreground">{format(date, "EEE")}</div>
                <div className="font-semibold">{format(date, "dd MMM")}</div>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">{loadingLabel}</div>
        ) : beds.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">{emptyMessage}</div>
        ) : (
          beds.map((bed, index) => (
            <div key={bed.id}>{renderRow({ bed, events: eventsByBed.get(bed.id) ?? [], index })}</div>
          ))
        )}
      </div>
    </div>
  )
}

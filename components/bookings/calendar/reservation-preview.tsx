"use client"

import type { AvailabilityState, CalendarGeometry, CalendarInteractionPreview } from "@/app/bookings/calendar/calendar-types"

interface ReservationPreviewProps {
  preview: CalendarInteractionPreview
  geometry: CalendarGeometry
  title?: string
}

const AVAILABILITY_STYLES: Record<AvailabilityState, string> = {
  idle: "border-sky-200 bg-sky-600/70",
  validating: "border-sky-200 bg-sky-600/70",
  available: "border-emerald-200 bg-emerald-500/70",
  conflict: "border-red-200 bg-red-600/80",
  error: "border-red-200 bg-red-700/80",
}

const AVAILABILITY_LABELS: Record<AvailabilityState, string> = {
  idle: "Vista previa",
  validating: "Validando disponibilidad…",
  available: "Disponible",
  conflict: "No disponible",
  error: "Error de validación",
}

function interactionLabel(preview: CalendarInteractionPreview) {
  switch (preview.interaction.type) {
    case "move":
      return "Mover reserva"
    case "resize-start":
    case "resize-end":
      return "Ajustar fechas"
    case "create":
      return "Nueva reserva"
  }
}

export function ReservationPreview({ preview, geometry, title }: ReservationPreviewProps) {
  const { interaction, availability, conflictType, message } = preview
  const fallbackMessage =
    availability === "available"
      ? "Suelta para confirmar"
      : availability === "conflict"
        ? conflictType === "block"
          ? "Conflicto con bloqueo"
          : "Conflicto con otra reserva"
        : "Arrastra para ajustar"

  return (
    <div
      className={`pointer-events-none absolute top-2 z-30 h-[52px] overflow-hidden rounded-md border-2 border-dashed text-white shadow-sm transition-[left,width,background-color,border-color] duration-100 ${AVAILABILITY_STYLES[availability]}`}
      style={{ left: geometry.left, width: geometry.width }}
      aria-live="polite"
    >
      <div className="truncate px-3 pt-1 text-xs font-semibold">
        {title ?? interactionLabel(preview)} · {AVAILABILITY_LABELS[availability]}
      </div>
      <div className="truncate px-3 text-[10px] text-white/90">
        {interaction.previewStart} → {interaction.previewEnd} · {message ?? fallbackMessage}
      </div>
    </div>
  )
}

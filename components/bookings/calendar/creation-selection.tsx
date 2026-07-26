"use client"

import type { CalendarGeometry } from "@/app/bookings/calendar/calendar-types"

interface CreationSelectionProps {
  geometry: CalendarGeometry
  startsOn: string
  endsOn: string
  availability: "idle" | "validating" | "available" | "conflict" | "error"
  message?: string | null
}

const STATE_CLASS: Record<CreationSelectionProps["availability"], string> = {
  idle: "border-primary/70 bg-primary/20 text-foreground",
  validating: "border-sky-300 bg-sky-500/30 text-white",
  available: "border-emerald-200 bg-emerald-500/65 text-white",
  conflict: "border-red-200 bg-red-600/75 text-white",
  error: "border-red-200 bg-red-700/75 text-white",
}

const STATE_LABEL: Record<CreationSelectionProps["availability"], string> = {
  idle: "Nueva reserva",
  validating: "Validando disponibilidad…",
  available: "Disponible",
  conflict: "No disponible",
  error: "Error de validación",
}

export function CreationSelection({
  geometry,
  startsOn,
  endsOn,
  availability,
  message,
}: CreationSelectionProps) {
  return (
    <div
      className={`pointer-events-none absolute top-2 z-30 h-[52px] overflow-hidden rounded-md border-2 border-dashed shadow-sm transition-[left,width,background-color,border-color] duration-100 ${STATE_CLASS[availability]}`}
      style={{ left: geometry.left, width: geometry.width }}
      aria-live="polite"
    >
      <div className="truncate px-3 pt-1 text-xs font-semibold">
        {STATE_LABEL[availability]} · {startsOn} → {endsOn}
      </div>
      <div className="truncate px-3 text-[10px] opacity-90">
        {message ?? (availability === "available" ? "Suelta para continuar" : "Arrastra para seleccionar fechas")}
      </div>
    </div>
  )
}

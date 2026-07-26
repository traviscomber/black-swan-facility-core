"use client"

// ---------------------------------------------------------------------------
// ReservationPreview
// Renders the ghost pastilla shown during resize, move, and new-reservation
// creation. Extracted from TimelineRow so the styling logic lives in one place.
// ---------------------------------------------------------------------------

export type PreviewIntent = "resize" | "move" | "create"
export type PreviewConflict = "none" | "reservation" | "block"

export interface ReservationPreviewProps {
  /** Pixel offset from the left of the timeline cell */
  left: number
  /** Pixel width of the pastilla */
  width: number
  intent: PreviewIntent
  conflict: PreviewConflict
  /** Display date range, e.g. "2026-07-25 → 2026-07-28" */
  label: string
  /** Secondary line shown below the label */
  sublabel?: string
}

// Colour mapping per intent × conflict
const BG: Record<PreviewIntent, Record<PreviewConflict, string>> = {
  resize: {
    none:        "border-white/90  bg-emerald-500/65",
    reservation: "border-red-200   bg-red-600/75",
    block:       "border-red-200   bg-red-600/75",
  },
  move: {
    none:        "border-white/90  bg-sky-500/65",
    reservation: "border-red-200   bg-red-600/75",
    block:       "border-red-200   bg-red-600/75",
  },
  create: {
    none:        "border-white/90  bg-violet-500/55",
    reservation: "border-red-200   bg-red-600/75",
    block:       "border-red-200   bg-red-600/75",
  },
}

const STATUS_TEXT: Record<PreviewIntent, Record<PreviewConflict, string>> = {
  resize: {
    none:        "Disponible",
    reservation: "No disponible",
    block:       "No disponible",
  },
  move: {
    none:        "Mover aqui",
    reservation: "No disponible",
    block:       "No disponible",
  },
  create: {
    none:        "Nueva reserva",
    reservation: "No disponible",
    block:       "Bloqueado",
  },
}

const HINT_TEXT: Record<PreviewIntent, Record<PreviewConflict, string>> = {
  resize: {
    none:        "Suelta para confirmar",
    reservation: "Conflicto con otra reserva",
    block:       "Conflicto con bloqueo",
  },
  move: {
    none:        "Suelta para reasignar",
    reservation: "Conflicto con otra reserva",
    block:       "Conflicto con bloqueo",
  },
  create: {
    none:        "Suelta para crear",
    reservation: "Conflicto con otra reserva",
    block:       "Conflicto con bloqueo",
  },
}

export function ReservationPreview({
  left,
  width,
  intent,
  conflict,
  label,
  sublabel,
}: ReservationPreviewProps) {
  const colorClass  = BG[intent][conflict]
  const statusText  = STATUS_TEXT[intent][conflict]
  const hintText    = sublabel ?? HINT_TEXT[intent][conflict]

  return (
    <div
      className={`pointer-events-none absolute top-2 z-20 h-[52px] rounded-md border-2 border-dashed shadow-sm transition-all duration-150 ${colorClass}`}
      style={{ left, width }}
    >
      <div className="truncate px-3 pt-1 text-xs font-semibold text-white">
        {statusText} · {label}
      </div>
      <div className="truncate px-3 text-[10px] text-white/90">{hintText}</div>
    </div>
  )
}

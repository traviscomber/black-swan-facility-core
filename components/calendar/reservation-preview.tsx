"use client"

import { useLanguage, type Language } from "@/lib/hooks/use-language"

export type PreviewIntent = "resize" | "move" | "create"
export type PreviewConflict = "none" | "reservation" | "block"

export interface ReservationPreviewProps {
  left: number
  width: number
  intent: PreviewIntent
  conflict: PreviewConflict
  label: string
  sublabel?: string
}

const BG: Record<PreviewIntent, Record<PreviewConflict, string>> = {
  resize: {
    none: "border-white/90 bg-emerald-500/65",
    reservation: "border-red-200 bg-red-600/75",
    block: "border-red-200 bg-red-600/75",
  },
  move: {
    none: "border-white/90 bg-sky-500/65",
    reservation: "border-red-200 bg-red-600/75",
    block: "border-red-200 bg-red-600/75",
  },
  create: {
    none: "border-white/90 bg-violet-500/55",
    reservation: "border-red-200 bg-red-600/75",
    block: "border-red-200 bg-red-600/75",
  },
}

const copy: Record<Language, {
  status: Record<PreviewIntent, Record<PreviewConflict, string>>
  hint: Record<PreviewIntent, Record<PreviewConflict, string>>
}> = {
  en: {
    status: {
      resize: { none: "Available", reservation: "Unavailable", block: "Unavailable" },
      move: { none: "Move here", reservation: "Unavailable", block: "Unavailable" },
      create: { none: "New reservation", reservation: "Unavailable", block: "Blocked" },
    },
    hint: {
      resize: { none: "Release to confirm", reservation: "Conflicts with another reservation", block: "Conflicts with a block" },
      move: { none: "Release to reassign", reservation: "Conflicts with another reservation", block: "Conflicts with a block" },
      create: { none: "Release to create", reservation: "Conflicts with another reservation", block: "Conflicts with a block" },
    },
  },
  es: {
    status: {
      resize: { none: "Disponible", reservation: "No disponible", block: "No disponible" },
      move: { none: "Mover aquí", reservation: "No disponible", block: "No disponible" },
      create: { none: "Nueva reserva", reservation: "No disponible", block: "Bloqueado" },
    },
    hint: {
      resize: { none: "Suelta para confirmar", reservation: "Conflicto con otra reserva", block: "Conflicto con bloqueo" },
      move: { none: "Suelta para reasignar", reservation: "Conflicto con otra reserva", block: "Conflicto con bloqueo" },
      create: { none: "Suelta para crear", reservation: "Conflicto con otra reserva", block: "Conflicto con bloqueo" },
    },
  },
  de: {
    status: {
      resize: { none: "Verfügbar", reservation: "Nicht verfügbar", block: "Nicht verfügbar" },
      move: { none: "Hierher verschieben", reservation: "Nicht verfügbar", block: "Nicht verfügbar" },
      create: { none: "Neue Reservierung", reservation: "Nicht verfügbar", block: "Gesperrt" },
    },
    hint: {
      resize: { none: "Loslassen zum Bestätigen", reservation: "Konflikt mit einer anderen Reservierung", block: "Konflikt mit einer Sperre" },
      move: { none: "Loslassen zum Neuzuweisen", reservation: "Konflikt mit einer anderen Reservierung", block: "Konflikt mit einer Sperre" },
      create: { none: "Loslassen zum Erstellen", reservation: "Konflikt mit einer anderen Reservierung", block: "Konflikt mit einer Sperre" },
    },
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
  const { language } = useLanguage()
  const colorClass = BG[intent][conflict]
  const statusText = copy[language].status[intent][conflict]
  const hintText = sublabel ?? copy[language].hint[intent][conflict]

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

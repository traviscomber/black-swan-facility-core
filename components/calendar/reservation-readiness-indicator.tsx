"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Readiness = {
  is_ready_for_checkin: boolean | null
  readiness_reason: string | null
}

const REASON_LABELS: Record<string, string> = {
  room_unassigned: "Habitación sin asignar",
  room_not_ready: "Habitación no lista",
  preparation_missing: "Preparación no creada",
  preparation_pending: "Preparación pendiente",
  inspection_missing: "Inspección no creada",
  inspection_pending: "Inspección pendiente",
  inspection_not_approved: "Inspección no aprobada",
  inspection_not_verified: "Inspección sin verificar",
  ready: "Habitación lista",
}

export function ReservationReadinessIndicator({ reservationId }: { reservationId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [readiness, setReadiness] = useState<Readiness | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("reservation_room_readiness")
      .select("is_ready_for_checkin, readiness_reason")
      .eq("reservation_id", reservationId)
      .maybeSingle()

    setReadiness((data as Readiness | null) ?? null)
  }, [reservationId, supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`reservation-readiness-${reservationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks", filter: `reservation_id=eq.${reservationId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `id=eq.${reservationId}` }, () => void load())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [load, reservationId, supabase])

  if (!readiness) return null

  const ready = Boolean(readiness.is_ready_for_checkin)
  const reason = readiness.readiness_reason ?? "room_not_ready"
  const label = REASON_LABELS[reason] ?? "Estado de preparación pendiente"
  const Icon = ready ? CheckCircle2 : reason.includes("pending") ? Clock3 : ShieldAlert

  return (
    <span
      title={label}
      className={`absolute bottom-1 left-1 z-20 inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[9px] font-bold shadow-sm ${ready ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-24 truncate">{ready ? "Lista" : "No lista"}</span>
    </span>
  )
}

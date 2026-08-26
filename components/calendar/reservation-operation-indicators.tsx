"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BedDouble, CheckCircle2, CircleDollarSign, ConciergeBell, ShieldAlert, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage, type Language } from "@/lib/hooks/use-language"

type OperationSummary = {
  housekeeping: { total: number; open: number; critical: number }
  hospitality: { total: number; open: number; critical: number }
  services: { total: number; open: number }
  payments: { total: number; confirmed: number }
  readiness: { ready: boolean; reason: string | null }
}

const EMPTY_SUMMARY: OperationSummary = {
  housekeeping: { total: 0, open: 0, critical: 0 },
  hospitality: { total: 0, open: 0, critical: 0 },
  services: { total: 0, open: 0 },
  payments: { total: 0, confirmed: 0 },
  readiness: { ready: false, reason: null },
}

const copy = {
  en: {
    related: "Related operations",
    readinessFallback: "Preparation status pending",
    readiness: {
      room_unassigned: "Room unassigned",
      room_not_ready: "Room not ready",
      preparation_missing: "Preparation not created",
      preparation_pending: "Preparation pending",
      inspection_missing: "Inspection not created",
      inspection_pending: "Inspection pending",
      inspection_not_approved: "Inspection not approved",
      inspection_not_verified: "Inspection not verified",
      ready: "Room ready for check-in",
    },
    housekeeping: (count: number) => `${count} pending Housekeeping task${count === 1 ? "" : "s"}`,
    hospitality: (count: number) => `${count} pending Hospitality request${count === 1 ? "" : "s"}`,
    services: (count: number) => `${count} pending service${count === 1 ? "" : "s"}`,
    payments: (confirmed: number, total: number) => `${confirmed} of ${total} payment${total === 1 ? "" : "s"} confirmed`,
  },
  es: {
    related: "Operaciones relacionadas",
    readinessFallback: "Estado de preparación pendiente",
    readiness: {
      room_unassigned: "Habitación sin asignar",
      room_not_ready: "Habitación no lista",
      preparation_missing: "Preparación no creada",
      preparation_pending: "Preparación pendiente",
      inspection_missing: "Inspección no creada",
      inspection_pending: "Inspección pendiente",
      inspection_not_approved: "Inspección no aprobada",
      inspection_not_verified: "Inspección sin verificar",
      ready: "Habitación lista para check-in",
    },
    housekeeping: (count: number) => `${count} tarea${count === 1 ? "" : "s"} de Housekeeping pendiente${count === 1 ? "" : "s"}`,
    hospitality: (count: number) => `${count} solicitud${count === 1 ? "" : "es"} de Hospitality pendiente${count === 1 ? "" : "s"}`,
    services: (count: number) => `${count} servicio${count === 1 ? "" : "s"} pendiente${count === 1 ? "" : "s"}`,
    payments: (confirmed: number, total: number) => `${confirmed} de ${total} pago${total === 1 ? "" : "s"} confirmado${total === 1 ? "" : "s"}`,
  },
  de: {
    related: "Verknüpfte Vorgänge",
    readinessFallback: "Vorbereitungsstatus ausstehend",
    readiness: {
      room_unassigned: "Zimmer nicht zugewiesen",
      room_not_ready: "Zimmer nicht bereit",
      preparation_missing: "Vorbereitung nicht erstellt",
      preparation_pending: "Vorbereitung ausstehend",
      inspection_missing: "Prüfung nicht erstellt",
      inspection_pending: "Prüfung ausstehend",
      inspection_not_approved: "Prüfung nicht freigegeben",
      inspection_not_verified: "Prüfung nicht verifiziert",
      ready: "Zimmer bereit zum Check-in",
    },
    housekeeping: (count: number) => `${count} offene Housekeeping-Aufgabe${count === 1 ? "" : "n"}`,
    hospitality: (count: number) => `${count} offene Hospitality-Anfrage${count === 1 ? "" : "n"}`,
    services: (count: number) => `${count} offener Service${count === 1 ? "" : "s"}`,
    payments: (confirmed: number, total: number) => `${confirmed} von ${total} Zahlung${total === 1 ? "" : "en"} bestätigt`,
  },
} satisfies Record<Language, {
  related: string
  readinessFallback: string
  readiness: Record<string, string>
  housekeeping: (count: number) => string
  hospitality: (count: number) => string
  services: (count: number) => string
  payments: (confirmed: number, total: number) => string
}>

function isOpenStatus(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase()
  return !["completed", "complete", "closed", "cancelled", "canceled", "rejected", "paid", "verified"].includes(value)
}

function isCritical(priority: string | null | undefined, dueAt?: string | null) {
  const urgent = ["critical", "urgent", "high"].includes((priority ?? "").toLowerCase())
  const overdue = Boolean(dueAt && new Date(dueAt).getTime() < Date.now())
  return urgent || overdue
}

export function ReservationOperationIndicators({ reservationId }: { reservationId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const c = copy[language]
  const [summary, setSummary] = useState<OperationSummary>(EMPTY_SUMMARY)

  const load = useCallback(async () => {
    const [housekeepingResult, hospitalityResult, extrasResult, paymentsResult, readinessResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("status, priority, due_at").eq("reservation_id", reservationId),
      supabase.from("hospitality_requests").select("status, priority, due_at").eq("reservation_id", reservationId),
      supabase.from("reservation_extras").select("service_status").eq("reservation_id", reservationId),
      supabase.from("payments").select("payment_status").eq("reservation_id", reservationId).is("reversed_at", null),
      supabase.from("reservation_room_readiness").select("is_ready_for_checkin, readiness_reason").eq("reservation_id", reservationId).maybeSingle(),
    ])

    const housekeeping = housekeepingResult.data ?? []
    const hospitality = hospitalityResult.data ?? []
    const services = extrasResult.data ?? []
    const payments = paymentsResult.data ?? []
    const readiness = readinessResult.data as { is_ready_for_checkin?: boolean | null; readiness_reason?: string | null } | null

    setSummary({
      housekeeping: {
        total: housekeeping.length,
        open: housekeeping.filter((item) => isOpenStatus(item.status)).length,
        critical: housekeeping.filter((item) => isOpenStatus(item.status) && isCritical(item.priority, item.due_at)).length,
      },
      hospitality: {
        total: hospitality.length,
        open: hospitality.filter((item) => isOpenStatus(item.status)).length,
        critical: hospitality.filter((item) => isOpenStatus(item.status) && isCritical(item.priority, item.due_at)).length,
      },
      services: {
        total: services.length,
        open: services.filter((item) => isOpenStatus(item.service_status)).length,
      },
      payments: {
        total: payments.length,
        confirmed: payments.filter((item) => ["paid", "completed", "verified", "approved"].includes((item.payment_status ?? "").toLowerCase())).length,
      },
      readiness: {
        ready: Boolean(readiness?.is_ready_for_checkin),
        reason: readiness?.readiness_reason ?? null,
      },
    })
  }, [reservationId, supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`booking-indicators-${reservationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks", filter: `reservation_id=eq.${reservationId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `id=eq.${reservationId}` }, () => void load())
      .subscribe()
    const refresh = () => void load()
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      void supabase.removeChannel(channel)
    }
  }, [load, reservationId, supabase])

  const readinessReason = summary.readiness.reason ?? "room_not_ready"
  const readinessLabels: Record<string, string> = c.readiness
  const indicators = [
    {
      key: "readiness",
      Icon: summary.readiness.ready ? CheckCircle2 : ShieldAlert,
      visible: true,
      label: readinessLabels[readinessReason] ?? c.readinessFallback,
      className: summary.readiness.ready ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900",
      count: 0,
    },
    {
      key: "housekeeping",
      Icon: BedDouble,
      visible: summary.housekeeping.total > 0,
      label: c.housekeeping(summary.housekeeping.open),
      className: summary.housekeeping.critical > 0 ? "bg-red-500 text-white" : summary.housekeeping.open > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900",
      count: summary.housekeeping.open,
    },
    {
      key: "hospitality",
      Icon: ConciergeBell,
      visible: summary.hospitality.total > 0,
      label: c.hospitality(summary.hospitality.open),
      className: summary.hospitality.critical > 0 ? "bg-red-500 text-white" : summary.hospitality.open > 0 ? "bg-sky-100 text-sky-900" : "bg-emerald-100 text-emerald-900",
      count: summary.hospitality.open,
    },
    {
      key: "services",
      Icon: Sparkles,
      visible: summary.services.total > 0,
      label: c.services(summary.services.open),
      className: summary.services.open > 0 ? "bg-violet-100 text-violet-900" : "bg-emerald-100 text-emerald-900",
      count: summary.services.open,
    },
    {
      key: "payments",
      Icon: CircleDollarSign,
      visible: summary.payments.total > 0,
      label: c.payments(summary.payments.confirmed, summary.payments.total),
      className: summary.payments.confirmed < summary.payments.total ? "bg-orange-100 text-orange-900" : "bg-emerald-100 text-emerald-900",
      count: Math.max(0, summary.payments.total - summary.payments.confirmed),
    },
  ]

  return (
    <span className="absolute bottom-1 right-1 z-20 flex items-center gap-1" aria-label={c.related}>
      {indicators.filter((indicator) => indicator.visible).map(({ key, Icon, label, className, count }) => (
        <span key={key} title={label} className={`inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-sm px-1 text-[10px] font-bold shadow-sm ${className}`}>
          <Icon className="h-3 w-3" />
          {count > 0 && <span>{count}</span>}
        </span>
      ))}
    </span>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { BedDouble, CalendarDays, CheckCircle2, CircleDollarSign, ConciergeBell, ExternalLink, Loader2, LogIn, LogOut, Sparkles, TriangleAlert, Users, Wrench } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { CalendarEvent } from "@/components/calendar/timeline-row"
import { useLanguage, type Language } from "@/lib/hooks/use-language"

interface InspectorData {
  guestName: string
  guestEmail: string | null
  guestPhone: string | null
  guests: number
  paymentStatus: string
  totalAmount: number
  roomNumber: string | null
  housekeeping: number
  hospitality: number
  services: number
  activities: number
  issues: number
  maintenance: number
}

interface OperationalException {
  domain: string
  source_id: string
  title: string
  status: string
  priority: string
  due_at: string | null
  exception_state: "open" | "overdue" | "resolved"
  blocks_check_in: boolean
  blocks_check_out: boolean
  detail: string | null
}

type InspectorCopy = {
  reservation: string; loading: string; room: string; roomShort: string; unassigned: string; guests: string; total: string; payment: string
  related: string; services: string; activities: string; issues: string; maintenance: string; exceptions: string; noExceptions: string
  blocksCheckin: string; overdue: string; status: string; due: string; contact: string; confirm: string; checkin: string; checkout: string; openFull: string
  dataNote: string; confirmedToast: string; checkinToast: string; checkoutToast: string
  statuses: Record<string, string>
  domains: Record<string, string>
}

const copy: Record<Language, InspectorCopy> = {
  en: {
    reservation: "Reservation", loading: "Loading reservation…", room: "Room", roomShort: "Room", unassigned: "Unassigned", guests: "Guests", total: "Total", payment: "Payment",
    related: "Related operations", services: "Services", activities: "Activities", issues: "Issues", maintenance: "Maintenance", exceptions: "Operational exceptions", noExceptions: "No open operational exceptions.",
    blocksCheckin: "blocks check-in", overdue: "overdue", status: "Status", due: "Due", contact: "Contact", confirm: "Confirm reservation", checkin: "Register check-in", checkout: "Register check-out", openFull: "Open full record",
    dataNote: "Values, statuses and exceptions come from real operational data.", confirmedToast: "Reservation confirmed", checkinToast: "Check-in registered", checkoutToast: "Check-out registered",
    statuses: { checked_in: "Checked in", checked_out: "Completed", confirmed: "Confirmed", cancelled: "Cancelled", pending: "Pending" },
    domains: { housekeeping: "Housekeeping", hospitality: "Hospitality", maintenance: "Maintenance", issue: "Issue" },
  },
  es: {
    reservation: "Reserva", loading: "Cargando reserva…", room: "Habitación", roomShort: "Hab.", unassigned: "Sin asignar", guests: "Huéspedes", total: "Total", payment: "Pago",
    related: "Operación relacionada", services: "Servicios", activities: "Actividades", issues: "Incidencias", maintenance: "Mantenimiento", exceptions: "Excepciones operacionales", noExceptions: "Sin excepciones operacionales abiertas.",
    blocksCheckin: "bloquea check-in", overdue: "vencida", status: "Estado", due: "Objetivo", contact: "Contacto", confirm: "Confirmar reserva", checkin: "Registrar check-in", checkout: "Registrar check-out", openFull: "Abrir ficha completa",
    dataNote: "Los valores, estados y excepciones provienen de datos operacionales reales.", confirmedToast: "Reserva confirmada", checkinToast: "Check-in registrado", checkoutToast: "Check-out registrado",
    statuses: { checked_in: "Hospedado", checked_out: "Finalizada", confirmed: "Confirmada", cancelled: "Cancelada", pending: "Pendiente" },
    domains: { housekeeping: "Housekeeping", hospitality: "Hospitality", maintenance: "Mantenimiento", issue: "Incidencia" },
  },
  de: {
    reservation: "Reservierung", loading: "Reservierung wird geladen…", room: "Zimmer", roomShort: "Zi.", unassigned: "Nicht zugewiesen", guests: "Gäste", total: "Gesamt", payment: "Zahlung",
    related: "Verknüpfte Vorgänge", services: "Services", activities: "Aktivitäten", issues: "Vorfälle", maintenance: "Wartung", exceptions: "Betriebliche Ausnahmen", noExceptions: "Keine offenen betrieblichen Ausnahmen.",
    blocksCheckin: "blockiert Check-in", overdue: "überfällig", status: "Status", due: "Fällig", contact: "Kontakt", confirm: "Reservierung bestätigen", checkin: "Check-in erfassen", checkout: "Check-out erfassen", openFull: "Vollständigen Datensatz öffnen",
    dataNote: "Werte, Status und Ausnahmen stammen aus realen Betriebsdaten.", confirmedToast: "Reservierung bestätigt", checkinToast: "Check-in erfasst", checkoutToast: "Check-out erfasst",
    statuses: { checked_in: "Eingecheckt", checked_out: "Abgeschlossen", confirmed: "Bestätigt", cancelled: "Storniert", pending: "Ausstehend" },
    domains: { housekeeping: "Housekeeping", hospitality: "Hospitality", maintenance: "Wartung", issue: "Vorfall" },
  },
}

const dateLocales: Record<Language, typeof enUS> = { en: enUS, es, de }

function emptyData(reservationLabel: string): InspectorData {
  return { guestName: reservationLabel, guestEmail: null, guestPhone: null, guests: 0, paymentStatus: "pending", totalAmount: 0, roomNumber: null, housekeeping: 0, hospitality: 0, services: 0, activities: 0, issues: 0, maintenance: 0 }
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

function normalizedStatus(value: string | null | undefined) {
  return (value ?? "pending").replaceAll("-", "_")
}

export function ReservationQuickInspector({ reservation, open, onOpenChange, onOpenFull }: {
  reservation: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenFull: (reservation: CalendarEvent) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const c = copy[language]
  const dateLocale = dateLocales[language]
  const [data, setData] = useState<InspectorData>(() => emptyData(c.reservation))
  const [exceptions, setExceptions] = useState<OperationalException[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [currentStatus, setCurrentStatus] = useState("pending")

  const statusLabel = useCallback((value: string | null | undefined) => {
    const status = normalizedStatus(value)
    return c.statuses[status] ?? c.statuses.pending
  }, [c.statuses])

  const domainLabel = useCallback((domain: string) => c.domains[domain] ?? domain, [c.domains])

  const load = useCallback(async () => {
    if (!reservation) return
    setLoading(true)
    const [reservationResult, housekeeping, hospitality, services, activities, issues, maintenance, exceptionResult] = await Promise.all([
      supabase.from("reservations").select("guest_name, guest_email, guest_phone, num_guests, payment_status, total_amount, status, room:rooms(room_number)").eq("id", reservation.event_id).maybeSingle(),
      supabase.from("housekeeping_tasks").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("hospitality_requests").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,closed,cancelled)"),
      supabase.from("reservation_extras").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("service_status", "in", "(completed,cancelled)"),
      supabase.from("reservation_activity_bookings").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("issues").select("id", { count: "exact", head: true }).eq("related_item_type", "reservation").eq("related_item_id", reservation.event_id).not("status", "in", "(resolved,closed,cancelled)"),
      supabase.from("maintenance_tasks").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("reservation_operational_exceptions").select("domain, source_id, title, status, priority, due_at, exception_state, blocks_check_in, blocks_check_out, detail").eq("reservation_id", reservation.event_id),
    ])

    if (reservationResult.error) {
      toast.error(reservationResult.error.message)
      setLoading(false)
      return
    }

    const row = reservationResult.data as { guest_name?: string; guest_email?: string | null; guest_phone?: string | null; num_guests?: number | null; payment_status?: string | null; total_amount?: number | null; status?: string | null; room?: { room_number?: string | null } | Array<{ room_number?: string | null }> | null } | null
    const room = Array.isArray(row?.room) ? row?.room[0] : row?.room
    setCurrentStatus(normalizedStatus(row?.status ?? reservation.status))
    setData({
      guestName: row?.guest_name ?? reservation.guest_name ?? reservation.label,
      guestEmail: row?.guest_email ?? null,
      guestPhone: row?.guest_phone ?? null,
      guests: Number(row?.num_guests ?? 0),
      paymentStatus: row?.payment_status ?? "pending",
      totalAmount: Number(row?.total_amount ?? reservation.total_amount ?? 0),
      roomNumber: room?.room_number ?? null,
      housekeeping: housekeeping.count ?? 0,
      hospitality: hospitality.count ?? 0,
      services: services.count ?? 0,
      activities: activities.count ?? 0,
      issues: issues.count ?? 0,
      maintenance: maintenance.count ?? 0,
    })
    const ordered = ((exceptionResult.data ?? []) as OperationalException[]).sort((a, b) => {
      if (a.blocks_check_in !== b.blocks_check_in) return a.blocks_check_in ? -1 : 1
      if (a.exception_state !== b.exception_state) return a.exception_state === "overdue" ? -1 : 1
      return String(a.due_at ?? "").localeCompare(String(b.due_at ?? ""))
    })
    setExceptions(ordered)
    setLoading(false)
  }, [reservation, supabase])

  useEffect(() => { if (open) void load() }, [load, open])
  useEffect(() => {
    if (!open) {
      setData(emptyData(c.reservation))
      setExceptions([])
      setCurrentStatus("pending")
    }
  }, [c.reservation, open])

  async function updateStatus(nextStatus: "confirmed" | "checked_in" | "checked_out") {
    if (!reservation || updating) return
    setUpdating(true)
    const { error } = await supabase.from("reservations").update({ status: nextStatus }).eq("id", reservation.event_id)
    if (error) toast.error(error.message)
    else {
      setCurrentStatus(nextStatus)
      toast.success(nextStatus === "confirmed" ? c.confirmedToast : nextStatus === "checked_in" ? c.checkinToast : c.checkoutToast)
      await load()
    }
    setUpdating(false)
  }

  const counters = [
    { label: "Housekeeping", value: data.housekeeping, Icon: BedDouble },
    { label: "Hospitality", value: data.hospitality, Icon: ConciergeBell },
    { label: c.services, value: data.services, Icon: Sparkles },
    { label: c.activities, value: data.activities, Icon: CalendarDays },
    { label: c.issues, value: data.issues, Icon: TriangleAlert },
    { label: c.maintenance, value: data.maintenance, Icon: Wrench },
  ]
  const blockingExceptions = exceptions.filter((item) => item.blocks_check_in)
  const overdueExceptions = exceptions.filter((item) => item.exception_state === "overdue")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle>{data.guestName}</SheetTitle>
              <SheetDescription>{reservation ? `${format(parseISO(reservation.starts_on), "dd MMM", { locale: dateLocale })} → ${format(parseISO(reservation.ends_on), "dd MMM yyyy", { locale: dateLocale })}` : ""}</SheetDescription>
            </div>
            <Badge variant={currentStatus === "checked_in" ? "default" : "secondary"}>{statusLabel(currentStatus)}</Badge>
          </div>
        </SheetHeader>

        {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{c.loading}</div> : (
          <div className="space-y-5 p-5">
            <section className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <div><span className="block text-xs text-muted-foreground">{c.room}</span><strong>{data.roomNumber ? `${c.roomShort} ${data.roomNumber}` : c.unassigned}</strong></div>
              <div><span className="block text-xs text-muted-foreground">{c.guests}</span><strong className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{data.guests}</strong></div>
              <div><span className="block text-xs text-muted-foreground">{c.total}</span><strong>{formatClp(data.totalAmount)}</strong></div>
              <div><span className="block text-xs text-muted-foreground">{c.payment}</span><strong>{data.paymentStatus}</strong></div>
            </section>

            <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.related}</h3><div className="grid grid-cols-2 gap-2">{counters.map(({ label, value, Icon }) => <div key={label} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${value > 0 ? "bg-background" : "bg-muted/20 text-muted-foreground"}`}><Icon className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{label}</span><strong>{value}</strong></div>)}</div></section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.exceptions}</h3><div className="flex gap-1">{blockingExceptions.length > 0 && <Badge variant="destructive">{blockingExceptions.length} {c.blocksCheckin}</Badge>}{overdueExceptions.length > 0 && <Badge variant="outline">{overdueExceptions.length} {c.overdue}</Badge>}</div></div>
              {exceptions.length === 0 ? <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-700">{c.noExceptions}</div> : <div className="space-y-2">{exceptions.slice(0, 8).map((item) => <div key={`${item.domain}-${item.source_id}`} className={`rounded-md border p-3 text-xs ${item.blocks_check_in ? "border-red-500/30 bg-red-500/10" : item.exception_state === "overdue" ? "border-amber-500/30 bg-amber-500/10" : "bg-muted/20"}`}><div className="flex items-start gap-2"><TriangleAlert className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.blocks_check_in ? "text-red-600" : item.exception_state === "overdue" ? "text-amber-600" : "text-muted-foreground"}`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate">{item.title}</strong><span className="shrink-0 text-[10px] uppercase text-muted-foreground">{domainLabel(item.domain)}</span></div><div className="mt-1 text-muted-foreground">{item.detail || `${c.status}: ${item.status}`}</div><div className="mt-1 flex flex-wrap gap-2 text-[10px]">{item.blocks_check_in && <span className="font-semibold text-red-700">{c.blocksCheckin}</span>}{item.exception_state === "overdue" && <span className="font-semibold text-amber-700">{c.overdue}</span>}{item.due_at && <span>{c.due}: {format(parseISO(item.due_at), "dd MMM HH:mm", { locale: dateLocale })}</span>}</div></div></div></div>)}</div>}
            </section>

            {(data.guestEmail || data.guestPhone) && <section className="rounded-lg border p-4 text-sm"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.contact}</h3>{data.guestEmail && <div className="truncate">{data.guestEmail}</div>}{data.guestPhone && <div>{data.guestPhone}</div>}</section>}

            <section className="space-y-2 border-t pt-4">
              {currentStatus === "pending" && <Button className="w-full" onClick={() => void updateStatus("confirmed")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{c.confirm}</Button>}
              {currentStatus === "confirmed" && <Button className="w-full" onClick={() => void updateStatus("checked_in")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}{c.checkin}</Button>}
              {currentStatus === "checked_in" && <Button className="w-full" onClick={() => void updateStatus("checked_out")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}{c.checkout}</Button>}
              <Button className="w-full" variant="outline" onClick={() => reservation && onOpenFull(reservation)} disabled={!reservation || updating}><ExternalLink className="mr-2 h-4 w-4" />{c.openFull}</Button>
            </section>
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><CircleDollarSign className="h-3 w-3" />{c.dataNote}</div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

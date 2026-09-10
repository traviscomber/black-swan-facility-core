"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { BedDouble, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardList, ConciergeBell, ExternalLink, Loader2, LogIn, LogOut, Mail, Phone, Sparkles, TriangleAlert, Truck, Users, Wrench } from "lucide-react"
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
  specialRequests: string | null
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

interface ReservationLogistics {
  id: string
  direction: string
  hub: string
  anchor_at: string | null
  status: string
  notes: string | null
}

interface HandoverItem {
  id: string
  priority: string
  title: string
  detail: string | null
  due_at: string | null
  status: string
}

const copy = {
  en: {
    reservation: "Stay cockpit", loading: "Loading stay…", room: "Room", roomShort: "Room", unassigned: "Unassigned", guests: "Guests", total: "Total", payment: "Payment",
    related: "Live operations", services: "Services", activities: "Activities", issues: "Issues", maintenance: "Maintenance", exceptions: "Attention required", noExceptions: "No open operational exceptions.",
    blocksCheckin: "blocks check-in", overdue: "overdue", status: "Status", due: "Due", contact: "Guest contact", confirm: "Confirm reservation", checkin: "Register check-in", checkout: "Register check-out", openFull: "Open full record",
    logistics: "Arrival / departure logistics", noLogistics: "No active logistics for this stay.", handover: "Shift handover", noHandover: "No handover items linked to this stay.", specialRequests: "Special requests", lifecycle: "Stay lifecycle",
    dataNote: "Loaded only when the booking is opened; no Vercel server function is used.", confirmedToast: "Reservation confirmed", checkinToast: "Check-in registered", checkoutToast: "Check-out registered",
    statuses: { checked_in: "Checked in", checked_out: "Completed", confirmed: "Confirmed", cancelled: "Cancelled", pending: "Pending" },
    domains: { housekeeping: "Housekeeping", hospitality: "Hospitality", maintenance: "Maintenance", issue: "Issue" },
    stages: ["Booked", "Ready", "In stay", "Closed"],
  },
  es: {
    reservation: "Cockpit de estadía", loading: "Cargando estadía…", room: "Habitación", roomShort: "Hab.", unassigned: "Sin asignar", guests: "Huéspedes", total: "Total", payment: "Pago",
    related: "Operación en vivo", services: "Servicios", activities: "Actividades", issues: "Incidencias", maintenance: "Mantenimiento", exceptions: "Requiere atención", noExceptions: "Sin excepciones operacionales abiertas.",
    blocksCheckin: "bloquea check-in", overdue: "vencida", status: "Estado", due: "Objetivo", contact: "Contacto huésped", confirm: "Confirmar reserva", checkin: "Registrar check-in", checkout: "Registrar check-out", openFull: "Abrir ficha completa",
    logistics: "Logística llegada / salida", noLogistics: "Sin logística activa para esta estadía.", handover: "Entrega de turno", noHandover: "Sin pendientes de turno ligados a esta estadía.", specialRequests: "Solicitudes especiales", lifecycle: "Ciclo de estadía",
    dataNote: "Se carga sólo al abrir el booking; no utiliza funciones serverless de Vercel.", confirmedToast: "Reserva confirmada", checkinToast: "Check-in registrado", checkoutToast: "Check-out registrado",
    statuses: { checked_in: "Hospedado", checked_out: "Finalizada", confirmed: "Confirmada", cancelled: "Cancelada", pending: "Pendiente" },
    domains: { housekeeping: "Housekeeping", hospitality: "Hospitality", maintenance: "Mantenimiento", issue: "Incidencia" },
    stages: ["Reserva", "Preparación", "Estadía", "Cierre"],
  },
  de: {
    reservation: "Aufenthalts-Cockpit", loading: "Aufenthalt wird geladen…", room: "Zimmer", roomShort: "Zi.", unassigned: "Nicht zugewiesen", guests: "Gäste", total: "Gesamt", payment: "Zahlung",
    related: "Laufender Betrieb", services: "Services", activities: "Aktivitäten", issues: "Vorfälle", maintenance: "Wartung", exceptions: "Aufmerksamkeit erforderlich", noExceptions: "Keine offenen betrieblichen Ausnahmen.",
    blocksCheckin: "blockiert Check-in", overdue: "überfällig", status: "Status", due: "Fällig", contact: "Gastkontakt", confirm: "Reservierung bestätigen", checkin: "Check-in erfassen", checkout: "Check-out erfassen", openFull: "Vollständigen Datensatz öffnen",
    logistics: "An-/Abreise-Logistik", noLogistics: "Keine aktive Logistik für diesen Aufenthalt.", handover: "Schichtübergabe", noHandover: "Keine Übergabepunkte für diesen Aufenthalt.", specialRequests: "Besondere Wünsche", lifecycle: "Aufenthaltszyklus",
    dataNote: "Wird nur beim Öffnen der Buchung geladen; keine Vercel-Serverfunktion.", confirmedToast: "Reservierung bestätigt", checkinToast: "Check-in erfasst", checkoutToast: "Check-out erfasst",
    statuses: { checked_in: "Eingecheckt", checked_out: "Abgeschlossen", confirmed: "Bestätigt", cancelled: "Storniert", pending: "Ausstehend" },
    domains: { housekeeping: "Housekeeping", hospitality: "Hospitality", maintenance: "Wartung", issue: "Vorfall" },
    stages: ["Gebucht", "Bereit", "Aufenthalt", "Abschluss"],
  },
} satisfies Record<Language, any>

const dateLocales = { en: enUS, es, de } satisfies Record<Language, typeof enUS>

function emptyData(reservationLabel: string): InspectorData {
  return { guestName: reservationLabel, guestEmail: null, guestPhone: null, guests: 0, paymentStatus: "pending", totalAmount: 0, roomNumber: null, specialRequests: null, housekeeping: 0, hospitality: 0, services: 0, activities: 0, issues: 0, maintenance: 0 }
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

function normalizedStatus(value: string | null | undefined) {
  return (value ?? "pending").replaceAll("-", "_")
}

function stageIndex(status: string) {
  if (status === "checked_out") return 3
  if (status === "checked_in") return 2
  if (status === "confirmed") return 1
  return 0
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
  const [logistics, setLogistics] = useState<ReservationLogistics[]>([])
  const [handoverItems, setHandoverItems] = useState<HandoverItem[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [currentStatus, setCurrentStatus] = useState("pending")
  const statusLabels: Record<string, string> = c.statuses
  const domainLabels: Record<string, string> = c.domains

  const statusLabel = useCallback((value: string | null | undefined) => {
    const status = normalizedStatus(value)
    return statusLabels[status] ?? statusLabels.pending
  }, [statusLabels])

  const domainLabel = useCallback((domain: string) => domainLabels[domain] ?? domain, [domainLabels])

  const load = useCallback(async () => {
    if (!reservation) return
    setLoading(true)
    const [reservationResult, housekeeping, hospitality, services, activities, issues, maintenance, exceptionResult, logisticsResult, handoverResult] = await Promise.all([
      supabase.from("reservations").select("guest_name, guest_email, guest_phone, num_guests, payment_status, total_amount, status, special_requests, room:rooms(room_number)").eq("id", reservation.event_id).maybeSingle(),
      supabase.from("housekeeping_tasks").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("hospitality_requests").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,closed,cancelled)"),
      supabase.from("reservation_extras").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("service_status", "in", "(completed,cancelled)"),
      supabase.from("reservation_activity_bookings").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("issues").select("id", { count: "exact", head: true }).eq("related_item_type", "reservation").eq("related_item_id", reservation.event_id).not("status", "in", "(resolved,closed,cancelled)"),
      supabase.from("maintenance_tasks").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("reservation_operational_exceptions").select("domain, source_id, title, status, priority, due_at, exception_state, blocks_check_in, blocks_check_out, detail").eq("reservation_id", reservation.event_id),
      supabase.from("reservation_logistics").select("id, direction, hub, anchor_at, status, notes").eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)").order("anchor_at", { ascending: true, nullsFirst: false }),
      supabase.from("booking_handover_items").select("id, priority, title, detail, due_at, status").eq("reservation_id", reservation.event_id).not("status", "in", "(resolved,closed)").order("due_at", { ascending: true, nullsFirst: false }),
    ])

    const row = reservationResult.data as { guest_name?: string; guest_email?: string | null; guest_phone?: string | null; num_guests?: number | null; payment_status?: string | null; total_amount?: number | null; status?: string | null; special_requests?: string | null; room?: { room_number?: string | null } | Array<{ room_number?: string | null }> | null } | null
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
      specialRequests: row?.special_requests ?? null,
      housekeeping: housekeeping.count ?? 0,
      hospitality: hospitality.count ?? 0,
      services: services.count ?? 0,
      activities: activities.count ?? 0,
      issues: issues.count ?? 0,
      maintenance: maintenance.count ?? 0,
    })
    setExceptions(((exceptionResult.data ?? []) as OperationalException[]).sort((a, b) => Number(b.blocks_check_in) - Number(a.blocks_check_in) || String(a.due_at ?? "").localeCompare(String(b.due_at ?? ""))))
    setLogistics((logisticsResult.data ?? []) as ReservationLogistics[])
    setHandoverItems((handoverResult.data ?? []) as HandoverItem[])
    setLoading(false)
  }, [reservation, supabase])

  useEffect(() => { if (open) void load() }, [load, open])

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
  const activeStage = stageIndex(currentStatus)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{c.reservation}</div>
              <SheetTitle className="truncate">{data.guestName}</SheetTitle>
              <SheetDescription>{reservation ? `${format(parseISO(reservation.starts_on), "dd MMM", { locale: dateLocale })} → ${format(parseISO(reservation.ends_on), "dd MMM yyyy", { locale: dateLocale })}` : ""}</SheetDescription>
            </div>
            <Badge variant={currentStatus === "checked_in" ? "default" : "secondary"}>{statusLabel(currentStatus)}</Badge>
          </div>
        </SheetHeader>

        {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{c.loading}</div> : (
          <div className="space-y-4 p-5">
            <section className="grid grid-cols-4 gap-1 border-b pb-4">
              {c.stages.map((label: string, index: number) => <div key={label} className="min-w-0"><div className={`h-1 ${index <= activeStage ? "bg-primary" : "bg-muted"}`} /><div className={`mt-1 truncate text-[10px] ${index === activeStage ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</div></div>)}
            </section>

            <section className="grid grid-cols-2 gap-x-4 gap-y-3 border-b pb-4 text-sm">
              <div><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{c.room}</span><strong>{data.roomNumber ? `${c.roomShort} ${data.roomNumber}` : c.unassigned}</strong></div>
              <div><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{c.guests}</span><strong className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{data.guests}</strong></div>
              <div><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{c.total}</span><strong>{formatClp(data.totalAmount)}</strong></div>
              <div><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{c.payment}</span><strong>{data.paymentStatus}</strong></div>
            </section>

            {data.specialRequests && <section className="border-b pb-4"><h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.specialRequests}</h3><p className="text-sm leading-relaxed">{data.specialRequests}</p></section>}

            <section className="border-b pb-4"><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.related}</h3><div className="grid grid-cols-3 gap-1.5">{counters.map(({ label, value, Icon }) => <div key={label} className={`flex min-w-0 items-center gap-1.5 border px-2 py-2 text-xs ${value > 0 ? "bg-background" : "text-muted-foreground"}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{label}</span><strong>{value}</strong></div>)}</div></section>

            <section className="border-b pb-4">
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.logistics}</h3><Truck className="h-3.5 w-3.5 text-muted-foreground" /></div>
              {logistics.length === 0 ? <p className="text-xs text-muted-foreground">{c.noLogistics}</p> : <div className="space-y-1.5">{logistics.slice(0, 4).map((item) => <div key={item.id} className="border-l-2 border-primary/50 pl-3 text-xs"><div className="flex items-center justify-between gap-2"><strong className="capitalize">{item.direction} · {item.hub}</strong><span className="text-[10px] uppercase text-muted-foreground">{item.status}</span></div>{item.anchor_at && <div className="mt-0.5 text-muted-foreground">{format(parseISO(item.anchor_at), "dd MMM · HH:mm", { locale: dateLocale })}</div>}{item.notes && <div className="mt-0.5 text-muted-foreground">{item.notes}</div>}</div>)}</div>}
            </section>

            <section className="border-b pb-4">
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.handover}</h3><ClipboardList className="h-3.5 w-3.5 text-muted-foreground" /></div>
              {handoverItems.length === 0 ? <p className="text-xs text-muted-foreground">{c.noHandover}</p> : <div className="space-y-1.5">{handoverItems.slice(0, 4).map((item) => <div key={item.id} className="flex items-start gap-2 text-xs"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.priority === "critical" || item.priority === "high" ? "bg-destructive" : "bg-primary"}`} /><div className="min-w-0"><strong>{item.title}</strong>{item.detail && <div className="text-muted-foreground">{item.detail}</div>}</div></div>)}</div>}
            </section>

            <section className="border-b pb-4">
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.exceptions}</h3><div className="flex gap-1">{blockingExceptions.length > 0 && <Badge variant="destructive">{blockingExceptions.length} {c.blocksCheckin}</Badge>}{overdueExceptions.length > 0 && <Badge variant="outline">{overdueExceptions.length} {c.overdue}</Badge>}</div></div>
              {exceptions.length === 0 ? <div className="text-xs text-muted-foreground">{c.noExceptions}</div> : <div className="space-y-1.5">{exceptions.slice(0, 6).map((item) => <div key={`${item.domain}-${item.source_id}`} className={`border-l-2 pl-3 text-xs ${item.blocks_check_in ? "border-red-500" : item.exception_state === "overdue" ? "border-amber-500" : "border-muted-foreground/30"}`}><div className="flex items-start justify-between gap-2"><strong>{item.title}</strong><span className="shrink-0 text-[10px] uppercase text-muted-foreground">{domainLabel(item.domain)}</span></div><div className="text-muted-foreground">{item.detail || `${c.status}: ${item.status}`}</div></div>)}</div>}
            </section>

            {(data.guestEmail || data.guestPhone) && <section className="border-b pb-4"><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.contact}</h3><div className="space-y-1 text-sm">{data.guestEmail && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="truncate">{data.guestEmail}</span></div>}{data.guestPhone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{data.guestPhone}</span></div>}</div></section>}

            <section className="space-y-2 pt-1">
              {currentStatus === "pending" && <Button className="w-full" onClick={() => void updateStatus("confirmed")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{c.confirm}</Button>}
              {currentStatus === "confirmed" && <Button className="w-full" onClick={() => void updateStatus("checked_in")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}{c.checkin}</Button>}
              {currentStatus === "checked_in" && <Button className="w-full" onClick={() => void updateStatus("checked_out")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}{c.checkout}</Button>}
              <Button className="w-full" variant="outline" onClick={() => reservation && onOpenFull(reservation)} disabled={!reservation || updating}><ExternalLink className="mr-2 h-4 w-4" />{c.openFull}</Button>
            </section>
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><CircleDollarSign className="h-3 w-3" />{c.dataNote}</div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

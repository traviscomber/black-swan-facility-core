"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { BedDouble, CalendarDays, CheckCircle2, CircleDollarSign, ConciergeBell, ExternalLink, Loader2, LogIn, LogOut, Sparkles, TriangleAlert, Users, Wrench } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { CalendarEvent } from "@/components/calendar/timeline-row"

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

const emptyData: InspectorData = {
  guestName: "Reserva",
  guestEmail: null,
  guestPhone: null,
  guests: 0,
  paymentStatus: "pending",
  totalAmount: 0,
  roomNumber: null,
  housekeeping: 0,
  hospitality: 0,
  services: 0,
  activities: 0,
  issues: 0,
  maintenance: 0,
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

function normalizedStatus(value: string | null | undefined) {
  return (value ?? "pending").replaceAll("-", "_")
}

function statusLabel(value: string | null | undefined) {
  const status = normalizedStatus(value)
  if (status === "checked_in") return "Hospedado"
  if (status === "checked_out") return "Finalizada"
  if (status === "confirmed") return "Confirmada"
  if (status === "cancelled") return "Cancelada"
  return "Pendiente"
}

export function ReservationQuickInspector({
  reservation,
  open,
  onOpenChange,
  onOpenFull,
}: {
  reservation: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenFull: (reservation: CalendarEvent) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<InspectorData>(emptyData)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [currentStatus, setCurrentStatus] = useState("pending")

  const load = useCallback(async () => {
    if (!reservation) return
    setLoading(true)
    const [reservationResult, housekeeping, hospitality, services, activities, issues, maintenance] = await Promise.all([
      supabase.from("reservations").select("guest_name, guest_email, guest_phone, num_guests, payment_status, total_amount, status, room:rooms(room_number)").eq("id", reservation.event_id).maybeSingle(),
      supabase.from("housekeeping_tasks").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("hospitality_requests").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,closed,cancelled)"),
      supabase.from("reservation_extras").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("service_status", "in", "(completed,cancelled)"),
      supabase.from("reservation_activity_bookings").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
      supabase.from("issues").select("id", { count: "exact", head: true }).eq("related_item_type", "reservation").eq("related_item_id", reservation.event_id).not("status", "in", "(resolved,closed,cancelled)"),
      supabase.from("maintenance_tasks").select("id", { count: "exact", head: true }).eq("reservation_id", reservation.event_id).not("status", "in", "(completed,cancelled)"),
    ])
    const row = reservationResult.data as any
    const room = Array.isArray(row?.room) ? row.room[0] : row?.room
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
    setLoading(false)
  }, [reservation, supabase])

  useEffect(() => {
    if (open) void load()
  }, [load, open])

  async function updateStatus(nextStatus: "confirmed" | "checked_in" | "checked_out") {
    if (!reservation || updating) return
    setUpdating(true)
    const { error } = await supabase.from("reservations").update({ status: nextStatus }).eq("id", reservation.event_id)
    if (error) {
      toast.error(error.message)
    } else {
      setCurrentStatus(nextStatus)
      toast.success(nextStatus === "confirmed" ? "Reserva confirmada" : nextStatus === "checked_in" ? "Check-in registrado" : "Check-out registrado")
      await load()
    }
    setUpdating(false)
  }

  const counters = [
    { label: "Housekeeping", value: data.housekeeping, Icon: BedDouble },
    { label: "Hospitality", value: data.hospitality, Icon: ConciergeBell },
    { label: "Servicios", value: data.services, Icon: Sparkles },
    { label: "Actividades", value: data.activities, Icon: CalendarDays },
    { label: "Incidencias", value: data.issues, Icon: TriangleAlert },
    { label: "Mantenimiento", value: data.maintenance, Icon: Wrench },
  ]

  const hasOperationalRisk = data.issues > 0 || data.maintenance > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle>{data.guestName}</SheetTitle>
              <SheetDescription>{reservation ? `${format(parseISO(reservation.starts_on), "dd MMM")} → ${format(parseISO(reservation.ends_on), "dd MMM yyyy")}` : ""}</SheetDescription>
            </div>
            <Badge variant={currentStatus === "checked_in" ? "default" : "secondary"}>{statusLabel(currentStatus)}</Badge>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando reserva…</div>
        ) : (
          <div className="space-y-5 p-5">
            <section className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <div><span className="block text-xs text-muted-foreground">Habitación</span><strong>{data.roomNumber ? `Hab. ${data.roomNumber}` : "Sin asignar"}</strong></div>
              <div><span className="block text-xs text-muted-foreground">Huéspedes</span><strong className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{data.guests}</strong></div>
              <div><span className="block text-xs text-muted-foreground">Total</span><strong>{formatClp(data.totalAmount)}</strong></div>
              <div><span className="block text-xs text-muted-foreground">Pago</span><strong>{data.paymentStatus}</strong></div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operación relacionada</h3>
              <div className="grid grid-cols-2 gap-2">
                {counters.map(({ label, value, Icon }) => (
                  <div key={label} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${value > 0 ? "bg-background" : "bg-muted/20 text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{label}</span><strong>{value}</strong>
                  </div>
                ))}
              </div>
            </section>

            {hasOperationalRisk && currentStatus === "confirmed" && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                Hay incidencias o mantenimiento abiertos. La protección de check-in validará además limpieza, inspección y estado de habitación antes de permitir la llegada.
              </div>
            )}

            {(data.guestEmail || data.guestPhone) && (
              <section className="rounded-lg border p-4 text-sm">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacto</h3>
                {data.guestEmail && <div className="truncate">{data.guestEmail}</div>}
                {data.guestPhone && <div>{data.guestPhone}</div>}
              </section>
            )}

            <section className="space-y-2 border-t pt-4">
              {currentStatus === "pending" && <Button className="w-full" onClick={() => void updateStatus("confirmed")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirmar reserva</Button>}
              {currentStatus === "confirmed" && <Button className="w-full" onClick={() => void updateStatus("checked_in")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}Registrar check-in</Button>}
              {currentStatus === "checked_in" && <Button className="w-full" onClick={() => void updateStatus("checked_out")} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}Registrar check-out</Button>}
              <Button className="w-full" variant="outline" onClick={() => reservation && onOpenFull(reservation)} disabled={!reservation || updating}>
                <ExternalLink className="mr-2 h-4 w-4" />Abrir ficha completa
              </Button>
            </section>
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><CircleDollarSign className="h-3 w-3" />Los valores, estados y conteos provienen de datos operacionales reales.</div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

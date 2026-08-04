"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, DoorOpen, LogOut, PlusCircle, RefreshCw, UserRoundPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Reservation = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  arrival_status: string | null
  room_id: string | null
  bed_id: string | null
}

type Bed = {
  id: string
  bed_number: string
  is_available: boolean
  room: {
    id: string
    room_number: string
    operational_status: string
    location: { name: string } | null
  }
}

type ActionKey = "cancel" | "no_show" | "request_early_check_in" | "request_late_check_out" | "extend_stay" | "early_departure" | "room_move" | "walk_in"

const ACTIONS: Array<{ key: ActionKey; label: string; description: string }> = [
  { key: "cancel", label: "Cancelar reserva", description: "Cierra una reserva antes del inicio y cancela tareas pendientes." },
  { key: "no_show", label: "Registrar no-show", description: "Marca que el huésped no llegó en la fecha prevista." },
  { key: "request_early_check_in", label: "Solicitar early check-in", description: "Registra una llegada anticipada y ajusta la hora estimada." },
  { key: "request_late_check_out", label: "Solicitar late check-out", description: "Registra una salida tardía y su hora estimada." },
  { key: "extend_stay", label: "Extender estadía", description: "Amplía el check-out si el inventario sigue disponible." },
  { key: "early_departure", label: "Salida anticipada", description: "Cierra una estadía activa y genera limpieza de salida." },
  { key: "room_move", label: "Cambiar habitación", description: "Mueve una estadía activa a una habitación lista." },
  { key: "walk_in", label: "Registrar walk-in", description: "Crea una reserva de hoy para completar check-in guiado." },
]

export function BookingExceptionsControl() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [action, setAction] = useState<ActionKey>("cancel")
  const [reservationId, setReservationId] = useState("")
  const [reason, setReason] = useState("")
  const [dateValue, setDateValue] = useState("")
  const [timeValue, setTimeValue] = useState("")
  const [targetBedId, setTargetBedId] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [numGuests, setNumGuests] = useState("1")
  const [specialRequests, setSpecialRequests] = useState("")

  const loadData = useCallback(async () => {
    const [reservationResult, bedResult] = await Promise.all([
      supabase.from("reservations").select("id, guest_name, check_in, check_out, status, arrival_status, room_id, bed_id").not("status", "in", "(cancelled,canceled,void,voided,checked_out,checked-out,no_show)").order("check_in"),
      supabase.from("beds").select("id, bed_number, is_available, room:rooms!inner(id, room_number, operational_status, location:locations(name))").eq("is_available", true).order("room_id").order("bed_number"),
    ])
    if (reservationResult.error) toast.error(reservationResult.error.message)
    if (bedResult.error) toast.error(bedResult.error.message)
    setReservations((reservationResult.data ?? []) as Reservation[])
    setBeds((bedResult.data ?? []) as unknown as Bed[])
  }, [supabase])

  useEffect(() => { if (open) void loadData() }, [loadData, open])

  const selectedAction = ACTIONS.find((item) => item.key === action)!
  const isWalkIn = action === "walk_in"
  const needsDate = action === "extend_stay" || action === "walk_in"
  const needsTime = action === "request_early_check_in" || action === "request_late_check_out"
  const needsBed = action === "room_move" || action === "walk_in"

  function resetForm(nextAction: ActionKey) {
    setAction(nextAction)
    setReservationId("")
    setReason("")
    setDateValue("")
    setTimeValue("")
    setTargetBedId("")
    setGuestName("")
    setGuestEmail("")
    setGuestPhone("")
    setNumGuests("1")
    setSpecialRequests("")
  }

  async function submit() {
    if (!reason.trim()) return toast.error("Debes indicar el motivo")
    if (!isWalkIn && !reservationId) return toast.error("Selecciona una reserva")
    if (needsDate && !dateValue) return toast.error("Selecciona una fecha")
    if (needsBed && !targetBedId) return toast.error("Selecciona una cama")
    if (isWalkIn && !guestName.trim()) return toast.error("Ingresa el nombre del huésped")

    setLoading(true)
    try {
      if (isWalkIn) {
        const { data, error } = await supabase.rpc("create_walk_in_reservation", {
          p_bed_id: targetBedId,
          p_guest_name: guestName.trim(),
          p_guest_email: guestEmail.trim() || null,
          p_guest_phone: guestPhone.trim() || null,
          p_check_out: dateValue,
          p_num_guests: Math.max(Number(numGuests) || 1, 1),
          p_reason: reason.trim(),
          p_special_requests: specialRequests.trim() || null,
        })
        if (error) throw error
        toast.success((data as { message?: string } | null)?.message ?? "Walk-in registrado")
      } else {
        const parameters: Record<string, string> = {}
        if (action === "extend_stay") parameters.new_check_out = dateValue
        if (action === "request_early_check_in") parameters.estimated_arrival_time = timeValue
        if (action === "request_late_check_out") parameters.estimated_departure_time = timeValue
        if (action === "room_move") parameters.target_bed_id = targetBedId
        const { data, error } = await supabase.rpc("handle_booking_exception", {
          p_reservation_id: reservationId,
          p_action: action,
          p_reason: reason.trim(),
          p_parameters: parameters,
        })
        if (error) throw error
        toast.success((data as { message?: string } | null)?.message ?? "Excepción registrada")
      }
      await loadData()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible registrar la excepción")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button className="fixed bottom-48 right-6 z-40 shadow-lg" variant="outline" onClick={() => setOpen(true)}>
        <AlertTriangle className="mr-2 h-4 w-4" />Excepciones
      </Button>
      {open && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Cerrar excepciones" />
          <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">A10 · Booking</p><h2 className="mt-1 text-xl font-semibold">Excepciones operativas</h2><p className="mt-1 text-sm text-muted-foreground">Todas las acciones requieren motivo y quedan auditadas.</p></div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {ACTIONS.map((item) => <Button key={item.key} type="button" variant={action === item.key ? "default" : "outline"} className="h-auto justify-start whitespace-normal py-3 text-left" onClick={() => resetForm(item.key)}>{item.key === "walk_in" ? <UserRoundPlus className="mr-2 h-4 w-4 shrink-0" /> : item.key === "room_move" ? <DoorOpen className="mr-2 h-4 w-4 shrink-0" /> : item.key === "early_departure" ? <LogOut className="mr-2 h-4 w-4 shrink-0" /> : <CalendarClock className="mr-2 h-4 w-4 shrink-0" />}{item.label}</Button>)}
              </div>

              <Card><CardContent className="space-y-4 p-4">
                <div><p className="font-medium">{selectedAction.label}</p><p className="mt-1 text-sm text-muted-foreground">{selectedAction.description}</p></div>

                {!isWalkIn && <label className="block space-y-1"><span className="text-sm font-medium">Reserva</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={(event) => setReservationId(event.target.value)}><option value="">Seleccionar reserva</option>{reservations.map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.guest_name} · {reservation.check_in} → {reservation.check_out} · {reservation.status}</option>)}</select></label>}

                {isWalkIn && <div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Nombre del huésped" value={guestName} onChange={(event) => setGuestName(event.target.value)} /><Input placeholder="Correo" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} /><Input placeholder="Teléfono" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} /><Input type="number" min={1} placeholder="Huéspedes" value={numGuests} onChange={(event) => setNumGuests(event.target.value)} /></div>}

                {needsBed && <label className="block space-y-1"><span className="text-sm font-medium">Cama de destino</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={targetBedId} onChange={(event) => setTargetBedId(event.target.value)}><option value="">Seleccionar cama</option>{beds.map((bed) => <option key={bed.id} value={bed.id}>{bed.room.location?.name ?? "Sin propiedad"} · {bed.room.room_number} · {bed.bed_number} · {bed.room.operational_status}</option>)}</select></label>}

                {needsDate && <label className="block space-y-1"><span className="text-sm font-medium">{isWalkIn ? "Check-out" : "Nuevo check-out"}</span><Input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} /></label>}
                {needsTime && <label className="block space-y-1"><span className="text-sm font-medium">Hora estimada</span><Input type="time" value={timeValue} onChange={(event) => setTimeValue(event.target.value)} /></label>}
                {isWalkIn && <Input placeholder="Solicitudes especiales" value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} />}

                <label className="block space-y-1"><span className="text-sm font-medium">Motivo obligatorio</span><textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe por qué se realiza esta excepción" /></label>

                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button><Button onClick={() => void submit()} disabled={loading}><PlusCircle className="mr-2 h-4 w-4" />{loading ? "Procesando…" : "Registrar"}</Button></div>
              </CardContent></Card>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

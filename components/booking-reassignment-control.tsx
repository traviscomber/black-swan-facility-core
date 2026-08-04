"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type ReservationOption = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  bed_id: string | null
  room_id: string | null
  room: { room_number: string; location: { name: string } | null } | null
}

type BedOption = {
  id: string
  bed_number: string
  room: {
    id: string
    room_number: string
    operational_status: string
    location: { name: string } | null
  }
}

export function BookingReassignmentControl() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reservations, setReservations] = useState<ReservationOption[]>([])
  const [beds, setBeds] = useState<BedOption[]>([])
  const [reservationId, setReservationId] = useState("")
  const [bedId, setBedId] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())

    const [reservationsResult, bedsResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, guest_name, check_in, check_out, bed_id, room_id, room:rooms(room_number, location:locations(name))")
        .in("status", ["pending", "confirmed"])
        .in("arrival_status", ["not_arrived", "expected"])
        .gte("check_out", today)
        .order("check_in"),
      supabase
        .from("beds")
        .select("id, bed_number, room:rooms!inner(id, room_number, operational_status, location:locations(name))")
        .eq("is_available", true)
        .order("room_id")
        .order("bed_number"),
    ])

    if (reservationsResult.error || bedsResult.error) {
      toast.error(reservationsResult.error?.message ?? bedsResult.error?.message ?? "No fue posible cargar opciones")
    } else {
      setReservations((reservationsResult.data ?? []) as unknown as ReservationOption[])
      setBeds(((bedsResult.data ?? []) as unknown as BedOption[]).filter((bed) =>
        !["out_of_service", "out_of_inventory"].includes(bed.room.operational_status),
      ))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (open) void loadData()
  }, [loadData, open])

  useEffect(() => {
    const reservation = reservations.find((item) => item.id === reservationId)
    if (!reservation) return
    setBedId(reservation.bed_id ?? "")
    setCheckIn(reservation.check_in)
    setCheckOut(reservation.check_out)
  }, [reservationId, reservations])

  async function submit() {
    if (!reservationId || !bedId || !checkIn || !checkOut) {
      toast.error("Selecciona reserva, cama y fechas")
      return
    }
    if (checkOut <= checkIn) {
      toast.error("El check-out debe ser posterior al check-in")
      return
    }

    setSaving(true)
    const { data, error } = await supabase.rpc("move_booking_reservation", {
      p_reservation_id: reservationId,
      p_target_bed_id: bedId,
      p_check_in: checkIn,
      p_check_out: checkOut,
    })

    if (error) {
      toast.error(error.message)
    } else {
      const result = Array.isArray(data) ? data[0] : data
      if (!result?.success) toast.error(result?.message ?? "No fue posible reprogramar la reserva")
      else {
        toast.success(result.message ?? "Reserva reprogramada")
        setOpen(false)
        setReservationId("")
        setBedId("")
        setCheckIn("")
        setCheckOut("")
      }
    }
    setSaving(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="fixed bottom-6 right-6 z-40 gap-2 shadow-lg"
        onClick={() => setOpen(true)}
      >
        <ArrowRightLeft className="h-4 w-4" />
        Reprogramar reserva
      </Button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} aria-label="Cerrar" />
          <section className="relative z-10 w-full max-w-2xl rounded-xl border bg-background shadow-2xl">
            <header className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">A9 · Movimiento canónico</p>
                <h2 className="mt-1 text-xl font-semibold">Reprogramar o mover reserva</h2>
                <p className="mt-1 text-sm text-muted-foreground">La operación valida disponibilidad, bloqueos, estado y solapamientos antes de guardar.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </header>

            <div className="space-y-4 p-5">
              <label className="block space-y-2 text-sm">
                <span className="font-medium">Reserva</span>
                <select value={reservationId} onChange={(event) => setReservationId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3">
                  <option value="">Seleccionar reserva futura</option>
                  {reservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.guest_name} · {reservation.room?.location?.name ?? "Sin propiedad"} · {reservation.room?.room_number ?? "Sin habitación"} · {reservation.check_in} → {reservation.check_out}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium">Nueva cama</span>
                <select value={bedId} onChange={(event) => setBedId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3">
                  <option value="">Seleccionar cama disponible</option>
                  {beds.map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      {bed.room.location?.name ?? "Sin propiedad"} · {bed.room.room_number} · {bed.bed_number} · {bed.room.operational_status}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm">
                  <span className="font-medium">Check-in</span>
                  <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3" />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium">Check-out</span>
                  <input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3" />
                </label>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Solo se pueden mover reservas pendientes o confirmadas cuyo huésped aún no ha iniciado la llegada. Housekeeping pre-arrival e historial se actualizan automáticamente.
              </div>
            </div>

            <footer className="flex items-center justify-between border-t p-5">
              <Button type="button" variant="ghost" onClick={() => void loadData()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" onClick={() => void submit()} disabled={saving || loading}>{saving ? "Validando…" : "Reprogramar"}</Button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}

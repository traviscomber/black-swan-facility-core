"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BellRing, CheckCircle2, Clock3, DoorOpen, RefreshCw, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Room = {
  id: string
  room_number: string
  operational_status: string
  location: { id: string; name: string } | null
}

type WaitingReservation = {
  id: string
  guest_name: string
  check_in: string
  status: string
  arrival_status: string
  queued_at: string | null
  room_id: string | null
  room: Room | null
}

const ROOM_STATUS_LABELS: Record<string, string> = {
  ready: "Lista",
  dirty: "Sucia",
  cleaning: "En limpieza",
  clean_pending_inspection: "Pendiente de inspección",
  inspected: "Inspeccionada",
  occupied: "Ocupada",
  out_of_service: "Fuera de servicio",
  out_of_inventory: "Fuera de inventario",
}

const ROOM_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  inspected: "default",
  occupied: "secondary",
  dirty: "destructive",
  cleaning: "secondary",
  clean_pending_inspection: "outline",
  out_of_service: "destructive",
  out_of_inventory: "destructive",
}

export function BookingArrivalQueue() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [waiting, setWaiting] = useState<WaitingReservation[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [roomsResult, waitingResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("id, room_number, operational_status, location:locations(id, name)")
        .order("room_number"),
      supabase
        .from("reservations")
        .select("id, guest_name, check_in, status, arrival_status, queued_at, room_id, room:rooms(id, room_number, operational_status, location:locations(id, name))")
        .in("arrival_status", ["waiting_for_room", "ready_for_checkin"])
        .order("queued_at", { ascending: true, nullsFirst: false }),
    ])

    if (roomsResult.error || waitingResult.error) {
      toast.error(roomsResult.error?.message ?? waitingResult.error?.message ?? "No fue posible cargar la cola")
    } else {
      setRooms((roomsResult.data ?? []) as unknown as Room[])
      setWaiting((waitingResult.data ?? []) as unknown as WaitingReservation[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (open) void load()
  }, [load, open])

  useEffect(() => {
    const channel = supabase
      .channel("booking-arrival-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => open && void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => open && void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, open, supabase])

  async function setRoomStatus(roomId: string, status: string) {
    setSaving(`room-${roomId}`)
    const { error } = await supabase.rpc("set_room_operational_status", { p_room_id: roomId, p_status: status })
    if (error) toast.error(error.message)
    else {
      toast.success(status === "ready" ? "Habitación marcada como lista" : "Estado operativo actualizado")
      await load()
    }
    setSaving(null)
  }

  async function checkIn(reservationId: string) {
    setSaving(`reservation-${reservationId}`)
    const { data, error } = await supabase.rpc("check_in_or_queue", { p_reservation_id: reservationId })
    if (error) toast.error(error.message)
    else if ((data as { result?: string } | null)?.result === "checked_in") toast.success("Check-in registrado")
    else toast.warning("La habitación aún no está lista; la reserva permanece en cola")
    await load()
    setSaving(null)
  }

  const roomCounts = useMemo(() => {
    return rooms.reduce<Record<string, number>>((acc, room) => {
      acc[room.operational_status] = (acc[room.operational_status] ?? 0) + 1
      return acc
    }, {})
  }, [rooms])

  return (
    <>
      <Button type="button" className="fixed bottom-5 right-5 z-40 gap-2 shadow-lg" onClick={() => setOpen(true)}>
        <BellRing className="h-4 w-4" />
        Cola de llegadas
        {waiting.length > 0 && <Badge variant="secondary">{waiting.length}</Badge>}
      </Button>

      {open && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Cerrar cola de llegadas" />
          <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Operación de recepción</p>
                <h2 className="mt-1 text-xl font-semibold">Cola de llegadas y habitaciones</h2>
                <p className="mt-1 text-sm text-muted-foreground">El check-in solo se completa cuando la habitación está lista o inspeccionada.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section>
                <div className="mb-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Huéspedes esperando habitación</h3></div>
                {waiting.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No hay llegadas en espera.</div>
                ) : (
                  <div className="space-y-3">
                    {waiting.map((reservation) => {
                      const ready = ["ready", "inspected"].includes(reservation.room?.operational_status ?? "")
                      return (
                        <div key={reservation.id} className="rounded-lg border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{reservation.guest_name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{reservation.room?.location?.name ?? "Sin propiedad"} · {reservation.room?.room_number ?? "Sin habitación"} · llegada {reservation.check_in}</p>
                            </div>
                            <Badge variant={ready ? "default" : "outline"}>{ready ? "Lista para check-in" : "Esperando habitación"}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {reservation.room && !ready && <Button size="sm" variant="outline" onClick={() => void setRoomStatus(reservation.room!.id, "ready")} disabled={saving === `room-${reservation.room.id}`}><Sparkles className="mr-2 h-4 w-4" />Marcar habitación lista</Button>}
                            <Button size="sm" onClick={() => void checkIn(reservation.id)} disabled={!ready || saving === `reservation-${reservation.id}`}><CheckCircle2 className="mr-2 h-4 w-4" />Registrar check-in</Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2"><DoorOpen className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Estado operativo de habitaciones</h3></div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {Object.entries(roomCounts).map(([status, count]) => <Badge key={status} variant={ROOM_STATUS_VARIANTS[status] ?? "outline"}>{ROOM_STATUS_LABELS[status] ?? status}: {count}</Badge>)}
                </div>
                <div className="space-y-2">
                  {rooms.map((room) => (
                    <div key={room.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-medium">{room.room_number}</p><p className="text-xs text-muted-foreground">{room.location?.name ?? "Sin propiedad"}</p></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={ROOM_STATUS_VARIANTS[room.operational_status] ?? "outline"}>{ROOM_STATUS_LABELS[room.operational_status] ?? room.operational_status}</Badge>
                        <select value={room.operational_status} onChange={(event) => void setRoomStatus(room.id, event.target.value)} disabled={saving === `room-${room.id}`} className="h-9 rounded-md border bg-background px-2 text-xs">
                          {Object.entries(ROOM_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

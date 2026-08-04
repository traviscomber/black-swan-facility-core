"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { BedDouble, History, RefreshCw, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

type Location = { id: string; name: string }
type Room = {
  id: string
  room_number: string
  room_type: string
  status: string | null
  operational_status: string
  location: Location | null
}
type HistoryEntry = {
  id: string
  room_id: string
  previous_status: string | null
  new_status: string
  reason: string | null
  source: string
  changed_by: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  ready: "Lista",
  dirty: "Sucia",
  cleaning: "En limpieza",
  clean_pending_inspection: "Pendiente de inspección",
  inspected: "Inspeccionada",
  occupied: "Ocupada",
  out_of_service: "Fuera de servicio",
  out_of_inventory: "Fuera de inventario",
}

const STATUS_CLASSES: Record<string, string> = {
  ready: "border-emerald-300 bg-emerald-50 text-emerald-800",
  inspected: "border-emerald-300 bg-emerald-50 text-emerald-800",
  dirty: "border-rose-300 bg-rose-50 text-rose-800",
  cleaning: "border-sky-300 bg-sky-50 text-sky-800",
  clean_pending_inspection: "border-amber-300 bg-amber-50 text-amber-800",
  occupied: "border-violet-300 bg-violet-50 text-violet-800",
  out_of_service: "border-red-400 bg-red-50 text-red-900",
  out_of_inventory: "border-slate-400 bg-slate-100 text-slate-800",
}

export function BookingRoomStatusControl() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string>("")
  const [nextStatus, setNextStatus] = useState<string>("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null
  const roomHistory = history.filter((entry) => entry.room_id === selectedRoomId)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [roomsResult, historyResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("id, room_number, room_type, status, operational_status, location:locations(id, name)")
        .order("room_number"),
      supabase
        .from("room_operational_history")
        .select("id, room_id, previous_status, new_status, reason, source, changed_by, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ])

    if (roomsResult.error || historyResult.error) {
      toast.error(roomsResult.error?.message ?? historyResult.error?.message ?? "No fue posible cargar habitaciones")
    } else {
      const nextRooms = (roomsResult.data ?? []) as unknown as Room[]
      setRooms(nextRooms)
      setHistory((historyResult.data ?? []) as HistoryEntry[])
      setSelectedRoomId((current) => current || nextRooms[0]?.id || "")
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (open) void loadData()
  }, [loadData, open])

  useEffect(() => {
    setNextStatus(selectedRoom?.operational_status ?? "")
    setReason("")
  }, [selectedRoom?.id, selectedRoom?.operational_status])

  async function updateStatus() {
    if (!selectedRoom || !nextStatus || nextStatus === selectedRoom.operational_status) return
    if (["out_of_service", "out_of_inventory"].includes(nextStatus) && !reason.trim()) {
      toast.error("Debes indicar un motivo para retirar la habitación de servicio o inventario")
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc("set_room_operational_status", {
      p_room_id: selectedRoom.id,
      p_status: nextStatus,
      p_reason: reason.trim() || null,
      p_source: "bookings_room_control",
    })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success("Estado operativo actualizado")
    await loadData()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="fixed bottom-6 right-6 z-40 shadow-lg" variant="secondary">
          <BedDouble className="mr-2 h-4 w-4" />
          Estado de habitaciones
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Estado operativo de habitaciones</SheetTitle>
          <SheetDescription>
            Condición física, disponibilidad comercial e historial auditado desde la vista de reservas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-2">
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona una habitación" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.location?.name ? `${room.location.name} · ` : ""}{room.room_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {selectedRoom ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>{selectedRoom.location?.name ? `${selectedRoom.location.name} · ` : ""}{selectedRoom.room_number}</span>
                    <Badge className={STATUS_CLASSES[selectedRoom.operational_status] ?? ""} variant="outline">
                      {STATUS_LABELS[selectedRoom.operational_status] ?? selectedRoom.operational_status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Disponibilidad comercial</p>
                      <p className="font-medium">{selectedRoom.status ?? "Sin estado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-medium">{selectedRoom.room_type}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nuevo estado operativo</label>
                    <Select value={nextStatus} onValueChange={setNextStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Motivo o contexto</label>
                    <Textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Ej.: mantenimiento preventivo, inspección completada, limpieza finalizada"
                    />
                  </div>

                  {["out_of_service", "out_of_inventory"].includes(nextStatus) ? (
                    <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      Este estado bloquea nuevas reservas y mantiene bloqueado el check-in hasta que la habitación vuelva a estar operativa.
                    </div>
                  ) : null}

                  <Button onClick={() => void updateStatus()} disabled={saving || !nextStatus || nextStatus === selectedRoom.operational_status}>
                    {saving ? "Actualizando…" : "Actualizar estado"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Historial auditado</CardTitle>
                </CardHeader>
                <CardContent>
                  {roomHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no existen cambios auditados para esta habitación.</p>
                  ) : (
                    <div className="space-y-4">
                      {roomHistory.map((entry) => (
                        <div key={entry.id} className="border-l-2 pl-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{STATUS_LABELS[entry.previous_status ?? ""] ?? entry.previous_status ?? "Inicial"}</Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge className={STATUS_CLASSES[entry.new_status] ?? ""} variant="outline">{STATUS_LABELS[entry.new_status] ?? entry.new_status}</Badge>
                          </div>
                          <p className="mt-1 text-sm">{entry.reason || "Cambio sin motivo registrado"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(new Date(entry.created_at), "d MMM yyyy, HH:mm", { locale: es })} · {entry.source}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No hay habitaciones disponibles para mostrar.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

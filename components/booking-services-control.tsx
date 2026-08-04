"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, PackagePlus, RefreshCw, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Reservation = { id: string; guest_name: string; check_in: string; check_out: string; status: string }
type Extra = { id: string; name: string; category: string | null; unit: string; price: number; tax_rate: number; service_kind: string; requires_scheduling: boolean; default_duration_minutes: number | null; is_active: boolean }
type Employee = { id: string; name: string; role: string | null }

const KIND_LABELS: Record<string, string> = {
  charge: "Cargo",
  scheduled_service: "Servicio programado",
  activity: "Actividad",
  transport: "Transporte",
  food_beverage: "Alimentos y bebidas",
  amenity: "Amenity",
}

export function BookingServicesControl() {
  const supabase = useMemo(() => createClient(), [])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [reservationId, setReservationId] = useState("")
  const [extraId, setExtraId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [scheduledStart, setScheduledStart] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [reservationsResult, extrasResult, employeesResult] = await Promise.all([
      supabase.from("reservations").select("id, guest_name, check_in, check_out, status").not("status", "in", "(cancelled,canceled,void,voided,no_show)").order("check_in"),
      supabase.from("booking_extras").select("id, name, category, unit, price, tax_rate, service_kind, requires_scheduling, default_duration_minutes, is_active").eq("is_active", true).order("name"),
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
    ])
    const error = reservationsResult.error || extrasResult.error || employeesResult.error
    if (error) return toast.error(error.message)
    setReservations((reservationsResult.data ?? []) as Reservation[])
    setExtras((extrasResult.data ?? []) as Extra[])
    setEmployees((employeesResult.data ?? []) as Employee[])
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const selectedExtra = extras.find((item) => item.id === extraId)

  async function addService() {
    if (!reservationId || !extraId) return toast.error("Selecciona una reserva y un servicio")
    if (selectedExtra?.requires_scheduling && !scheduledStart) return toast.error("Este servicio requiere fecha y hora")
    setSaving(true)
    const { error } = await supabase.rpc("add_reservation_service", {
      p_reservation_id: reservationId,
      p_extra_id: extraId,
      p_quantity: Number(quantity),
      p_scheduled_start: scheduledStart ? new Date(scheduledStart).toISOString() : null,
      p_assigned_to: assignedTo || null,
      p_notes: notes || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success("Servicio agregado a la reserva")
    setQuantity("1")
    setScheduledStart("")
    setAssignedTo("")
    setNotes("")
  }

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="h-4 w-4" /> Servicios de la reserva</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {extras.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground"><Settings2 className="h-4 w-4" /> Catálogo vacío</div>
            Configura servicios reales antes de cargar consumos o actividades. El sistema no crea nombres ni precios ficticios.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 xl:col-span-2">
              <Label>Reserva</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
                <option value="">Seleccionar reserva</option>
                {reservations.map((item) => <option key={item.id} value={item.id}>{item.guest_name} · {item.check_in} → {item.check_out}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 xl:col-span-2">
              <Label>Servicio o cargo</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={extraId} onChange={(e) => setExtraId(e.target.value)}>
                <option value="">Seleccionar servicio</option>
                {extras.map((item) => <option key={item.id} value={item.id}>{item.name} · {KIND_LABELS[item.service_kind] ?? item.service_kind}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Cantidad</Label><Input type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fecha y hora</Label><Input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} disabled={!selectedExtra?.requires_scheduling} /></div>
            <div className="space-y-1.5"><Label>Responsable</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}><option value="">Sin asignar</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}{item.role ? ` · ${item.role}` : ""}</option>)}</select></div>
            <div className="space-y-1.5"><Label>Notas</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones operativas" /></div>
          </div>
        )}
        {selectedExtra && <div className="flex flex-wrap gap-3 rounded-lg bg-muted/40 p-3 text-sm"><span>{KIND_LABELS[selectedExtra.service_kind] ?? selectedExtra.service_kind}</span><span>{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(selectedExtra.price))} / {selectedExtra.unit}</span>{selectedExtra.requires_scheduling && <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Requiere programación</span>}</div>}
        <div className="flex justify-end"><Button onClick={() => void addService()} disabled={saving || extras.length === 0}>{saving ? "Guardando…" : "Agregar a la reserva"}</Button></div>
      </CardContent>
    </Card>
  )
}

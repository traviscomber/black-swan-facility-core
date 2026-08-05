"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Anchor, Bus, Car, Plane, Save, Ship, UserRound, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"


type Direction = "arrival" | "departure"

type Plan = {
  id?: string
  direction: Direction
  transportMode: string
  hub: string
  anchorAt: string | null
  marginMinutes: number | null
  boatDurationMinutes: number
  roadDurationMinutes: number
  boatId: string | null
  vehicleId: string | null
  driverId: string | null
  boatResponsibleId: string | null
  status: string
  notes: string | null
}

type Option = { id: string; name: string; role?: string; capacity?: number; plateNumber?: string | null }

type EditorData = {
  reservation: {
    id: string
    guestName: string
    checkIn: string
    checkOut: string
    arrivalTime: string | null
    departureTime: string | null
    status: string
  } | null
  plans: Plan[]
  boats: Option[]
  vehicles: Option[]
  employees: Option[]
}

const emptyPlan = (direction: Direction): Plan => ({
  direction,
  transportMode: "unknown",
  hub: "unknown",
  anchorAt: null,
  marginMinutes: null,
  boatDurationMinutes: 30,
  roadDurationMinutes: 30,
  boatId: null,
  vehicleId: null,
  driverId: null,
  boatResponsibleId: null,
  status: "draft",
  notes: null,
})

function localInputValue(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function nullable(value: string) {
  return value || null
}

export function ReservationLogisticsEditor() {
  const searchParams = useSearchParams()
  const reservationId = searchParams.get("reservation")
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<EditorData | null>(null)
  const [direction, setDirection] = useState<Direction>("arrival")
  const [plan, setPlan] = useState<Plan>(emptyPlan("arrival"))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const applyPlan = useCallback((payload: EditorData, selected: Direction) => {
    setPlan(payload.plans.find((item) => item.direction === selected) ?? emptyPlan(selected))
  }, [])

  const load = useCallback(async () => {
    if (!reservationId) {
      setData(null)
      return
    }
    setLoading(true)
    setMessage(null)
    const { data: payload, error } = await supabase.rpc("get_reservation_logistics_editor", {
      p_reservation_id: reservationId,
    })
    if (error) {
      setMessage(error.message)
      setData(null)
    } else {
      const next = payload as EditorData
      setData(next)
      applyPlan(next, direction)
    }
    setLoading(false)
  }, [applyPlan, direction, reservationId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  function changeDirection(next: Direction) {
    setDirection(next)
    if (data) applyPlan(data, next)
    else setPlan(emptyPlan(next))
    setMessage(null)
  }

  async function save() {
    if (!reservationId) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.rpc("save_reservation_logistics_plan", {
      p_reservation_id: reservationId,
      p_direction: direction,
      p_transport_mode: plan.transportMode,
      p_hub: plan.hub,
      p_anchor_at: plan.anchorAt ? new Date(plan.anchorAt).toISOString() : null,
      p_margin_minutes: plan.marginMinutes,
      p_boat_duration_minutes: plan.boatDurationMinutes,
      p_road_duration_minutes: plan.roadDurationMinutes,
      p_boat_id: plan.boatId,
      p_vehicle_id: plan.vehicleId,
      p_driver_id: plan.driverId,
      p_boat_responsible_id: plan.boatResponsibleId,
      p_status: plan.status,
      p_notes: plan.notes,
    })
    if (error) setMessage(error.message)
    else {
      setMessage("Plan logístico guardado. El calendario se recalculará con esta configuración.")
      await load()
    }
    setSaving(false)
  }

  if (!reservationId) return null

  return (
    <section className="border-b border-border/30 bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Logística de reserva</p>
            <h2 className="mt-1 text-xl font-normal">{data?.reservation?.guestName ?? "Cargando reserva"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure el servicio externo, los tramos de transporte y los recursos responsables.
            </p>
          </div>
          <Button asChild variant="ghost" size="icon" aria-label="Cerrar configuración logística">
            <a href="/bookings"><X className="h-4 w-4" /></a>
          </Button>
        </div>

        <div className="mt-5 flex gap-1 bg-secondary p-1">
          <button type="button" onClick={() => changeDirection("arrival")} className={`flex-1 px-4 py-2 text-sm transition-colors ${direction === "arrival" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Llegada
          </button>
          <button type="button" onClick={() => changeDirection("departure")} className={`flex-1 px-4 py-2 text-sm transition-colors ${direction === "departure" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Salida
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Cargando plan logístico…</p>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Modo de transporte" icon={direction === "arrival" ? Plane : Car}>
                <select className="h-10 w-full bg-input px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={plan.transportMode} onChange={(event) => setPlan({ ...plan, transportMode: event.target.value })}>
                  <option value="unknown">Por definir</option>
                  <option value="flight">Vuelo</option>
                  <option value="bus">Bus</option>
                  <option value="private_vehicle">Vehículo particular</option>
                  <option value="other">Otro</option>
                </select>
              </Field>

              <Field label={direction === "arrival" ? "Punto de arribo" : "Destino final"} icon={Bus}>
                <select className="h-10 w-full bg-input px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={plan.hub} onChange={(event) => setPlan({ ...plan, hub: event.target.value })}>
                  <option value="unknown">Por definir</option>
                  <option value="pichoy">Aeropuerto Pichoy</option>
                  <option value="valdivia_bus_terminal">Terminal de Buses de Valdivia</option>
                  <option value="rebellin">Rebellín</option>
                  <option value="direct">Directo / vehículo particular</option>
                  <option value="other">Otro</option>
                </select>
              </Field>

              <Field label={direction === "arrival" ? "Hora del vuelo, bus o arribo externo" : "Hora del vuelo, bus o compromiso final"} icon={Anchor}>
                <Input type="datetime-local" value={localInputValue(plan.anchorAt)} onChange={(event) => setPlan({ ...plan, anchorAt: nullable(event.target.value) })} />
              </Field>

              {direction === "departure" && (
                <Field label="Margen previo al vuelo o bus (minutos)" icon={Anchor}>
                  <Input type="number" min={0} value={plan.marginMinutes ?? ""} onChange={(event) => setPlan({ ...plan, marginMinutes: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Pendiente de definir" />
                </Field>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bote" icon={Ship}>
                  <select className="h-10 w-full bg-input px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={plan.boatId ?? ""} onChange={(event) => setPlan({ ...plan, boatId: nullable(event.target.value) })}>
                    <option value="">Sin asignar</option>
                    {data?.boats.map((item) => <option key={item.id} value={item.id}>{item.name}{item.capacity ? ` · ${item.capacity} pax` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Responsable del bote" icon={UserRound}>
                  <EmployeeSelect options={data?.employees ?? []} value={plan.boatResponsibleId} onChange={(value) => setPlan({ ...plan, boatResponsibleId: value })} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vehículo" icon={Car}>
                  <select className="h-10 w-full bg-input px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={plan.vehicleId ?? ""} onChange={(event) => setPlan({ ...plan, vehicleId: nullable(event.target.value) })}>
                    <option value="">Sin asignar</option>
                    {data?.vehicles.map((item) => <option key={item.id} value={item.id}>{item.name}{item.plateNumber ? ` · ${item.plateNumber}` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Conductor" icon={UserRound}>
                  <EmployeeSelect options={data?.employees ?? []} value={plan.driverId} onChange={(value) => setPlan({ ...plan, driverId: value })} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Duración bote (min)" icon={Ship}>
                  <Input type="number" min={1} value={plan.boatDurationMinutes} onChange={(event) => setPlan({ ...plan, boatDurationMinutes: Number(event.target.value) })} />
                </Field>
                <Field label="Duración terrestre (min)" icon={Car}>
                  <Input type="number" min={0} value={plan.roadDurationMinutes} onChange={(event) => setPlan({ ...plan, roadDurationMinutes: Number(event.target.value) })} />
                </Field>
              </div>

              <Field label="Estado del plan" icon={Save}>
                <select className="h-10 w-full bg-input px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={plan.status} onChange={(event) => setPlan({ ...plan, status: event.target.value })}>
                  <option value="draft">Borrador</option>
                  <option value="planned">Planificado</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-5">
          <p className={`text-sm ${message?.startsWith("Plan") ? "text-primary" : "text-muted-foreground"}`}>{message ?? "Los tramos fijos parten en 30 minutos y pueden ajustarse cuando la operación real lo requiera."}</p>
          <Button onClick={() => void save()} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />{saving ? "Guardando…" : "Guardar logística"}
          </Button>
        </div>
      </div>
    </section>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Anchor; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</span>
      {children}
    </label>
  )
}

function EmployeeSelect({ options, value, onChange }: { options: Option[]; value: string | null; onChange: (value: string | null) => void }) {
  return (
    <select className="h-10 w-full bg-input px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={value ?? ""} onChange={(event) => onChange(nullable(event.target.value))}>
      <option value="">Sin asignar</option>
      {options.map((item) => <option key={item.id} value={item.id}>{item.name}{item.role ? ` · ${item.role}` : ""}</option>)}
    </select>
  )
}

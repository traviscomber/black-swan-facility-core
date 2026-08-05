"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, parseISO, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, Car, RefreshCw, Save, Ship, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Option = { id: string; name: string; role?: string; capacity?: number | null; plateNumber?: string | null }
type GroupMember = { planId: string; reservationId: string; guestName: string; passengers: number }
type Group = {
  direction: "arrival" | "departure"
  hub: string
  transportMode: string
  anchorAt: string
  planCount: number
  passengerCount: number
  members: GroupMember[]
}
type Conflict = {
  type: string
  resourceId: string | null
  resourceName: string | null
  startsAt: string | null
  endsAt: string | null
  message: string
  severity?: string
}
type Payload = { groups: Group[]; conflicts: Conflict[]; boats: Option[]; vehicles: Option[]; employees: Option[] }

type Assignment = {
  boatId: string
  vehicleId: string
  driverId: string
  boatResponsibleId: string
  status: string
}

const blankAssignment: Assignment = { boatId: "", vehicleId: "", driverId: "", boatResponsibleId: "", status: "planned" }

export function LogisticsGroupControl({ days = 30 }: { days?: number }) {
  const supabase = useMemo(() => createClient(), [])
  const startDate = useMemo(() => startOfDay(new Date()), [])
  const endDate = useMemo(() => addDays(startDate, days), [days, startDate])
  const [data, setData] = useState<Payload | null>(null)
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const keyFor = (group: Group) => `${group.direction}-${group.hub}-${group.transportMode}-${group.anchorAt}`

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    const { data: payload, error } = await supabase.rpc("get_logistics_group_control_editor", {
      p_start_date: format(startDate, "yyyy-MM-dd"),
      p_end_date: format(endDate, "yyyy-MM-dd"),
    })
    if (error) {
      setMessage(error.message)
      setData(null)
    } else {
      setData(payload as Payload)
    }
    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => { void load() }, [load])

  async function assign(group: Group) {
    const key = keyFor(group)
    const selection = assignments[key] ?? blankAssignment
    setSavingKey(key)
    setMessage(null)
    const { error } = await supabase.rpc("assign_logistics_group_resources", {
      p_plan_ids: group.members.map((member) => member.planId),
      p_boat_id: selection.boatId || null,
      p_vehicle_id: selection.vehicleId || null,
      p_driver_id: selection.driverId || null,
      p_boat_responsible_id: selection.boatResponsibleId || null,
      p_status: selection.status,
    })
    if (error) setMessage(error.message)
    else {
      setMessage(`Recursos aplicados a ${group.planCount} reservas del grupo.`)
      await load()
    }
    setSavingKey(null)
  }

  if (loading) return <section className="bg-card p-5 text-sm text-muted-foreground">Cargando control de traslados…</section>
  if (!data) return <section className="bg-card p-5 text-sm text-destructive">{message ?? "No fue posible cargar el control logístico."}</section>

  return (
    <section className="space-y-5 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Control de recursos</p>
          <h2 className="mt-1 text-xl font-normal">Traslados agrupables y conflictos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Asigne recursos compartidos a pasajeros con la misma ruta y hora.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.conflicts.length > 0 ? "destructive" : "outline"}>{data.conflicts.length} conflictos</Badge>
          <Button variant="secondary" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
        </div>
      </div>

      {message && <div className="bg-secondary p-3 text-sm text-foreground">{message}</div>}

      {data.conflicts.length > 0 && (
        <div className="space-y-2">
          {data.conflicts.map((conflict, index) => (
            <div key={`${conflict.type}-${index}`} className="flex gap-3 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-medium">{conflict.resourceName ?? "Conflicto logístico"}</p><p className="mt-1 text-xs opacity-90">{conflict.message}</p></div>
            </div>
          ))}
        </div>
      )}

      {data.groups.length === 0 ? (
        <p className="bg-secondary p-5 text-sm text-muted-foreground">No hay traslados agrupables dentro del período.</p>
      ) : (
        <div className="space-y-3">
          {data.groups.map((group) => {
            const key = keyFor(group)
            const selection = assignments[key] ?? blankAssignment
            return (
              <div key={key} className="bg-secondary p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{group.direction === "arrival" ? "Llegada" : "Salida"}</Badge>
                      <p className="text-sm font-medium">{format(parseISO(group.anchorAt), "d MMM yyyy · HH:mm", { locale: es })}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{group.hub} · {group.transportMode} · {group.passengerCount} pasajeros · {group.planCount} reservas</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.members.map((member) => <Badge key={member.planId} variant="secondary"><Users className="mr-1 h-3 w-3" />{member.guestName} · {member.passengers}</Badge>)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Select label="Bote" icon={Ship} value={selection.boatId} onChange={(value) => setAssignments({ ...assignments, [key]: { ...selection, boatId: value } })} options={data.boats} empty="Sin asignar" />
                  <Select label="Responsable bote" icon={Users} value={selection.boatResponsibleId} onChange={(value) => setAssignments({ ...assignments, [key]: { ...selection, boatResponsibleId: value } })} options={data.employees} empty="Sin asignar" />
                  <Select label="Vehículo" icon={Car} value={selection.vehicleId} onChange={(value) => setAssignments({ ...assignments, [key]: { ...selection, vehicleId: value } })} options={data.vehicles} empty="Sin asignar" />
                  <Select label="Conductor" icon={Users} value={selection.driverId} onChange={(value) => setAssignments({ ...assignments, [key]: { ...selection, driverId: value } })} options={data.employees} empty="Sin asignar" />
                  <label className="space-y-2"><span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Estado</span><select className="h-10 w-full bg-input px-3 text-sm" value={selection.status} onChange={(event) => setAssignments({ ...assignments, [key]: { ...selection, status: event.target.value } })}><option value="planned">Planificado</option><option value="confirmed">Confirmado</option><option value="draft">Borrador</option></select></label>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={() => void assign(group)} disabled={savingKey === key}><Save className="mr-2 h-4 w-4" />{savingKey === key ? "Aplicando…" : "Aplicar al grupo"}</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Select({ label, icon: Icon, value, onChange, options, empty }: { label: string; icon: typeof Ship; value: string; onChange: (value: string) => void; options: Option[]; empty: string }) {
  return <label className="space-y-2"><span className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</span><select className="h-10 w-full bg-input px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{empty}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.capacity ? ` · ${option.capacity} pax` : option.plateNumber ? ` · ${option.plateNumber}` : option.role ? ` · ${option.role}` : ""}</option>)}</select></label>
}

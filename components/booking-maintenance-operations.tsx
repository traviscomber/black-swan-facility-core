"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Wrench } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Reservation = { id: string; guest_name: string; room_id: string | null; location_id: string | null; check_in: string; check_out: string }
type Room = { id: string; room_number: string; location_id: string | null; operational_status: string | null }
type Employee = { id: string; name: string; role: string | null }
type Incident = {
  id: string; title: string; description: string | null; status: string; priority: string; severity: string; reservation_id: string | null; room_id: string | null;
  assigned_to: string | null; due_at: string | null; room_block_required: boolean; inspection_required: boolean; inspection_status: string;
  diagnosis: string | null; resolution: string | null; labor_cost: number; parts_cost: number; created_at: string | null;
}

const statusLabels: Record<string,string> = { open:"Abierta",assigned:"Asignada",in_progress:"En curso",blocked:"Bloqueada",resolved:"Resuelta",inspection:"Inspección",closed:"Cerrada",cancelled:"Cancelada" }
const priorityLabels: Record<string,string> = { low:"Baja",normal:"Normal",high:"Alta",urgent:"Urgente" }

export function BookingMaintenanceOperations() {
  const supabase = useMemo(() => createClient(), [])
  const [reservations,setReservations] = useState<Reservation[]>([])
  const [rooms,setRooms] = useState<Room[]>([])
  const [employees,setEmployees] = useState<Employee[]>([])
  const [incidents,setIncidents] = useState<Incident[]>([])
  const [saving,setSaving] = useState(false)
  const [title,setTitle] = useState("")
  const [description,setDescription] = useState("")
  const [reservationId,setReservationId] = useState("")
  const [roomId,setRoomId] = useState("")
  const [priority,setPriority] = useState("normal")
  const [sla,setSla] = useState("240")
  const [blockRoom,setBlockRoom] = useState(false)
  const [selectedId,setSelectedId] = useState("")
  const [assignedTo,setAssignedTo] = useState("")
  const [note,setNote] = useState("")
  const [diagnosis,setDiagnosis] = useState("")
  const [resolution,setResolution] = useState("")
  const [laborCost,setLaborCost] = useState("0")
  const [partsCost,setPartsCost] = useState("0")

  const load = useCallback(async () => {
    const [rsv, rms, emp, inc] = await Promise.all([
      supabase.from("reservations").select("id,guest_name,room_id,location_id,check_in,check_out").not("status","in","(cancelled,canceled,void,voided,no_show)").order("check_in"),
      supabase.from("rooms").select("id,room_number,location_id,operational_status").order("room_number"),
      supabase.from("employees").select("id,name,role").eq("is_active",true).order("name"),
      supabase.from("incidents").select("id,title,description,status,priority,severity,reservation_id,room_id,assigned_to,due_at,room_block_required,inspection_required,inspection_status,diagnosis,resolution,labor_cost,parts_cost,created_at").not("status","in","(closed,cancelled)").order("created_at",{ascending:false}),
    ])
    const error = rsv.error || rms.error || emp.error || inc.error
    if (error) return toast.error(error.message)
    setReservations((rsv.data ?? []) as Reservation[])
    setRooms((rms.data ?? []) as Room[])
    setEmployees((emp.data ?? []) as Employee[])
    setIncidents((inc.data ?? []) as Incident[])
  },[supabase])

  useEffect(()=>{ void load() },[load])

  useEffect(()=>{
    const reservation = reservations.find(item=>item.id===reservationId)
    if (reservation?.room_id) setRoomId(reservation.room_id)
  },[reservationId,reservations])

  const selected = incidents.find(item=>item.id===selectedId) ?? null
  const overdue = incidents.filter(item=>item.due_at && new Date(item.due_at).getTime() < Date.now() && !["closed","cancelled"].includes(item.status)).length

  async function rpc(action:string,payload:Record<string,unknown>={}) {
    setSaving(true)
    const { error } = await supabase.rpc("manage_booking_incident", { p_incident_id: action === "create" ? null : selectedId, p_action: action, p_payload: payload })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success("Incidencia actualizada")
    setNote(""); setDiagnosis(""); setResolution(""); setLaborCost("0"); setPartsCost("0")
    await load()
  }

  async function createIncident() {
    if (!title.trim()) return toast.error("Indica el título de la incidencia")
    if (!roomId && !reservationId) return toast.error("Vincula una reserva o habitación")
    const room = rooms.find(item=>item.id===roomId)
    await rpc("create", {
      title:title.trim(), description:description.trim() || null, reservation_id:reservationId || null, room_id:roomId || null,
      location_id:room?.location_id ?? reservations.find(item=>item.id===reservationId)?.location_id ?? null,
      priority, severity:priority === "urgent" ? "critical" : priority === "high" ? "high" : "medium",
      sla_minutes:Number(sla), room_block_required:blockRoom, inspection_required:true, department:"Mantenimiento",
    })
    setTitle(""); setDescription(""); setReservationId(""); setRoomId(""); setPriority("normal"); setSla("240"); setBlockRoom(false)
  }

  return <Card className="mx-4 mb-4">
    <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3">
      <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" /> Mantenimiento conectado a reservas</CardTitle>
      <Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
    </div></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Incidencias activas</p><p className="mt-1 text-lg font-semibold">{incidents.length}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">SLA vencidos</p><p className="mt-1 text-lg font-semibold">{overdue}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Habitaciones bloqueadas</p><p className="mt-1 text-lg font-semibold">{incidents.filter(i=>i.room_block_required && !["closed","cancelled"].includes(i.status)).length}</p></div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Registrar incidencia</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5"><Label>Título</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Reserva</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={e=>setReservationId(e.target.value)}><option value="">Sin reserva</option>{reservations.map(r=><option key={r.id} value={r.id}>{r.guest_name} · {r.check_in}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Habitación</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={roomId} onChange={e=>setRoomId(e.target.value)}><option value="">Seleccionar</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.room_number} · {r.operational_status ?? "sin estado"}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Prioridad</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div>
          <div className="space-y-1.5 xl:col-span-2"><Label>Descripción</Label><Input value={description} onChange={e=>setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>SLA (min)</Label><Input type="number" min="15" value={sla} onChange={e=>setSla(e.target.value)} /></div>
          <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={blockRoom} onChange={e=>setBlockRoom(e.target.checked)} /> Sacar habitación de inventario</label>
        </div>
        <div className="flex justify-end"><Button onClick={()=>void createIncident()} disabled={saving}><AlertTriangle className="mr-2 h-4 w-4" />Crear incidencia</Button></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-2">
          {incidents.length===0 ? <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No hay incidencias activas.</div> : incidents.map(i=>{
            const isOverdue = Boolean(i.due_at && new Date(i.due_at).getTime()<Date.now())
            return <button type="button" key={i.id} onClick={()=>{setSelectedId(i.id);setAssignedTo(i.assigned_to ?? "")}} className={`w-full rounded-lg border p-3 text-left ${selectedId===i.id?"border-foreground":""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{i.title}</span><div className="flex gap-2"><Badge variant={isOverdue?"destructive":"secondary"}>{priorityLabels[i.priority] ?? i.priority}</Badge><Badge variant="outline">{statusLabels[i.status] ?? i.status}</Badge></div></div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">{i.due_at && <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{new Date(i.due_at).toLocaleString("es-CL")}</span>}{i.room_block_required && <span className="flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" />Habitación bloqueada</span>}</div>
            </button>
          })}
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          {!selected ? <p className="text-sm text-muted-foreground">Selecciona una incidencia para operarla.</p> : <>
            <div><h3 className="font-medium">{selected.title}</h3><p className="text-sm text-muted-foreground">{selected.description || "Sin descripción"}</p></div>
            <div className="space-y-1.5"><Label>Responsable</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}><option value="">Sin asignar</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}{e.role?` · ${e.role}`:""}</option>)}</select></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void rpc("assign",{assigned_to:assignedTo})} disabled={saving || !assignedTo}>Asignar</Button><Button variant="outline" onClick={()=>void rpc("start")} disabled={saving}>Iniciar</Button></div>
            <div className="space-y-1.5"><Label>Nota / motivo de bloqueo</Label><Input value={note} onChange={e=>setNote(e.target.value)} /></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void rpc("block",{block_reason:note})} disabled={saving || !note.trim()}>Bloquear trabajo</Button>{selected.status==="inspection" && <><Button onClick={()=>void rpc("inspect_pass")} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />Aprobar inspección</Button><Button variant="destructive" onClick={()=>void rpc("inspect_fail",{block_reason:note})} disabled={saving || !note.trim()}>Rechazar inspección</Button></>}</div>
            {selected.status!=="inspection" && <>
              <div className="space-y-1.5"><Label>Diagnóstico</Label><Input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Resolución</Label><Input value={resolution} onChange={e=>setResolution(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Mano de obra CLP</Label><Input type="number" min="0" value={laborCost} onChange={e=>setLaborCost(e.target.value)} /></div><div className="space-y-1.5"><Label>Repuestos CLP</Label><Input type="number" min="0" value={partsCost} onChange={e=>setPartsCost(e.target.value)} /></div></div>
              <Button onClick={()=>void rpc("resolve",{diagnosis,resolution,labor_cost:Number(laborCost),parts_cost:Number(partsCost),parts_used:[]})} disabled={saving || !resolution.trim()}>Resolver y enviar a inspección</Button>
            </>}
          </>}
        </div>
      </div>
    </CardContent>
  </Card>
}

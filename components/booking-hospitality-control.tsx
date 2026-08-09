"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Employee = { id: string; name: string; role: string | null }
type Request = {
  id: string
  guest_name: string
  request_type: string
  category: string
  description: string | null
  priority: string
  status: string
  assigned_to: string | null
  department: string | null
  due_at: string | null
  promised_at: string | null
  sla_minutes: number | null
  blocked_reason: string | null
  escalation_reason: string | null
  completion_notes: string | null
  satisfaction_score: number | null
  reservation_id: string | null
  rooms: { room_number: string | null } | null
  locations: { name: string | null } | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  assigned: "Asignada",
  in_progress: "En curso",
  blocked: "Bloqueada",
  completed: "Completada",
  cancelled: "Cancelada",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
  critical: "Crítica",
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  blankets: "Mantas",
  Blankets: "Mantas",
  "Extra Blankets": "Mantas adicionales",
  towels: "Toallas",
  Towels: "Toallas",
  extra_towels: "Toallas adicionales",
  room_service: "Servicio a la habitación",
  maintenance: "Mantenimiento",
  transport: "Transporte",
  food_beverage: "Alimentos y bebidas",
}

const CATEGORY_LABELS: Record<string, string> = {
  guest_supplies: "Suministros para huéspedes",
  housekeeping: "Limpieza",
  hospitality: "Hospitalidad",
  maintenance: "Mantenimiento",
  transport: "Transporte",
  food_beverage: "Alimentos y bebidas",
}

function requestTypeLabel(value: string) {
  return REQUEST_TYPE_LABELS[value] ?? value.replaceAll("_", " ")
}

function categoryLabel(value: string) {
  return CATEGORY_LABELS[value] ?? value.replaceAll("_", " ")
}

export function BookingHospitalityControl() {
  const supabase = useMemo(() => createClient(), [])
  const [requests, setRequests] = useState<Request[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [priority, setPriority] = useState("normal")
  const [department, setDepartment] = useState("Hospitality")
  const [promisedAt, setPromisedAt] = useState("")
  const [slaMinutes, setSlaMinutes] = useState("30")
  const [notes, setNotes] = useState("")
  const [blockedReason, setBlockedReason] = useState("")
  const [escalationReason, setEscalationReason] = useState("")
  const [evidenceUrl, setEvidenceUrl] = useState("")
  const [completionNotes, setCompletionNotes] = useState("")
  const [guestConfirmed, setGuestConfirmed] = useState(false)
  const [satisfaction, setSatisfaction] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [requestsResult, employeesResult] = await Promise.all([
      supabase
        .from("hospitality_requests")
        .select("id,guest_name,request_type,category,description,priority,status,assigned_to,department,due_at,promised_at,sla_minutes,blocked_reason,escalation_reason,completion_notes,satisfaction_score,reservation_id,rooms(room_number),locations(name)")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id,name,role").eq("is_active", true).order("name"),
    ])
    const error = requestsResult.error || employeesResult.error
    if (error) return toast.error(error.message)
    setRequests((requestsResult.data ?? []) as unknown as Request[])
    setEmployees((employeesResult.data ?? []) as Employee[])
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const selected = requests.find((request) => request.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    setAssignedTo(selected.assigned_to ?? "")
    setPriority(selected.priority ?? "normal")
    setDepartment(selected.department ?? "Hospitality")
    setPromisedAt(selected.promised_at ? new Date(selected.promised_at).toISOString().slice(0, 16) : "")
    setSlaMinutes(String(selected.sla_minutes ?? 30))
    setBlockedReason(selected.blocked_reason ?? "")
    setEscalationReason(selected.escalation_reason ?? "")
    setCompletionNotes(selected.completion_notes ?? "")
    setSatisfaction(selected.satisfaction_score ? String(selected.satisfaction_score) : "")
  }, [selected])

  async function update(status: string) {
    if (!selectedId) return toast.error("Selecciona una solicitud")
    setSaving(true)
    const { error } = await supabase.rpc("update_hospitality_request", {
      p_request_id: selectedId,
      p_status: status,
      p_assigned_to: assignedTo || null,
      p_priority: priority,
      p_department: department || null,
      p_promised_at: promisedAt ? new Date(promisedAt).toISOString() : null,
      p_sla_minutes: Number(slaMinutes) || null,
      p_notes: notes || null,
      p_blocked_reason: blockedReason || null,
      p_escalation_reason: escalationReason || null,
      p_evidence_url: evidenceUrl || null,
      p_completion_notes: completionNotes || null,
      p_guest_confirmed: guestConfirmed,
      p_satisfaction_score: satisfaction ? Number(satisfaction) : null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(`Solicitud ${STATUS_LABELS[status]?.toLowerCase() ?? status}`)
    setNotes("")
    setEvidenceUrl("")
    await load()
  }

  const now = Date.now()
  const overdue = requests.filter((request) => request.due_at && !["completed", "cancelled"].includes(request.status) && new Date(request.due_at).getTime() < now).length
  const active = requests.filter((request) => !["completed", "cancelled"].includes(request.status)).length

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><UsersRound className="h-4 w-4" /> Hospitalidad operativa</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Solicitudes activas</p><p className="mt-1 text-lg font-semibold">{active}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">SLA vencidos</p><p className="mt-1 text-lg font-semibold">{overdue}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total registrado</p><p className="mt-1 text-lg font-semibold">{requests.length}</p></div>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No existen solicitudes de hospitalidad. Las solicitudes enviadas desde la tablet aparecerán aquí.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <div className="space-y-2">
              {requests.map((request) => {
                const isOverdue = request.due_at && !["completed", "cancelled"].includes(request.status) && new Date(request.due_at).getTime() < now
                return <button key={request.id} type="button" onClick={() => setSelectedId(request.id)} className={`w-full rounded-lg border p-3 text-left ${selectedId === request.id ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{request.guest_name}</p><p className="text-sm text-muted-foreground">{requestTypeLabel(request.request_type)} · {categoryLabel(request.category)}</p></div><Badge variant={isOverdue ? "destructive" : "secondary"}>{isOverdue ? "Vencida" : PRIORITY_LABELS[request.priority] ?? request.priority}</Badge></div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{STATUS_LABELS[request.status] ?? request.status}</span>{request.locations?.name && <span>{request.locations.name}</span>}{request.rooms?.room_number && <span>Hab. {request.rooms.room_number}</span>}</div>
                </button>
              })}
            </div>

            {selected && <div className="space-y-4 rounded-lg border p-4">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{requestTypeLabel(selected.request_type)}</h3><Badge>{STATUS_LABELS[selected.status] ?? selected.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Categoría: {categoryLabel(selected.category)}</p><p className="mt-1 text-sm text-muted-foreground">{selected.description || "Sin descripción adicional"}</p></div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label>Responsable</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Sin asignar</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</option>)}</select></div>
                <div className="space-y-1.5"><Label>Prioridad</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value)}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div className="space-y-1.5"><Label>Departamento</Label><Input value={department} onChange={(event) => setDepartment(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>SLA (min)</Label><Input type="number" min="1" value={slaMinutes} onChange={(event) => setSlaMinutes(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>Hora prometida</Label><Input type="datetime-local" value={promisedAt} onChange={(event) => setPromisedAt(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>Nota interna</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>Motivo de bloqueo</Label><Input value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>Motivo de escalamiento</Label><Input value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>URL de evidencia</Label><Input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>Resultado del servicio</Label><Input value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} /></div>
                <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={guestConfirmed} onChange={(event) => setGuestConfirmed(event.target.checked)} /> Huésped confirmó entrega</label>
                <div className="space-y-1.5"><Label>Satisfacción</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={satisfaction} onChange={(event) => setSatisfaction(event.target.value)}><option value="">Sin evaluar</option>{[1,2,3,4,5].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void update("assigned")} disabled={saving || !assignedTo}><UsersRound className="mr-2 h-4 w-4" />Asignar</Button>
                <Button variant="outline" onClick={() => void update("in_progress")} disabled={saving || !assignedTo}><Clock3 className="mr-2 h-4 w-4" />Iniciar</Button>
                <Button variant="outline" onClick={() => void update("blocked")} disabled={saving || !blockedReason.trim()}><AlertTriangle className="mr-2 h-4 w-4" />Bloquear</Button>
                <Button onClick={() => void update("completed")} disabled={saving || !completionNotes.trim()}><CheckCircle2 className="mr-2 h-4 w-4" />Completar</Button>
              </div>
            </div>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

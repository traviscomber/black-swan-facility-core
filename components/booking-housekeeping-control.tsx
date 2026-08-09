"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, MoonStar, PlayCircle, RefreshCw, Sparkles, UserRoundCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Employee = { id: string; name: string; role: string | null }
type Task = {
  id: string
  reservation_id: string | null
  room_id: string | null
  task_type: string
  status: string
  priority: string | null
  notes: string | null
  assigned_to: string | null
  scheduled_for: string | null
  due_at: string | null
  started_at: string | null
  completed_at: string | null
  guest_access_status: string
  blocked_reason: string | null
  requires_inspection: boolean
  verified_at: string | null
  inspection_status: string | null
  room: { room_number: string; location: { name: string } | null } | null
  reservation: { guest_name: string; check_in: string; check_out: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  pre_arrival_preparation: "Preparación previa a llegada",
  pre_arrival_inspection: "Inspección previa a llegada",
  stayover_cleaning: "Limpieza durante estadía",
  turnover: "Limpieza de salida",
  room_preparation: "Preparación de habitación",
  inspection: "Inspección operativa",
  cleaning: "Limpieza",
  deep_cleaning: "Limpieza profunda",
  post_checkout_cleaning: "Limpieza posterior a salida",
  post_checkout_laundry: "Lavandería posterior a salida",
  post_checkout_damage_review: "Revisión de daños posterior a salida",
  post_checkout_restock: "Reposición posterior a salida",
  room_release: "Liberación de habitación",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  assigned: "Asignada",
  in_progress: "En curso",
  inspection: "Pendiente de inspección",
  completed: "Completada",
  cancelled: "Cancelada",
  blocked: "Bloqueada",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
  critical: "Crítica",
}

const ACCESS_LABELS: Record<string, string> = {
  available: "Disponible",
  occupied: "Huésped presente",
  do_not_disturb: "No molestar",
  declined: "Acceso rechazado",
  blocked: "Bloqueado",
}

export function BookingHousekeepingControl() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [tasksResult, employeesResult] = await Promise.all([
      supabase
        .from("housekeeping_tasks")
        .select("id,reservation_id,room_id,task_type,status,priority,notes,assigned_to,scheduled_for,due_at,started_at,completed_at,guest_access_status,blocked_reason,requires_inspection,verified_at,inspection_status,room:rooms(room_number,location:locations(name)),reservation:reservations(guest_name,check_in,check_out)")
        .not("status", "in", "(completed,cancelled)")
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("employees").select("id,name,role").eq("is_active", true).order("name"),
    ])
    if (tasksResult.error || employeesResult.error) toast.error(tasksResult.error?.message ?? employeesResult.error?.message ?? "No fue posible cargar las tareas de limpieza")
    else {
      setTasks((tasksResult.data ?? []) as unknown as Task[])
      setEmployees((employeesResult.data ?? []) as Employee[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { if (open) void load() }, [load, open])
  useEffect(() => {
    const channel = supabase.channel("booking-housekeeping-control")
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => open && void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, open, supabase])

  async function canonicalAction(taskId: string, action: "assign" | "start" | "complete" | "approve", assignedTo?: string) {
    setSaving(taskId)
    const { error } = await supabase.rpc("update_housekeeping_task_operation", {
      p_task_id: taskId,
      p_action: action,
      p_assigned_to: assignedTo || null,
      p_notes: null,
      p_quality_score: null,
    })
    if (error) toast.error(error.message)
    else {
      const message = action === "approve" ? "Inspección aprobada" : "Tarea de limpieza actualizada"
      toast.success(message)
      await load()
    }
    setSaving(null)
  }

  async function accessAction(taskId: string, action: "do_not_disturb" | "decline", reason: string) {
    setSaving(taskId)
    const { error } = await supabase.rpc("manage_housekeeping_task", {
      p_task_id: taskId,
      p_action: action,
      p_assigned_to: null,
      p_reason: reason,
      p_reschedule_for: null,
    })
    if (error) toast.error(error.message)
    else { toast.success("Acceso de limpieza actualizado"); await load() }
    setSaving(null)
  }

  const overdue = tasks.filter((task) => task.due_at && new Date(task.due_at) < new Date() && !["completed", "cancelled"].includes(task.status)).length

  return <>
    <Button type="button" variant="outline" className="fixed bottom-5 right-[38rem] z-40 gap-2 shadow-lg" onClick={() => setOpen(true)}>
      <Sparkles className="h-4 w-4" />Limpieza
      {tasks.length > 0 && <Badge variant={overdue > 0 ? "destructive" : "secondary"}>{tasks.length}</Badge>}
    </Button>
    {open && <div className="fixed inset-0 z-[70] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Cerrar Limpieza" />
      <aside className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Operación canónica</p><h2 className="mt-1 text-xl font-semibold">Limpieza</h2><p className="mt-1 text-sm text-muted-foreground">Asignación, SLA, acceso del huésped, ejecución e inspección.</p></div>
          <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {tasks.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No hay tareas abiertas de limpieza.</div> : tasks.map((task) => {
            const isOverdue = Boolean(task.due_at && new Date(task.due_at) < new Date())
            return <div key={task.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{TYPE_LABELS[task.task_type] ?? task.task_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{task.room?.location?.name ?? "Sin propiedad"} · {task.room?.room_number ?? "Sin habitación"}{task.reservation?.guest_name ? ` · ${task.reservation.guest_name}` : ""}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline">Estado: {STATUS_LABELS[task.status] ?? task.status}</Badge>{task.priority && <Badge variant="secondary">Prioridad: {PRIORITY_LABELS[task.priority] ?? task.priority}</Badge>}{isOverdue && <Badge variant="destructive">SLA vencido</Badge>}</div></div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><div className="rounded border p-2"><Clock3 className="mb-1 h-4 w-4" />Programada: {task.scheduled_for ? new Date(task.scheduled_for).toLocaleString("es-CL") : "Sin hora"}</div><div className="rounded border p-2">Límite: {task.due_at ? new Date(task.due_at).toLocaleString("es-CL") : "Sin SLA"}</div><div className="rounded border p-2">Acceso: {ACCESS_LABELS[task.guest_access_status] ?? task.guest_access_status}</div></div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!task.assigned_to && <select className="h-9 rounded-md border bg-background px-2 text-xs" defaultValue="" onChange={(event) => event.target.value && void canonicalAction(task.id, "assign", event.target.value)}><option value="">Asignar responsable</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</option>)}</select>}
                {["assigned", "pending"].includes(task.status) && <Button size="sm" variant="outline" onClick={() => void canonicalAction(task.id, "start")} disabled={saving === task.id}><PlayCircle className="mr-2 h-4 w-4" />Iniciar</Button>}
                {task.status === "in_progress" && <Button size="sm" onClick={() => void canonicalAction(task.id, "complete")} disabled={saving === task.id}><CheckCircle2 className="mr-2 h-4 w-4" />Completar</Button>}
                {task.status === "inspection" && task.requires_inspection && <Button size="sm" onClick={() => void canonicalAction(task.id, "approve")} disabled={saving === task.id}><UserRoundCheck className="mr-2 h-4 w-4" />Aprobar inspección</Button>}
                {!["inspection", "completed", "cancelled"].includes(task.status) && <Button size="sm" variant="outline" onClick={() => void accessAction(task.id, "do_not_disturb", "No molestar registrado desde Booking")} disabled={saving === task.id}><MoonStar className="mr-2 h-4 w-4" />No molestar</Button>}
                {!["inspection", "completed", "cancelled"].includes(task.status) && <Button size="sm" variant="outline" onClick={() => void accessAction(task.id, "decline", "Servicio rechazado por el huésped")} disabled={saving === task.id}>Rechazado</Button>}
              </div>
              {task.status === "inspection" && <p className="mt-3 text-sm text-muted-foreground">La tarea está completada y requiere aprobación de inspección antes de liberar la habitación para el huésped.</p>}
              {task.blocked_reason && <p className="mt-3 text-sm text-muted-foreground">{task.blocked_reason}</p>}
            </div>
          })}
        </div>
      </aside>
    </div>}
  </>
}

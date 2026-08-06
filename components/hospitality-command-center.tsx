"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronRight, PlayCircle, RefreshCw, UserRoundCheck, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Employee = {
  id: string
  name: string
  role: string | null
}

type TaskKind = "housekeeping" | "hospitality"

type OperationalTask = {
  id: string
  kind: TaskKind
  title: string
  status: string
  priority: string | null
  assigned_to: string | null
  reservation_id: string | null
  room_id: string | null
  due_at: string | null
  notes: string | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  assigned: "Asignada",
  in_progress: "En curso",
  completed: "Completada",
  resolved: "Resuelta",
  cancelled: "Cancelada",
}

export function HospitalityCommandCenter() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tasks, setTasks] = useState<OperationalTask[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [employeesResult, housekeepingResult, hospitalityResult] = await Promise.all([
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase
        .from("housekeeping_tasks")
        .select("id, task_type, status, priority, assigned_to, reservation_id, room_id, due_at, notes")
        .not("status", "in", "(completed,cancelled)"),
      supabase
        .from("hospitality_requests")
        .select("id, request_type, status, priority, assigned_to, reservation_id, room_id, due_at, description")
        .not("status", "in", "(completed,resolved,cancelled)"),
    ])

    const firstError = employeesResult.error || housekeepingResult.error || hospitalityResult.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setEmployees((employeesResult.data ?? []) as Employee[])
    setTasks([
      ...((housekeepingResult.data ?? []).map((item) => ({
        id: item.id,
        kind: "housekeeping" as const,
        title: item.task_type,
        status: item.status,
        priority: item.priority,
        assigned_to: item.assigned_to,
        reservation_id: item.reservation_id,
        room_id: item.room_id,
        due_at: item.due_at,
        notes: item.notes,
      }))),
      ...((hospitalityResult.data ?? []).map((item) => ({
        id: item.id,
        kind: "hospitality" as const,
        title: item.request_type,
        status: item.status,
        priority: item.priority,
        assigned_to: item.assigned_to,
        reservation_id: item.reservation_id,
        room_id: item.room_id,
        due_at: item.due_at,
        notes: item.description,
      }))),
    ])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("hospitality-command-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => void load())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load, supabase])

  const unassigned = tasks.filter((task) => !task.assigned_to).length
  const inProgress = tasks.filter((task) => task.status === "in_progress").length

  async function assign(task: OperationalTask, employeeId: string) {
    if (!employeeId) return
    setSavingId(task.id)
    const table = task.kind === "housekeeping" ? "housekeeping_tasks" : "hospitality_requests"
    const { error: updateError } = await supabase.from(table).update({ assigned_to: employeeId, status: task.status === "pending" ? "assigned" : task.status }).eq("id", task.id)
    if (updateError) toast.error(updateError.message)
    else toast.success("Encargado asignado")
    setSavingId(null)
  }

  async function transition(task: OperationalTask, status: "in_progress" | "completed") {
    if (!task.assigned_to) {
      toast.warning("Asigna un encargado antes de iniciar o completar esta acción.")
      return
    }

    setSavingId(task.id)
    const table = task.kind === "housekeeping" ? "housekeeping_tasks" : "hospitality_requests"
    const updates: Record<string, unknown> = { status }
    if (status === "completed") updates.completed_at = new Date().toISOString()
    const { error: updateError } = await supabase.from(table).update(updates).eq("id", task.id)
    if (updateError) toast.error(updateError.message)
    else toast.success(status === "completed" ? "Acción completada" : "Acción iniciada")
    setSavingId(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-24 z-40 flex items-center gap-2 bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)]"
      >
        <Users className="h-4 w-4" />
        Control operativo
        {unassigned > 0 && <Badge variant="destructive">{unassigned}</Badge>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/35">
          <aside className="flex h-full w-full max-w-[520px] flex-col bg-[var(--background)] shadow-2xl">
            <header className="flex items-start justify-between bg-[var(--card)] p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--primary)]">Hospitality command center</p>
                <h2 className="mt-1 text-xl font-medium">Operación en tiempo real</h2>
                <p className="mt-1 text-sm text-muted-foreground">Asignar, iniciar y completar acciones sin salir del calendario.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </header>

            <div className="grid grid-cols-3 gap-px bg-[var(--border)]">
              <Metric label="Abiertas" value={tasks.length} />
              <Metric label="Sin encargado" value={unassigned} warning={unassigned > 0} />
              <Metric label="En curso" value={inProgress} />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-sm text-muted-foreground">Datos reales de Housekeeping y Hospitality</p>
              <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-6">
              {error && <div className="bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
              {loading && <div className="p-6 text-center text-sm text-muted-foreground">Cargando operación…</div>}
              {!loading && !error && tasks.length === 0 && <div className="bg-[var(--card)] p-5 text-sm text-muted-foreground">No hay acciones operacionales abiertas.</div>}

              {tasks.map((task) => {
                const assignee = employees.find((employee) => employee.id === task.assigned_to)
                return (
                  <article key={`${task.kind}-${task.id}`} className="bg-[var(--card)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{task.kind === "housekeeping" ? "Housekeeping" : "Hospitality"}</Badge>
                          <Badge variant="outline">{STATUS_LABELS[task.status] ?? task.status}</Badge>
                          {task.priority && <Badge variant="secondary">{task.priority}</Badge>}
                        </div>
                        <h3 className="mt-3 text-sm font-medium">{task.title}</h3>
                        {task.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.notes}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-4 bg-[var(--muted)] p-3">
                      <div className="flex items-center gap-2 text-sm">
                        {assignee ? <UserRoundCheck className="h-4 w-4 text-[var(--primary)]" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        <span>{assignee ? `${assignee.name}${assignee.role ? ` · ${assignee.role}` : ""}` : "Sin encargado"}</span>
                      </div>

                      <select
                        aria-label={`Asignar encargado a ${task.title}`}
                        value={task.assigned_to ?? ""}
                        onChange={(event) => void assign(task, event.target.value)}
                        disabled={savingId === task.id}
                        className="mt-3 h-10 w-full bg-[var(--background)] px-3 text-sm"
                      >
                        <option value="">Seleccionar encargado</option>
                        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` — ${employee.role}` : ""}</option>)}
                      </select>
                    </div>

                    <div className="mt-3 flex gap-2">
                      {task.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => void transition(task, "in_progress")} disabled={savingId === task.id || !task.assigned_to}><PlayCircle className="mr-2 h-4 w-4" />Iniciar</Button>}
                      <Button size="sm" onClick={() => void transition(task, "completed")} disabled={savingId === task.id || !task.assigned_to}><CheckCircle2 className="mr-2 h-4 w-4" />Completar</Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="bg-[var(--card)] px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={warning ? "mt-1 text-lg font-medium text-amber-500" : "mt-1 text-lg font-medium"}>{value}</p>
    </div>
  )
}

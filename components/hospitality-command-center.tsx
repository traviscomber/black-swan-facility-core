"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  Mail,
  Phone,
  PlayCircle,
  RefreshCw,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { BOOKING_COMMAND_SELECTION_EVENT } from "@/components/booking-calendar-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Employee = {
  id: string
  name: string
  role: string | null
}

type Reservation = {
  id: string
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string
  payment_status: string | null
  special_requests: string | null
  room_id: string | null
  bed_id: string | null
  room: {
    id: string
    room_number: string
    operational_status: string
    location: { name: string } | null
  } | null
  bed: { bed_number: string } | null
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

const TASK_KIND_LABELS: Record<TaskKind, string> = {
  housekeeping: "Limpieza",
  hospitality: "Hospitalidad",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
  critical: "Crítica",
}

const TASK_TITLE_LABELS: Record<string, string> = {
  turnover: "Limpieza de salida",
  room_preparation: "Preparación de habitación",
  inspection: "Inspección operativa",
  cleaning: "Limpieza",
  deep_cleaning: "Limpieza profunda",
  pre_arrival_preparation: "Preparación previa a llegada",
  pre_arrival_inspection: "Inspección previa a llegada",
  post_checkout_cleaning: "Limpieza posterior a salida",
  post_checkout_laundry: "Lavandería posterior a salida",
  post_checkout_damage_review: "Revisión de daños posterior a salida",
  post_checkout_restock: "Reposición posterior a salida",
  room_release: "Liberación de habitación",
  extra_towels: "Toallas adicionales",
  extra_bedding: "Ropa de cama adicional",
  room_service: "Servicio a la habitación",
  maintenance: "Mantenimiento",
  transport: "Transporte",
  food_beverage: "Alimentos y bebidas",
}

const ROOM_STATUS_LABELS: Record<string, string> = {
  ready: "Lista",
  inspected: "Inspeccionada",
  dirty: "Sucia",
  cleaning: "En limpieza",
  clean_pending_inspection: "Pendiente de inspección",
  occupied: "Ocupada",
  out_of_service: "Fuera de servicio",
  out_of_inventory: "Fuera de inventario",
}

function displayTaskTitle(task: OperationalTask) {
  return TASK_TITLE_LABELS[task.title] ?? task.title.replaceAll("_", " ")
}

function isRoomReady(status: string | null | undefined) {
  return status === "ready" || status === "inspected"
}

function nextAction(reservation: Reservation | null, tasks: OperationalTask[]) {
  if (!reservation) return null
  const openTasks = tasks.filter((task) => task.reservation_id === reservation.id || (task.room_id && task.room_id === reservation.room_id))
  const unassigned = openTasks.find((task) => !task.assigned_to)
  if (unassigned) return { label: `Asignar ${displayTaskTitle(unassigned)}`, detail: "La acción no puede comenzar sin encargado.", tone: "warning" as const }
  const pendingHousekeeping = openTasks.find((task) => task.kind === "housekeeping" && ["pending", "assigned"].includes(task.status))
  if (pendingHousekeeping) return { label: `Iniciar ${displayTaskTitle(pendingHousekeeping)}`, detail: "Es la siguiente dependencia operacional de la estadía.", tone: "normal" as const }
  if (["confirmed", "waiting_for_room", "ready_for_checkin"].includes(reservation.status)) {
    if (!isRoomReady(reservation.room?.operational_status)) {
      return { label: "Preparar habitación", detail: "La habitación aún no está lista para recibir al huésped.", tone: "warning" as const }
    }
    return { label: "Registrar entrada", detail: "La habitación está lista y la reserva puede ingresar.", tone: "normal" as const }
  }
  if (["checked_in", "checked-in"].includes(reservation.status)) {
    return { label: "Atender estadía", detail: openTasks.length ? "Hay acciones abiertas vinculadas al huésped." : "No existen excepciones operacionales abiertas.", tone: "normal" as const }
  }
  if (["checked_out", "checked-out"].includes(reservation.status)) {
    return { label: "Cerrar operación de salida", detail: "Verifique limpieza, consumos y documentación final.", tone: "normal" as const }
  }
  return { label: "Revisar reserva", detail: "La reserva requiere validación de su estado actual.", tone: "warning" as const }
}

export function HospitalityCommandCenter() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tasks, setTasks] = useState<OperationalTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmingCheckout, setConfirmingCheckout] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const reservationQuery = selectedReservationId
      ? supabase
          .from("reservations")
          .select("id, guest_name, guest_email, guest_phone, check_in, check_out, status, payment_status, special_requests, room_id, bed_id, room:rooms(id, room_number, operational_status, location:locations(name)), bed:beds(bed_number)")
          .eq("id", selectedReservationId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const [reservationResult, employeesResult, housekeepingResult, hospitalityResult] = await Promise.all([
      reservationQuery,
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

    const firstError = reservationResult.error || employeesResult.error || housekeepingResult.error || hospitalityResult.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setReservation((reservationResult.data ?? null) as unknown as Reservation | null)
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
  }, [selectedReservationId, supabase])

  useEffect(() => {
    const onSelection = (event: Event) => {
      const reservationId = (event as CustomEvent<{ reservationId?: string }>).detail?.reservationId
      if (!reservationId) return
      setSelectedReservationId(reservationId)
      setShowAll(false)
      setConfirmingCheckout(false)
    }
    window.addEventListener(BOOKING_COMMAND_SELECTION_EVENT, onSelection)
    return () => window.removeEventListener(BOOKING_COMMAND_SELECTION_EVENT, onSelection)
  }, [])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("hospitality-command-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => void load())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load, supabase])

  const relevantTasks = useMemo(() => {
    if (showAll || !reservation) return tasks
    return tasks.filter((task) => task.reservation_id === reservation.id || Boolean(task.room_id && task.room_id === reservation.room_id))
  }, [reservation, showAll, tasks])

  const unassigned = relevantTasks.filter((task) => !task.assigned_to).length
  const inProgress = relevantTasks.filter((task) => task.status === "in_progress").length
  const recommendation = nextAction(reservation, tasks)

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

  async function checkIn() {
    if (!reservation) return
    setSavingId(reservation.id)
    const { data, error: rpcError } = await supabase.rpc("check_in_or_queue", { p_reservation_id: reservation.id })
    if (rpcError) toast.error(rpcError.message)
    else toast.success((data as { message?: string } | null)?.message ?? "Llegada procesada")
    setSavingId(null)
  }

  async function checkOut() {
    if (!reservation) return
    setSavingId(reservation.id)
    const { error: updateError } = await supabase.from("reservations").update({ status: "checked_out" }).eq("id", reservation.id)
    if (updateError) {
      toast.error(updateError.message)
    } else {
      toast.success(`Salida registrada para ${reservation.guest_name}`)
      setConfirmingCheckout(false)
    }
    setSavingId(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-24 z-40 flex items-center gap-2 bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] shadow-lg"
      >
        <Users className="h-4 w-4" />
        {reservation ? reservation.guest_name : "Control operativo"}
        {unassigned > 0 && <Badge variant="destructive">{unassigned}</Badge>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/35">
          <aside className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl">
            <header className="flex items-start justify-between border-b border-[var(--border)] bg-[var(--card)] p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--primary)]">Centro de control de hospitalidad</p>
                <h2 className="mt-1 text-xl font-medium">{reservation?.guest_name ?? "Operación en tiempo real"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reservation
                    ? `${reservation.room?.location?.name ?? "Sin ubicación"} · ${reservation.room?.room_number ?? "Sin habitación"}${reservation.bed?.bed_number ? ` · Cama ${reservation.bed.bed_number}` : ""}`
                    : "Selecciona una reserva en el calendario para dirigir su operación."}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setOpen(false); setConfirmingCheckout(false) }}><X className="h-4 w-4" /></Button>
            </header>

            {reservation && (
              <div className="space-y-4 border-b border-[var(--border)] p-5">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{reservation.check_in} → {reservation.check_out}</span>
                  <span className="flex items-center gap-2"><BedDouble className="h-4 w-4" />{ROOM_STATUS_LABELS[reservation.room?.operational_status ?? ""] ?? "Sin estado"}</span>
                  {reservation.guest_phone && <a className="flex items-center gap-2 text-foreground" href={`tel:${reservation.guest_phone}`}><Phone className="h-4 w-4" />{reservation.guest_phone}</a>}
                  {reservation.guest_email && <a className="flex items-center gap-2 text-foreground" href={`mailto:${reservation.guest_email}`}><Mail className="h-4 w-4" />{reservation.guest_email}</a>}
                </div>

                {recommendation && (
                  <div className={recommendation.tone === "warning" ? "border border-amber-400/40 bg-amber-400/10 p-4" : "border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-4"}>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Próxima acción</p>
                    <p className="mt-1 font-medium">{recommendation.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{recommendation.detail}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {["confirmed", "waiting_for_room", "ready_for_checkin"].includes(reservation.status) && (
                    <Button size="sm" onClick={() => void checkIn()} disabled={savingId === reservation.id} className="min-w-40">
                      <LogIn className="mr-2 h-4 w-4" />Registrar entrada
                    </Button>
                  )}
                  {["checked_in", "checked-in"].includes(reservation.status) && !confirmingCheckout && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmingCheckout(true)}
                      disabled={savingId === reservation.id}
                      className="min-w-40 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                    >
                      <LogOut className="mr-2 h-4 w-4" />Preparar salida
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setShowAll((current) => !current)}>
                    {showAll ? "Ver solo esta estadía" : "Ver toda la operación"}
                  </Button>
                </div>

                {["checked_in", "checked-in"].includes(reservation.status) && confirmingCheckout && (
                  <div className="border border-destructive/45 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-destructive">Confirmar salida</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{reservation.guest_name}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {reservation.room?.location?.name ?? "Sin ubicación"} · {reservation.room?.room_number ?? "Sin habitación"}
                          {reservation.bed?.bed_number ? ` · Cama ${reservation.bed.bed_number}` : ""}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-y border-destructive/20 py-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Entrada</p>
                            <p className="mt-1 font-medium text-foreground">{reservation.check_in}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Salida programada</p>
                            <p className="mt-1 font-medium text-foreground">{reservation.check_out}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          Esta acción cerrará la estadía y activará el flujo posterior a la salida. Confirma solo cuando el huésped realmente haya dejado la habitación.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void checkOut()}
                            disabled={savingId === reservation.id}
                          >
                            <LogOut className="mr-2 h-4 w-4" />Sí, registrar salida
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmingCheckout(false)} disabled={savingId === reservation.id}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reservation.special_requests && (
                  <div className="bg-[var(--muted)] p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Solicitud especial</p>
                    <p className="mt-1 leading-5">{reservation.special_requests}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-px bg-[var(--border)]">
              <Metric label="Abiertas" value={relevantTasks.length} />
              <Metric label="Sin encargado" value={unassigned} warning={unassigned > 0} />
              <Metric label="En curso" value={inProgress} />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-sm text-muted-foreground">{showAll || !reservation ? "Toda la operación" : "Acciones de esta estadía"}</p>
              <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-6">
              {error && <div className="bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
              {loading && <div className="p-6 text-center text-sm text-muted-foreground">Cargando operación…</div>}
              {!loading && !error && relevantTasks.length === 0 && <div className="bg-[var(--card)] p-5 text-sm text-muted-foreground">No hay acciones operacionales abiertas en este contexto.</div>}

              {relevantTasks.map((task) => {
                const assignee = employees.find((employee) => employee.id === task.assigned_to)
                const taskTitle = displayTaskTitle(task)
                return (
                  <article key={`${task.kind}-${task.id}`} className="border border-[var(--border)] bg-[var(--card)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Área: {TASK_KIND_LABELS[task.kind]}</Badge>
                          <Badge variant="outline">Estado: {STATUS_LABELS[task.status] ?? task.status}</Badge>
                          {task.priority && <Badge variant="secondary">Prioridad: {PRIORITY_LABELS[task.priority] ?? task.priority}</Badge>}
                        </div>
                        <h3 className="mt-3 text-sm font-medium">{taskTitle}</h3>
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
                        aria-label={`Asignar encargado a ${taskTitle}`}
                        value={task.assigned_to ?? ""}
                        onChange={(event) => void assign(task, event.target.value)}
                        disabled={savingId === task.id}
                        className="mt-3 h-10 w-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
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

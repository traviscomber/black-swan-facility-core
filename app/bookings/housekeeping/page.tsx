"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BedDouble, CheckCircle2, ClipboardPlus, Clock3, Loader2, PlayCircle, Search, ShieldCheck, Sparkles, UserRound, XCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LinkedOperationalTask } from "@/components/linked-operational-task"
import { buildOperationalTaskHref } from "@/lib/operational-task-links"
import { useLanguage } from "@/lib/hooks/use-language"
import { housekeepingStatusTranslations, housekeepingTranslations } from "@/lib/translations/housekeeping"

const supabase = createClient()

type Employee = { id: string; name: string; role: string | null }
type Room = { id: string; room_number: string; location: string | null; status: string | null }
type Reservation = { id: string; guest_name: string; check_in: string; check_out: string }
type Task = {
  id: string
  reservation_id: string | null
  room_id: string | null
  task_type: string
  status: string | null
  assigned_to: string | null
  priority: string | null
  notes: string | null
  created_at: string | null
  completed_at: string | null
  service_date: string | null
  scheduled_for: string | null
  due_at: string | null
  requires_inspection: boolean | null
  inspection_status: string | null
  inspected_at: string | null
  room: Room | Room[] | null
  employee: Employee | Employee[] | null
  reservation: Reservation | Reservation[] | null
}
type Departure = { id: string; guest_name: string; check_out: string; room_id: string | null; room: Room | Room[] | null }

const roomOf = (value: Room | Room[] | null) => Array.isArray(value) ? value[0] ?? null : value
const employeeOf = (value: Employee | Employee[] | null) => Array.isArray(value) ? value[0] ?? null : value
const reservationOf = (value: Reservation | Reservation[] | null) => Array.isArray(value) ? value[0] ?? null : value
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())
const priorityMap: Record<string, "baja" | "media" | "alta" | "urgente"> = { low: "baja", medium: "media", high: "alta", critical: "urgente" }
const OPEN_TASK_STATUSES = new Set(["pending", "assigned", "in_progress", "inspection"])

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00-04:00`)
  date.setDate(date.getDate() + days)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(date)
}

function formatOperationalDate(value: string | null) {
  if (!value) return "Sin hora"
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

export default function HousekeepingPage() {
  const { language } = useLanguage()
  const copy = housekeepingTranslations[language]
  const statusCopy = housekeepingStatusTranslations[language]
  const [tasks, setTasks] = useState<Task[]>([])
  const [departures, setDepartures] = useState<Departure[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("open")

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const currentDate = today()

    const [tasksResult, departuresResult, employeesResult, roomsResult, reservationsResult, manageResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("id, reservation_id, room_id, task_type, status, assigned_to, priority, notes, created_at, completed_at, service_date, scheduled_for, due_at, requires_inspection, inspection_status, inspected_at").order("scheduled_for", { ascending: true, nullsFirst: false }).limit(300),
      supabase.from("reservations").select("id, guest_name, check_out, room_id").eq("check_out", currentDate).not("status", "eq", "cancelled"),
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("rooms").select("id, room_number, location, status"),
      supabase.from("reservations").select("id, guest_name, check_in, check_out").limit(1000),
      supabase.rpc("can_app_action", { p_action_key: "housekeeping.manage" }),
    ])

    const criticalErrors = [tasksResult.error, roomsResult.error, reservationsResult.error].filter(Boolean)
    if (criticalErrors.length > 0) {
      const message = criticalErrors.map((error) => error?.message).filter(Boolean).join(" · ")
      setLoadError(message || "No fue posible cargar la operación de limpieza")
      toast.error(message || "No fue posible cargar la operación de limpieza")
      setTasks([])
    } else {
      const rooms = (roomsResult.data ?? []) as Room[]
      const reservationRows = (reservationsResult.data ?? []) as Reservation[]
      const employeeRows = (employeesResult.data ?? []) as Employee[]
      const roomMap = new Map(rooms.map((room) => [room.id, room]))
      const reservationMap = new Map(reservationRows.map((reservation) => [reservation.id, reservation]))
      const employeeMap = new Map(employeeRows.map((employee) => [employee.id, employee]))
      const enrichedTasks = (tasksResult.data ?? []).map((task) => ({
        ...task,
        room: task.room_id ? roomMap.get(task.room_id) ?? null : null,
        employee: task.assigned_to ? employeeMap.get(task.assigned_to) ?? null : null,
        reservation: task.reservation_id ? reservationMap.get(task.reservation_id) ?? null : null,
      })) as Task[]
      setTasks(enrichedTasks)
    }

    const rooms = (roomsResult.data ?? []) as Room[]
    const roomMap = new Map(rooms.map((room) => [room.id, room]))
    setDepartures(((departuresResult.data ?? []) as Array<Omit<Departure, "room">>).map((departure) => ({ ...departure, room: departure.room_id ? roomMap.get(departure.room_id) ?? null : null })))
    setEmployees((employeesResult.data ?? []) as Employee[])
    setCanManage(Boolean(manageResult.data))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
    const channel = supabase.channel("bookings-housekeeping").on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadData()).on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData()).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData])

  const openTasks = tasks.filter((task) => OPEN_TASK_STATUSES.has(task.status ?? "pending"))
  const completedToday = tasks.filter((task) => task.status === "completed" && task.completed_at && new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(task.completed_at)) === today())
  const unassigned = openTasks.filter((task) => !task.assigned_to)
  const windowStart = today()
  const windowEnd = addDays(windowStart, 2)
  const supervisorQueue = useMemo(() => tasks
    .filter((task) => task.requires_inspection && task.inspection_status !== "approved" && task.service_date && task.service_date >= windowStart && task.service_date <= windowEnd)
    .sort((a, b) => (a.scheduled_for ?? "9999").localeCompare(b.scheduled_for ?? "9999")), [tasks, windowEnd, windowStart])
  const readyForApproval = supervisorQueue.filter((task) => task.status === "inspection")

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const room = roomOf(task.room)
    const employee = employeeOf(task.employee)
    const reservation = reservationOf(task.reservation)
    const matchesText = `${room?.room_number ?? ""} ${room?.location ?? ""} ${task.task_type} ${employee?.name ?? ""} ${reservation?.guest_name ?? ""}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || (statusFilter === "open" ? OPEN_TASK_STATUSES.has(task.status ?? "pending") : task.status === statusFilter)
    return matchesText && matchesStatus
  }), [tasks, search, statusFilter])

  async function assignTask(taskId: string, assignedTo: string) {
    setSavingId(taskId)
    const { error } = await supabase.rpc("update_housekeeping_task_operation", { p_task_id: taskId, p_action: "assign", p_assigned_to: assignedTo, p_notes: null, p_quality_score: null })
    if (error) toast.error(error.message)
    else toast.success("Responsable actualizado")
    setSavingId(null)
    await loadData()
  }

  async function runTaskAction(task: Task, action: "start" | "complete") {
    if (!task.assigned_to) {
      toast.error("Asigna un responsable antes de ejecutar la tarea")
      return
    }
    setSavingId(task.id)
    const { error } = await supabase.rpc("update_housekeeping_task_operation", { p_task_id: task.id, p_action: action, p_assigned_to: null, p_notes: null, p_quality_score: null })
    if (error) toast.error(error.message)
    else toast.success(action === "start" ? "Tarea iniciada" : task.requires_inspection ? "Tarea enviada a inspección" : "Tarea completada")
    setSavingId(null)
    await loadData()
  }

  async function reviewTask(task: Task, action: "approve" | "reject") {
    if (!canManage) {
      toast.error("Se requiere permiso de supervisión de Housekeeping")
      return
    }
    let notes: string | null = null
    if (action === "reject") {
      notes = window.prompt("Motivo de rechazo de la inspección")?.trim() || null
      if (!notes) return
    }
    setSavingId(task.id)
    const { error } = await supabase.rpc("update_housekeeping_task_operation", { p_task_id: task.id, p_action: action, p_assigned_to: null, p_notes: notes, p_quality_score: null })
    if (error) toast.error(error.message)
    else toast.success(action === "approve" ? "Inspección aprobada" : "Tarea devuelta para corrección")
    setSavingId(null)
    await loadData()
  }

  async function syncDepartureLifecycle(departure: Departure) {
    if (!departure.room_id) return
    setSavingId(departure.id)
    const { error } = await supabase.rpc("sync_reservation_housekeeping_lifecycle", { p_reservation_id: departure.id })
    if (error) toast.error(error.message)
    else toast.success(copy.taskCreated)
    setSavingId(null)
    await loadData()
  }

  const localizedHref = (href: string) => href.startsWith("/") ? `/${language}${href}` : href

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>

  return <div className="space-y-6 p-4 md:p-6">
    <div><h1 className="text-2xl font-semibold">{copy.title}</h1><p className="text-sm text-muted-foreground">{copy.subtitle}</p></div>
    {loadError && <Card className="border-destructive/40 bg-destructive/10"><CardContent className="flex items-start gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><p className="font-medium text-destructive">No fue posible cargar la operación de limpieza</p><p className="mt-1 text-sm text-muted-foreground">No interpretes los indicadores como cero. Actualiza la página o contacta al administrador.</p></div></CardContent></Card>}
    <div className="grid gap-4 md:grid-cols-5"><Metric title={copy.departuresToday} value={departures.length} icon={<BedDouble className="h-5 w-5" />} /><Metric title={copy.openTasks} value={openTasks.length} icon={<Clock3 className="h-5 w-5" />} /><Metric title={copy.unassigned} value={unassigned.length} icon={<UserRound className="h-5 w-5" />} /><Metric title="Por aprobar" value={readyForApproval.length} icon={<ShieldCheck className="h-5 w-5" />} /><Metric title={copy.completedToday} value={completedToday.length} icon={<CheckCircle2 className="h-5 w-5" />} /></div>

    {canManage && <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Supervisión · próximas 72 horas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Todas las tareas que requieren inspección aparecen aquí antes de su hora programada. Aprobar/Rechazar se habilita cuando el equipo termina la ejecución.</p>
        {supervisorQueue.length === 0 && <p className="text-sm text-muted-foreground">No hay inspecciones pendientes en la ventana operativa.</p>}
        {supervisorQueue.map((task) => {
          const room = roomOf(task.room)
          const reservation = reservationOf(task.reservation)
          const ready = task.status === "inspection"
          return <div key={`supervisor-${task.id}`} className="flex flex-col gap-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{room?.room_number ?? "Sin habitación"} · {reservation?.guest_name ?? task.task_type.replaceAll("_", " ")}</p><Badge variant={ready ? "default" : "outline"}>{ready ? "Lista para aprobar" : statusCopy[task.status ?? "pending"] ?? task.status ?? "Pendiente"}</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">{task.task_type.replaceAll("_", " ")} · {formatOperationalDate(task.scheduled_for)} · inspección {task.inspection_status ?? "pending"}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={!ready || savingId === task.id} onClick={() => void reviewTask(task, "approve")}><CheckCircle2 className="mr-2 h-4 w-4" />Aprobar</Button>
              <Button size="sm" variant="outline" disabled={!ready || savingId === task.id} onClick={() => void reviewTask(task, "reject")}><XCircle className="mr-2 h-4 w-4" />Rechazar</Button>
            </div>
          </div>
        })}
      </CardContent>
    </Card>}

    <Card><CardHeader><CardTitle className="text-base">{copy.departuresToday}</CardTitle></CardHeader><CardContent className="space-y-3">{departures.length === 0 && <p className="text-sm text-muted-foreground">{copy.noDepartures}</p>}{departures.map((departure) => { const room = roomOf(departure.room); const taskExists = tasks.some((task) => task.reservation_id === departure.id && task.task_type === "post_checkout_cleaning"); return <div key={departure.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{room?.room_number ?? copy.noRoom} · {departure.guest_name}</p><p className="text-sm text-muted-foreground">{room?.location ?? copy.noLocation}</p></div><Button size="sm" variant={taskExists ? "secondary" : "default"} disabled={taskExists || savingId === departure.id} onClick={() => void syncDepartureLifecycle(departure)}>{savingId === departure.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{taskExists ? copy.taskCreated : copy.createCleaning}</Button></div> })}</CardContent></Card>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder={copy.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">{copy.open}</SelectItem><SelectItem value="pending">{copy.pending}</SelectItem><SelectItem value="assigned">{statusCopy.assigned ?? "Asignada"}</SelectItem><SelectItem value="in_progress">{copy.inProgress}</SelectItem><SelectItem value="inspection">Inspección</SelectItem><SelectItem value="completed">{copy.completed}</SelectItem><SelectItem value="all">{copy.all}</SelectItem></SelectContent></Select></div>
    <div className="grid gap-4 lg:grid-cols-2">{filteredTasks.map((task) => { const room = roomOf(task.room); const employee = employeeOf(task.employee); const reservation = reservationOf(task.reservation); const isCheckoutCleaning = task.task_type === "post_checkout_cleaning"; const taskHref = buildOperationalTaskHref({ template: isCheckoutCleaning ? "hk-checkout" : undefined, area: "housekeeping", title: `${isCheckoutCleaning ? "Limpieza posterior a salida" : "Tarea de housekeeping"} · Habitación ${room?.room_number ?? "sin número"}`, description: task.notes || `Ejecutar ${task.task_type.replaceAll("_", " ")} y registrar novedades.`, category: "Habitaciones", priority: priorityMap[task.priority ?? "medium"] || "media", sourceType: "housekeeping_task", sourceId: task.id, sourceLabel: `Housekeeping · Habitación ${room?.room_number ?? "—"}`, sourcePath: "/bookings/housekeeping" }); return <Card key={task.id}><CardContent className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{copy.room} {room?.room_number ?? "—"}</p><p className="text-sm text-muted-foreground">{reservation?.guest_name ? `${reservation.guest_name} · ` : ""}{isCheckoutCleaning ? copy.checkoutCleaning : copy.housekeepingTask} · {room?.location ?? copy.noLocation}</p></div><Badge variant={task.status === "completed" ? "secondary" : "outline"}>{statusCopy[task.status ?? "pending"] ?? task.status ?? statusCopy.pending}</Badge></div>{task.notes && <p className="text-sm">{task.notes}</p>}<LinkedOperationalTask sourceType="housekeeping_task" sourceId={task.id} /><div className="grid gap-3 sm:grid-cols-2"><Select value={task.assigned_to ?? undefined} onValueChange={(value) => void assignTask(task.id, value)} disabled={savingId === task.id || task.status === "completed" || task.status === "inspection"}><SelectTrigger><SelectValue placeholder={copy.assignee} /></SelectTrigger><SelectContent>{employees.map((employeeOption) => <SelectItem key={employeeOption.id} value={employeeOption.id}>{employeeOption.name}</SelectItem>)}</SelectContent></Select><div className="flex gap-2">{["pending", "assigned"].includes(task.status ?? "pending") && <Button type="button" className="flex-1" variant="outline" disabled={!task.assigned_to || savingId === task.id} onClick={() => void runTaskAction(task, "start")}><PlayCircle className="mr-2 h-4 w-4" />{copy.inProgress}</Button>}{task.status === "in_progress" && <Button type="button" className="flex-1" disabled={savingId === task.id} onClick={() => void runTaskAction(task, "complete")}><CheckCircle2 className="mr-2 h-4 w-4" />{task.requires_inspection ? "Enviar a inspección" : copy.completed}</Button>}{task.status === "inspection" && <span className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Esperando supervisión</span>}</div></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-muted-foreground">{employee?.name ?? copy.noAssignee}{task.scheduled_for ? ` · ${formatOperationalDate(task.scheduled_for)}` : ""}</span><Button asChild size="sm" variant="outline"><Link href={localizedHref(taskHref)}><ClipboardPlus className="mr-2 h-4 w-4" />{copy.createOperationalTask}</Link></Button>{savingId === task.id && <Loader2 className="h-4 w-4 animate-spin" />}</div></CardContent></Card> })}</div>
  </div>
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-semibold">{value}</p></div>{icon}</CardContent></Card> }

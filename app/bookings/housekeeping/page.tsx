"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BedDouble, CheckCircle2, Clock3, Loader2, Search, Sparkles, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const supabase = createClient()

type Employee = { id: string; name: string; role: string | null }
type Room = { id: string; room_number: string; location: string | null; status: string | null }
type Task = {
  id: string
  room_id: string | null
  task_type: string
  status: string | null
  assigned_to: string | null
  priority: string | null
  notes: string | null
  created_at: string | null
  completed_at: string | null
  room: Room | Room[] | null
  employee: Employee | Employee[] | null
}
type Departure = {
  id: string
  guest_name: string
  check_out: string
  room_id: string | null
  room: Room | Room[] | null
}

const roomOf = (value: Room | Room[] | null) => Array.isArray(value) ? value[0] ?? null : value
const employeeOf = (value: Employee | Employee[] | null) => Array.isArray(value) ? value[0] ?? null : value
const today = () => new Date().toISOString().slice(0, 10)

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [departures, setDepartures] = useState<Departure[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("open")

  const loadData = useCallback(async () => {
    setLoading(true)
    const currentDate = today()
    const [tasksResult, departuresResult, employeesResult] = await Promise.all([
      supabase
        .from("housekeeping_tasks")
        .select("id, room_id, task_type, status, assigned_to, priority, notes, created_at, completed_at, room:rooms(id, room_number, location, status), employee:employees(id, name, role)")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("reservations")
        .select("id, guest_name, check_out, room_id, room:rooms(id, room_number, location, status)")
        .eq("check_out", currentDate)
        .not("status", "eq", "cancelled"),
      supabase
        .from("employees")
        .select("id, name, role")
        .eq("is_active", true)
        .order("name"),
    ])

    setTasks((tasksResult.data ?? []) as Task[])
    setDepartures((departuresResult.data ?? []) as Departure[])
    setEmployees((employeesResult.data ?? []) as Employee[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
    const channel = supabase
      .channel("bookings-housekeeping")
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData])

  const openTasks = tasks.filter((task) => task.status !== "completed")
  const completedToday = tasks.filter((task) => task.status === "completed" && task.completed_at?.slice(0, 10) === today())
  const unassigned = openTasks.filter((task) => !task.assigned_to)

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const room = roomOf(task.room)
    const employee = employeeOf(task.employee)
    const matchesText = `${room?.room_number ?? ""} ${room?.location ?? ""} ${task.task_type} ${employee?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || (statusFilter === "open" ? task.status !== "completed" : task.status === statusFilter)
    return matchesText && matchesStatus
  }), [tasks, search, statusFilter])

  async function updateTask(taskId: string, values: Record<string, unknown>) {
    setSavingId(taskId)
    const payload = values.status === "completed"
      ? { ...values, completed_at: new Date().toISOString() }
      : values
    await supabase.from("housekeeping_tasks").update(payload).eq("id", taskId)
    setSavingId(null)
    await loadData()
  }

  async function createDepartureTask(departure: Departure) {
    if (!departure.room_id) return
    setSavingId(departure.id)
    const exists = tasks.some((task) => task.room_id === departure.room_id && task.task_type === "checkout_cleaning" && task.created_at?.slice(0, 10) === today())
    if (!exists) {
      await supabase.from("housekeeping_tasks").insert({
        room_id: departure.room_id,
        task_type: "checkout_cleaning",
        status: "pending",
        priority: "high",
        notes: `Limpieza posterior a salida de ${departure.guest_name}`,
      })
      await supabase.from("rooms").update({ status: "dirty" }).eq("id", departure.room_id)
    }
    setSavingId(null)
    await loadData()
  }

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Housekeeping</h1>
        <p className="text-sm text-muted-foreground">Salidas, limpieza, asignaciones y disponibilidad de habitaciones.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Salidas de hoy" value={departures.length} icon={<BedDouble className="h-5 w-5" />} />
        <Metric title="Tareas abiertas" value={openTasks.length} icon={<Clock3 className="h-5 w-5" />} />
        <Metric title="Sin asignar" value={unassigned.length} icon={<UserRound className="h-5 w-5" />} />
        <Metric title="Completadas hoy" value={completedToday.length} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Salidas de hoy</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {departures.length === 0 && <p className="text-sm text-muted-foreground">No hay salidas programadas para hoy.</p>}
          {departures.map((departure) => {
            const room = roomOf(departure.room)
            const taskExists = tasks.some((task) => task.room_id === departure.room_id && task.task_type === "checkout_cleaning" && task.created_at?.slice(0, 10) === today())
            return (
              <div key={departure.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{room?.room_number ?? "Sin habitación"} · {departure.guest_name}</p><p className="text-sm text-muted-foreground">{room?.location ?? "Sin ubicación"}</p></div>
                <Button size="sm" variant={taskExists ? "secondary" : "default"} disabled={taskExists || savingId === departure.id} onClick={() => void createDepartureTask(departure)}>
                  {savingId === departure.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {taskExists ? "Tarea creada" : "Crear limpieza"}
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar habitación, ubicación o responsable" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Abiertas</SelectItem><SelectItem value="pending">Pendientes</SelectItem><SelectItem value="in_progress">En progreso</SelectItem><SelectItem value="completed">Completadas</SelectItem><SelectItem value="all">Todas</SelectItem></SelectContent></Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredTasks.map((task) => {
          const room = roomOf(task.room)
          const employee = employeeOf(task.employee)
          return (
            <Card key={task.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">Habitación {room?.room_number ?? "—"}</p><p className="text-sm text-muted-foreground">{task.task_type.replaceAll("_", " ")} · {room?.location ?? "Sin ubicación"}</p></div>
                  <Badge variant={task.status === "completed" ? "secondary" : "outline"}>{task.status ?? "pending"}</Badge>
                </div>
                {task.notes && <p className="text-sm">{task.notes}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={task.assigned_to ?? "unassigned"} onValueChange={(value) => void updateTask(task.id, { assigned_to: value === "unassigned" ? null : value })}><SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Sin asignar</SelectItem>{employees.map((employeeOption) => <SelectItem key={employeeOption.id} value={employeeOption.id}>{employeeOption.name}</SelectItem>)}</SelectContent></Select>
                  <Select value={task.status ?? "pending"} onValueChange={(value) => void updateTask(task.id, { status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="in_progress">En progreso</SelectItem><SelectItem value="completed">Completada</SelectItem></SelectContent></Select>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{employee?.name ?? "Sin responsable"}</span>{savingId === task.id && <Loader2 className="h-4 w-4 animate-spin" />}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-semibold">{value}</p></div>{icon}</CardContent></Card>
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, CheckCircle2, Clock, MapPin, Plus, Users } from "lucide-react"
import { format, isPast, isThisWeek, isToday, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { AppLayout } from "@/components/app-layout"
import { AddTaskDialog } from "@/components/add-task-dialog"
import { EditTaskDialog } from "@/components/edit-task-dialog"
import { TaskDetailPanel } from "@/components/task-detail-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type TaskPriority = "baja" | "media" | "alta" | "urgente"

type Task = {
  id: string
  title: string
  description?: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date?: string | null
  location_name?: string | null
  latitude?: number | null
  longitude?: number | null
  created_at: string
  completed_at?: string | null
  task_assignments: Array<{
    employee_id: string
    employees?: { id: string; name: string; email?: string | null } | null
  }>
}

const priorityLabels: Record<TaskPriority, string> = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" }
const statusLabels: Record<TaskStatus, string> = { nueva: "Pendiente", en_progreso: "En curso", completada: "Completada", cancelada: "Cancelada" }
const priorityClasses: Record<TaskPriority, string> = {
  baja: "border-muted-foreground/20 bg-muted text-muted-foreground",
  media: "border-amber-300 bg-amber-50 text-amber-800",
  alta: "border-orange-300 bg-orange-50 text-orange-800",
  urgente: "border-destructive/30 bg-destructive/5 text-destructive",
}

export default function TasksPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("pendientes")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchTasks() {
    setIsLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from("tasks")
      .select("*, task_assignments(employee_id, employees(id, name, email))")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (fetchError) setError(fetchError.message)
    else {
      const nextTasks = (data ?? []) as Task[]
      setTasks(nextTasks)
      setSelectedTask((current) => current ? nextTasks.find((task) => task.id === current.id) ?? null : null)
    }
    setIsLoading(false)
  }

  useEffect(() => { void fetchTasks() }, [])

  const openTasks = tasks.filter((task) => task.status === "nueva" || task.status === "en_progreso")
  const overdue = openTasks.filter((task) => task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date))).length
  const stats = {
    pendientes: openTasks.length,
    hoy: openTasks.filter((task) => task.due_date && isToday(parseISO(task.due_date))).length,
    completadasSemana: tasks.filter((task) => task.status === "completada" && task.completed_at && isThisWeek(parseISO(task.completed_at), { weekStartsOn: 1 })).length,
    responsables: new Set(openTasks.flatMap((task) => task.task_assignments.map((assignment) => assignment.employee_id))).size,
  }

  const filteredTasks = tasks.filter((task) => {
    if (activeTab === "pendientes") return task.status === "nueva" || task.status === "en_progreso"
    if (activeTab === "completadas") return task.status === "completada"
    if (activeTab === "canceladas") return task.status === "cancelada"
    return true
  })

  return (
    <AppLayout>
      <div className="space-y-6 p-4 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="text-2xl font-bold text-accent sm:text-3xl">Tareas operativas</h1><p className="mt-1 text-sm text-muted-foreground">Coordinación simple de trabajos, responsables, lugar y fecha objetivo.</p></div>
          <Button onClick={() => setIsAddDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nueva tarea</Button>
        </div>

        {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar las tareas: {error}</CardContent></Card>}
        {overdue > 0 && !error && <Card className="border-amber-300"><CardContent className="flex gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-medium">Hay {overdue} tarea{overdue === 1 ? "" : "s"} vencida{overdue === 1 ? "" : "s"}</p><p className="mt-1 text-sm text-muted-foreground">Los registros antiguos o de prueba deben revisarse, completarse o cancelarse; no se eliminaron automáticamente.</p></div></CardContent></Card>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Clock} label="Pendientes" value={stats.pendientes} />
          <Metric icon={Calendar} label="Con fecha para hoy" value={stats.hoy} />
          <Metric icon={CheckCircle2} label="Completadas esta semana" value={stats.completadasSemana} />
          <Metric icon={Users} label="Responsables en tareas abiertas" value={stats.responsables} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit sm:grid-cols-4">
            <TabsTrigger value="pendientes">Pendientes</TabsTrigger><TabsTrigger value="completadas">Completadas</TabsTrigger><TabsTrigger value="canceladas">Canceladas</TabsTrigger><TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            <CardHeader><CardTitle className="text-base">Lista de trabajo</CardTitle><p className="text-sm text-muted-foreground">Una tarea puede tener uno o más responsables. No representa control de asistencia ni turnos.</p></CardHeader>
            <CardContent>
              {isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando tareas…</p> : filteredTasks.length === 0 ? <div className="py-10 text-center"><p className="font-medium">No hay tareas en esta vista.</p><p className="mt-1 text-sm text-muted-foreground">Registra solo trabajos que necesiten responsable o seguimiento.</p></div> : <div className="space-y-3">{filteredTasks.map((task) => {
                const due = task.due_date ? parseISO(task.due_date) : null
                const isOverdue = due && isPast(due) && !isToday(due) && task.status !== "completada" && task.status !== "cancelada"
                const names = task.task_assignments.map((assignment) => assignment.employees?.name).filter(Boolean) as string[]
                return <button key={task.id} type="button" onClick={() => setSelectedTask(task)} className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${selectedTask?.id === task.id ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{task.title}</h2><p className="mt-1 text-xs text-muted-foreground">{statusLabels[task.status]}</p></div><Badge variant="outline" className={priorityClasses[task.priority]}>{priorityLabels[task.priority]}</Badge></div>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">{task.location_name && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{task.location_name}</p>}{due && <p className={`flex items-center gap-1.5 ${isOverdue ? "font-medium text-destructive" : ""}`}><Calendar className="h-3.5 w-3.5" />{isOverdue ? "Vencida · " : ""}{format(due, "d 'de' MMMM 'de' yyyy", { locale: es })}</p>}<p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{names.length ? names.join(", ") : "Sin responsable"}</p></div>
                </button>
              })}</div>}
            </CardContent>
          </Card>

          <Card className="min-h-[360px] overflow-hidden">{selectedTask ? <TaskDetailPanel task={selectedTask} onUpdate={() => void fetchTasks()} onClose={() => setSelectedTask(null)} onEdit={(task) => { setTaskToEdit(task as Task); setIsEditDialogOpen(true) }} /> : <div className="flex min-h-[360px] items-center justify-center p-8 text-center text-sm text-muted-foreground">Selecciona una tarea para revisar su detalle y actualizar el estado.</div>}</Card>
        </div>

        <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onTaskCreated={() => void fetchTasks()} />
        {taskToEdit && <EditTaskDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onTaskUpdated={() => { void fetchTasks(); setTaskToEdit(null) }} task={taskToEdit} />}
      </div>
    </AppLayout>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value.toLocaleString("es-CL")}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, CheckCircle2, Clock, Link2, MapPin, Plus, Users } from "lucide-react"
import { isPast, isThisWeek, isToday, parseISO } from "date-fns"
import { AppLayout } from "@/components/app-layout"
import { AddTaskDialog } from "@/components/add-task-dialog"
import { EditTaskDialog } from "@/components/edit-task-dialog"
import { TaskDetailPanel } from "@/components/task-detail-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { operationalAreaLabels, type OperationalArea } from "@/lib/operational-task-templates"
import type { OperationalTaskPrefill, TaskSourceType } from "@/lib/operational-task-links"

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type TaskPriority = "baja" | "media" | "alta" | "urgente"
type TaskView = "operacion" | "asana" | "demo" | "completadas" | "canceladas" | "todas"
type TaskAssignment = { employee_id?: string | null; volunteer_id?: string | null; employees?: { id: string; name: string; email?: string | null; phone?: string | null } | null; volunteers?: { id: string; name: string; email?: string | null; phone?: string | null; volunteer_role?: string | null } | null }
export type OperationalTask = { id: string; title: string; description?: string | null; priority: TaskPriority; status: TaskStatus; due_date?: string | null; location_name?: string | null; location_id?: string | null; latitude?: number | null; longitude?: number | null; created_at: string; completed_at?: string | null; operational_area?: OperationalArea | null; task_category?: string | null; estimated_minutes?: number | null; animal_handling?: boolean; safety_notes?: string | null; source_type?: TaskSourceType | null; source_id?: string | null; source_label?: string | null; source_path?: string | null; task_assignments: TaskAssignment[] }

const priorityClasses: Record<TaskPriority, string> = {
  baja: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
  media: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  alta: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  urgente: "border-destructive/30 bg-destructive/10 text-destructive",
}
const sourceTypes = new Set<TaskSourceType>(["hospitality_request", "housekeeping_task", "maintenance_task", "cattle_area", "issue"])
const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: { title: "Operational tasks", description: "Black Swan-native work is shown first. Imported Asana snapshots stay available in a reconciliation queue until their live Asana identity and status are verified.", newTask: "New task", loadError: "Tasks could not be loaded.", overdueOne: "overdue operational task", overdueMany: "overdue operational tasks", overdueDetail: "This alert measures Black Swan-native work only and excludes imported Asana snapshots and demo tasks.", pending: "BSFC current", today: "Due today", completedWeek: "Completed this week", assignees: "Assignees on current work", tabOperation: "BSFC current", tabAsanaLegacy: "Asana to reconcile", tabDemo: "Demo", tabCompleted: "Completed", tabCancelled: "Cancelled", tabAll: "All", workList: "Work list", workListDetail: "The default view contains Black Swan-native operational work. Imported Asana snapshots and demo tasks are separated explicitly.", loading: "Loading tasks…", empty: "No tasks in this view.", emptyHint: "Use a Black Swan template or create work from an operational module.", animal: "Animal handling", overdue: "Overdue", noAssignee: "No assignee", select: "Select a task to review its details, assignees, source and safety.", statusPending: "Pending", statusProgress: "In progress", statusCompleted: "Completed", statusCancelled: "Cancelled", low: "Low", medium: "Medium", high: "High", urgent: "Urgent", asanaLegacyBadge: "Asana imported", demoBadge: "Demo", asanaReconcileNote: "Imported Asana records are snapshots. Their live completion, assignee and date state must be reconciled against Asana before they are treated as current Black Swan truth." },
  es: { title: "Tareas operativas", description: "Primero se muestra el trabajo nativo de Black Swan. Los snapshots importados desde Asana quedan disponibles en una cola de conciliación hasta verificar su identidad y estado vivo en Asana.", newTask: "Nueva tarea", loadError: "No fue posible cargar las tareas.", overdueOne: "tarea operacional vencida", overdueMany: "tareas operacionales vencidas", overdueDetail: "Esta alerta mide sólo trabajo nativo de Black Swan y excluye snapshots importados desde Asana y tareas demo.", pending: "Operación BSFC", today: "Con fecha para hoy", completedWeek: "Completadas esta semana", assignees: "Responsables en trabajo vigente", tabOperation: "Operación BSFC", tabAsanaLegacy: "Asana por conciliar", tabDemo: "Demo", tabCompleted: "Completadas", tabCancelled: "Canceladas", tabAll: "Todas", workList: "Lista de trabajo", workListDetail: "La vista inicial contiene trabajo operacional nativo de Black Swan. Los snapshots importados desde Asana y las tareas demo quedan separados explícitamente.", loading: "Cargando tareas…", empty: "No hay tareas en esta vista.", emptyHint: "Usa una plantilla de Black Swan o crea un trabajo desde un módulo operativo.", animal: "Manejo animal", overdue: "Vencida", noAssignee: "Sin responsable", select: "Selecciona una tarea para revisar su detalle, responsables, origen y seguridad.", statusPending: "Pendiente", statusProgress: "En curso", statusCompleted: "Completada", statusCancelled: "Cancelada", low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente", asanaLegacyBadge: "Asana importada", demoBadge: "Demo", asanaReconcileNote: "Los registros importados desde Asana son snapshots. Su estado vivo de cierre, responsable y fecha debe conciliarse contra Asana antes de tratarlos como verdad operacional vigente de Black Swan." },
  de: { title: "Operative Aufgaben", description: "Zuerst wird native Black-Swan-Arbeit gezeigt. Importierte Asana-Snapshots bleiben in einer Abstimmungswarteschlange, bis Identität und Live-Status in Asana verifiziert sind.", newTask: "Neue Aufgabe", loadError: "Aufgaben konnten nicht geladen werden.", overdueOne: "überfällige operative Aufgabe", overdueMany: "überfällige operative Aufgaben", overdueDetail: "Diese Warnung misst nur native Black-Swan-Arbeit und schließt importierte Asana-Snapshots sowie Demo-Aufgaben aus.", pending: "BSFC aktuell", today: "Heute fällig", completedWeek: "Diese Woche abgeschlossen", assignees: "Verantwortliche für aktuelle Arbeit", tabOperation: "BSFC aktuell", tabAsanaLegacy: "Asana abstimmen", tabDemo: "Demo", tabCompleted: "Abgeschlossen", tabCancelled: "Storniert", tabAll: "Alle", workList: "Arbeitsliste", workListDetail: "Die Standardansicht enthält native operative Black-Swan-Arbeit. Importierte Asana-Snapshots und Demo-Aufgaben sind getrennt ausgewiesen.", loading: "Aufgaben werden geladen…", empty: "Keine Aufgaben in dieser Ansicht.", emptyHint: "Verwende eine Black-Swan-Vorlage oder erstelle Arbeit aus einem operativen Modul.", animal: "Tierhandling", overdue: "Überfällig", noAssignee: "Keine verantwortliche Person", select: "Wähle eine Aufgabe, um Details, Verantwortliche, Quelle und Sicherheit zu prüfen.", statusPending: "Ausstehend", statusProgress: "In Bearbeitung", statusCompleted: "Abgeschlossen", statusCancelled: "Storniert", low: "Niedrig", medium: "Mittel", high: "Hoch", urgent: "Dringend", asanaLegacyBadge: "Asana importiert", demoBadge: "Demo", asanaReconcileNote: "Importierte Asana-Datensätze sind Snapshots. Live-Abschluss, Verantwortliche und Termine müssen vor Nutzung als aktuelle Black-Swan-Wahrheit mit Asana abgestimmt werden." },
} as const

function readTaskPrefill(priorityLabels: Record<TaskPriority,string>): OperationalTaskPrefill | null {
  const params = new URLSearchParams(window.location.search)
  const sourceType = params.get("sourceType") as TaskSourceType | null
  const sourceId = params.get("sourceId"); const sourceLabel = params.get("sourceLabel"); const sourcePath = params.get("sourcePath")
  if (params.get("new") !== "1" || !sourceType || !sourceTypes.has(sourceType) || !sourceId || !sourceLabel || !sourcePath) return null
  const priority = params.get("priority") as TaskPriority | null; const area = params.get("area") as OperationalArea | null
  return { sourceType, sourceId, sourceLabel, sourcePath, template: params.get("template") || undefined, area: area && area in operationalAreaLabels ? area : undefined, title: params.get("title") || undefined, description: params.get("description") || undefined, category: params.get("category") || undefined, priority: priority && priority in priorityLabels ? priority : undefined, dueDate: params.get("dueDate") || undefined, locationId: params.get("locationId") || undefined }
}

function isAsanaLegacyTask(task: OperationalTask) {
  return task.task_category?.startsWith("asana_import") === true || task.source_label?.startsWith("Asana ·") === true
}

function isDemoTask(task: OperationalTask) {
  return task.title.trim().startsWith("[DEMO]") || task.source_label?.startsWith("DEMO") === true
}

function isOpenTask(task: OperationalTask) {
  return task.status === "nueva" || task.status === "en_progreso"
}

export default function TasksPage() {
  const { language } = useLanguage(); const lang = (language in COPY ? language : "en") as keyof typeof COPY; const copy = COPY[lang]; const locale = LOCALES[lang]
  const priorityLabels: Record<TaskPriority,string> = { baja: copy.low, media: copy.medium, alta: copy.high, urgente: copy.urgent }
  const statusLabels: Record<TaskStatus,string> = { nueva: copy.statusPending, en_progreso: copy.statusProgress, completada: copy.statusCompleted, cancelada: copy.statusCancelled }
  const supabase = useMemo(() => createBrowserClient(), [])
  const [tasks, setTasks] = useState<OperationalTask[]>([]); const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(null); const [taskToEdit, setTaskToEdit] = useState<OperationalTask | null>(null); const [taskPrefill, setTaskPrefill] = useState<OperationalTaskPrefill | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); const [activeTab, setActiveTab] = useState<TaskView>("operacion"); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]); const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "America/Santiago" }), [locale])
  const taskPath = `/${lang}/tasks`

  async function fetchTasks() {
    setIsLoading(true); setError(null)
    const { data, error: fetchError } = await supabase.from("tasks").select("*, task_assignments(employee_id, volunteer_id, employees(id, name, email, phone), volunteers(id, name, email, phone, volunteer_role))").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    if (fetchError) { console.error("tasks load failed", fetchError); setError(copy.loadError) } else {
      const nextTasks = (data ?? []) as OperationalTask[]; const selectedId = new URLSearchParams(window.location.search).get("selected"); setTasks(nextTasks)
      setSelectedTask((current) => selectedId ? nextTasks.find((task) => task.id === selectedId) ?? null : current ? nextTasks.find((task) => task.id === current.id) ?? null : null)
      if (selectedId) {
        const selected = nextTasks.find((task) => task.id === selectedId)
        if (selected?.status === "completada") setActiveTab("completadas")
        else if (selected?.status === "cancelada") setActiveTab("canceladas")
        else if (selected && isDemoTask(selected)) setActiveTab("demo")
        else if (selected && isAsanaLegacyTask(selected)) setActiveTab("asana")
        else setActiveTab("operacion")
      }
    }
    setIsLoading(false)
  }
  useEffect(() => { void fetchTasks() }, [copy.loadError])
  useEffect(() => { const prefill = readTaskPrefill(priorityLabels); if (!prefill) return; setTaskPrefill(prefill); setIsAddDialogOpen(true) }, [])

  const openTasks = tasks.filter(isOpenTask)
  const operationalOpenTasks = openTasks.filter((task) => !isAsanaLegacyTask(task) && !isDemoTask(task))
  const asanaLegacyOpenTasks = openTasks.filter(isAsanaLegacyTask)
  const demoOpenTasks = openTasks.filter(isDemoTask)
  const overdue = operationalOpenTasks.filter((task) => task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date))).length
  const stats = { pendientes: operationalOpenTasks.length, hoy: operationalOpenTasks.filter((task) => task.due_date && isToday(parseISO(task.due_date))).length, completadasSemana: tasks.filter((task) => task.status === "completada" && !isAsanaLegacyTask(task) && !isDemoTask(task) && task.completed_at && isThisWeek(parseISO(task.completed_at), { weekStartsOn: 1 })).length, responsables: new Set(operationalOpenTasks.flatMap((task) => task.task_assignments.map((assignment) => assignment.employee_id ?? assignment.volunteer_id).filter(Boolean))).size }
  const filteredTasks = tasks.filter((task) => activeTab === "operacion" ? isOpenTask(task) && !isAsanaLegacyTask(task) && !isDemoTask(task) : activeTab === "asana" ? isOpenTask(task) && isAsanaLegacyTask(task) : activeTab === "demo" ? isOpenTask(task) && isDemoTask(task) : activeTab === "completadas" ? task.status === "completada" : activeTab === "canceladas" ? task.status === "cancelada" : true)
  function openBlankTask() { setTaskPrefill(null); setIsAddDialogOpen(true) }
  function handleTaskCreated() { window.history.replaceState({}, "", taskPath); setTaskPrefill(null); void fetchTasks() }

  return <AppLayout><div className="space-y-6 p-4 sm:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-medium text-accent sm:text-3xl">{copy.title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.description}</p></div><Button onClick={openBlankTask}><Plus className="mr-2 h-4 w-4" />{copy.newTask}</Button></div>
    {error && <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
    {overdue > 0 && !error && <div className="flex gap-3 border-l-2 border-amber-400/60 bg-amber-500/5 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><p className="font-medium">{number.format(overdue)} {overdue === 1 ? copy.overdueOne : copy.overdueMany}</p><p className="mt-1 text-sm text-muted-foreground">{copy.overdueDetail}</p></div></div>}
    {!isLoading && !error && <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4"><Metric icon={Clock} label={copy.pending} value={stats.pendientes} locale={locale} /><Metric icon={Calendar} label={copy.today} value={stats.hoy} locale={locale} /><Metric icon={CheckCircle2} label={copy.completedWeek} value={stats.completadasSemana} locale={locale} /><Metric icon={Users} label={copy.assignees} value={stats.responsables} locale={locale} /></div>}
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TaskView)}><TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-fit"><TabsTrigger value="operacion">{copy.tabOperation} · {number.format(operationalOpenTasks.length)}</TabsTrigger><TabsTrigger value="asana">{copy.tabAsanaLegacy} · {number.format(asanaLegacyOpenTasks.length)}</TabsTrigger><TabsTrigger value="demo">{copy.tabDemo} · {number.format(demoOpenTasks.length)}</TabsTrigger><TabsTrigger value="completadas">{copy.tabCompleted}</TabsTrigger><TabsTrigger value="canceladas">{copy.tabCancelled}</TabsTrigger><TabsTrigger value="todas">{copy.tabAll}</TabsTrigger></TabsList></Tabs>
    {activeTab === "asana" && <div className="border-l-2 border-amber-400/60 bg-amber-500/5 p-4 text-sm text-muted-foreground">{copy.asanaReconcileNote}</div>}
    <div className="grid gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <section className="min-w-0"><div className="mb-4"><h2 className="text-base font-medium">{copy.workList}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.workListDetail}</p></div>{isLoading ? <p className="border-y py-10 text-center text-sm text-muted-foreground">{copy.loading}</p> : filteredTasks.length === 0 ? <div className="border-y py-10 text-center"><p className="font-medium">{copy.empty}</p><p className="mt-1 text-sm text-muted-foreground">{copy.emptyHint}</p></div> : <div className="border-t">{filteredTasks.map((task) => { const due = task.due_date ? parseISO(task.due_date) : null; const isOverdue = due && isPast(due) && !isToday(due) && task.status !== "completada" && task.status !== "cancelada"; const names = task.task_assignments.map((assignment) => assignment.employees?.name ?? assignment.volunteers?.name).filter(Boolean) as string[]; const asanaLegacy = isAsanaLegacyTask(task); const demo = isDemoTask(task); return <button key={task.id} type="button" onClick={() => { setSelectedTask(task); window.history.replaceState({}, "", `${taskPath}?selected=${task.id}`) }} className={`w-full border-b px-1 py-4 text-left transition-colors hover:bg-muted/30 ${selectedTask?.id === task.id ? "bg-primary/5" : ""}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-medium">{task.title}</h3><p className="mt-1 text-xs text-muted-foreground">{statusLabels[task.status]}</p></div><Badge variant="outline" className={priorityClasses[task.priority]}>{priorityLabels[task.priority]}</Badge></div><div className="mt-2 flex flex-wrap gap-2">{task.operational_area && <Badge variant="secondary">{operationalAreaLabels[task.operational_area]}</Badge>}{asanaLegacy ? <Badge variant="outline">{copy.asanaLegacyBadge}</Badge> : demo ? <Badge variant="outline">{copy.demoBadge}</Badge> : task.task_category ? <Badge variant="outline">{task.task_category}</Badge> : null}{task.animal_handling && <Badge variant="outline" className="border-amber-400/40 text-amber-200">{copy.animal}</Badge>}{task.source_label && <Badge variant="outline"><Link2 className="mr-1 h-3 w-3" />{task.source_label}</Badge>}</div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground">{task.location_name && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{task.location_name}</p>}{due && <p className={`flex items-center gap-1.5 ${isOverdue ? "font-medium text-destructive" : ""}`}><Calendar className="h-3.5 w-3.5" />{isOverdue ? `${copy.overdue} · ` : ""}{date.format(due)}</p>}<p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{names.length ? names.join(", ") : copy.noAssignee}</p></div></button>})}</div>}</section>
      <section className="min-h-[280px] border-t pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">{selectedTask ? <TaskDetailPanel task={selectedTask} onUpdate={() => void fetchTasks()} onClose={() => { setSelectedTask(null); window.history.replaceState({}, "", taskPath) }} onEdit={(task) => { setTaskToEdit(task); setIsEditDialogOpen(true) }} /> : <div className="flex min-h-[280px] items-center justify-center text-center text-sm text-muted-foreground">{copy.select}</div>}</section>
    </div>
    <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onTaskCreated={handleTaskCreated} prefill={taskPrefill} />
    {taskToEdit && <EditTaskDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onTaskUpdated={() => { void fetchTasks(); setTaskToEdit(null) }} task={taskToEdit} />}
  </div></AppLayout>
}

function Metric({ icon: Icon, label, value, locale }: { icon: typeof Clock; label:string; value:number; locale:string }) {
  return <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{new Intl.NumberFormat(locale).format(value)}</p></div><Icon className="mt-1 h-4 w-4 text-muted-foreground" /></div>
}

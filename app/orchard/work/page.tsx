"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Plus, RefreshCw, Sparkles, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Status = "nueva" | "en_progreso" | "completada" | "cancelada"
type Priority = "baja" | "media" | "alta" | "urgente"
type Task = { id: string; title: string; priority: Priority; status: Status; due_date: string | null; location_name: string | null; task_category: string | null; estimated_minutes: number | null; source_type: string | null; source_id: string | null; source_label: string | null }
type Assignment = { task_id: string; employee_id: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null }
type Cycle = { id: string; crop_name: string; variety: string | null }
type Employee = { id: string; name: string; role: string | null }
type Allocation = { crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string }
type Event = { date: string; kind: "plan" | "task"; title: string; detail: string; minutes: number }
type Milestone = { successionId: string; sourceType: string; date: string; title: string; detail: string; category: string; minutes: number }

const statuses: Status[] = ["nueva", "en_progreso", "completada", "cancelada"]
const priorities: Priority[] = ["baja", "media", "alta", "urgente"]
const copy = {
  en: {
    title: "Tasks & Calendar", description: "Run Orchard work from one cockpit: planning milestones, real tasks, workload and field accountability.", refresh: "Refresh", newTask: "Create Orchard task", succession: "Crop succession", titleLabel: "Task title", instructions: "Instructions", category: "Work type", due: "Due date", priority: "Priority", duration: "Minutes", owner: "Owner", unassigned: "Unassigned", create: "Create task", calendar: "Weekly calendar", calendarHelp: "Planning milestones and real operational tasks in one weekly view.", tasks: "Operational tasks", open: "Open", completed: "Completed", overdue: "Overdue", today: "Due today", upcoming: "Next 7 days", minutes: "Open minutes", people: "Assigned people", empty: "No Orchard tasks yet.", emptyCalendar: "No dated work yet.", week: "Week of", plan: "Plan", task: "Task", sow: "Sow", transplant: "Transplant", harvest: "Harvest", general: "General field work", saveError: "Could not save task", loadError: "Could not load Orchard work", milestones: "Planning milestones", milestonesHelp: "Convert the Game Plan into canonical tasks only when work should become accountable.", generateMissing: "Create missing milestone tasks", generated: "Task created", createFromPlan: "Create task", allCovered: "All current planning milestones already have matching tasks.", workloadPeople: "Workload by person", workloadCrop: "Workload by crop", noWorkload: "No open assigned workload.", taskCount: "tasks", plannedOnly: "Planning milestone", operational: "Operational task"
  },
  es: {
    title: "Tareas y Calendario", description: "Opera Orchard desde un solo cockpit: hitos planificados, tareas reales, carga y responsabilidad en terreno.", refresh: "Actualizar", newTask: "Crear tarea de Orchard", succession: "Sucesión", titleLabel: "Título", instructions: "Instrucciones", category: "Tipo de trabajo", due: "Fecha objetivo", priority: "Prioridad", duration: "Minutos", owner: "Responsable", unassigned: "Sin asignar", create: "Crear tarea", calendar: "Calendario semanal", calendarHelp: "Hitos planificados y tareas operativas reales en una sola vista semanal.", tasks: "Tareas operativas", open: "Abiertas", completed: "Completadas", overdue: "Atrasadas", today: "Vencen hoy", upcoming: "Próximos 7 días", minutes: "Minutos abiertos", people: "Responsables", empty: "Aún no hay tareas de Orchard.", emptyCalendar: "Aún no hay trabajo con fecha.", week: "Semana del", plan: "Plan", task: "Tarea", sow: "Siembra", transplant: "Trasplante", harvest: "Cosecha", general: "Trabajo general de terreno", saveError: "No fue posible guardar la tarea", loadError: "No fue posible cargar el trabajo de Orchard", milestones: "Hitos de planificación", milestonesHelp: "Convierte el Plan de Cultivo en tareas canónicas solo cuando el trabajo deba tener responsable.", generateMissing: "Crear tareas faltantes de hitos", generated: "Tarea creada", createFromPlan: "Crear tarea", allCovered: "Todos los hitos actuales ya tienen una tarea equivalente.", workloadPeople: "Carga por persona", workloadCrop: "Carga por cultivo", noWorkload: "No hay carga abierta asignada.", taskCount: "tareas", plannedOnly: "Hito planificado", operational: "Tarea operativa"
  },
} as const

const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateLabel = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale)
function weekKey(date: string) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
function localDateKey(offsetDays = 0) { const d = new Date(); d.setDate(d.getDate() + offsetDays); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }

export default function OrchardWorkPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [tasks, setTasks] = useState<Task[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ succession_id: "none", source_type: "orchard_general", title: "", description: "", category: "General field work", due_date: "", priority: "media" as Priority, estimated_minutes: "60", employee_id: "none" })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [t, s, c, e, a, b, p] = await Promise.all([
      supabase.from("tasks").select("id, title, priority, status, due_date, location_name, task_category, estimated_minutes, source_type, source_id, source_label").eq("operational_area", "huerto_vinedo").like("source_type", "orchard_%").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_sow_date, planned_transplant_date, planned_first_harvest_date").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id, crop_name, variety"),
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id, bed_id"),
      supabase.from("orchard_beds").select("id, plot_id, name"),
      supabase.from("orchard_plots").select("id, name"),
    ])
    const firstError = t.error ?? s.error ?? c.error ?? e.error ?? a.error ?? b.error ?? p.error
    if (firstError) { setError(`${text.loadError}: ${firstError.message}`); setLoading(false); return }
    const nextTasks = (t.data ?? []) as Task[]
    const ids = nextTasks.map((task) => task.id)
    let nextAssignments: Assignment[] = []
    if (ids.length) {
      const result = await supabase.from("task_assignments").select("task_id, employee_id").in("task_id", ids)
      if (result.error) setError(`${text.loadError}: ${result.error.message}`)
      else nextAssignments = (result.data ?? []) as Assignment[]
    }
    setTasks(nextTasks); setAssignments(nextAssignments); setSuccessions((s.data ?? []) as Succession[]); setCycles((c.data ?? []) as Cycle[]); setEmployees((e.data ?? []) as Employee[]); setAllocations((a.data ?? []) as Allocation[]); setBeds((b.data ?? []) as Bed[]); setPlots((p.data ?? []) as Plot[]); setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions])
  const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds])
  const plotById = useMemo(() => new Map(plots.map((item) => [item.id, item])), [plots])
  const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees])
  const successionLabel = useCallback((item: Succession) => { const cycle = cycleById.get(item.crop_cycle_id); return `${cycle?.crop_name ?? "Crop"}${cycle?.variety ? ` · ${cycle.variety}` : ""} #${item.sequence_no}` }, [cycleById])
  const locationFor = useCallback((id: string) => { const allocation = allocations.find((item) => item.crop_succession_id === id); const bed = allocation ? bedById.get(allocation.bed_id) : null; const plot = bed ? plotById.get(bed.plot_id) : null; return bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : null }, [allocations, bedById, plotById])
  const assignedNames = (taskId: string) => assignments.filter((item) => item.task_id === taskId && item.employee_id).map((item) => employeeById.get(item.employee_id as string)?.name).filter(Boolean).join(", ")

  const milestones = useMemo<Milestone[]>(() => successions.flatMap((item) => {
    const detail = successionLabel(item)
    const result: Milestone[] = [{ successionId: item.id, sourceType: "orchard_succession_sow", date: item.planned_sow_date, title: text.sow, detail, category: text.sow, minutes: 60 }]
    if (item.planned_transplant_date) result.push({ successionId: item.id, sourceType: "orchard_succession_transplant", date: item.planned_transplant_date, title: text.transplant, detail, category: text.transplant, minutes: 90 })
    if (item.planned_first_harvest_date) result.push({ successionId: item.id, sourceType: "orchard_succession_harvest", date: item.planned_first_harvest_date, title: text.harvest, detail, category: text.harvest, minutes: 120 })
    return result
  }).sort((a, b) => a.date.localeCompare(b.date)), [successions, successionLabel, text.sow, text.transplant, text.harvest])

  const taskMatchesMilestone = useCallback((milestone: Milestone) => tasks.some((task) => task.source_id === milestone.successionId && task.source_type === milestone.sourceType && task.due_date === milestone.date), [tasks])
  const missingMilestones = milestones.filter((milestone) => !taskMatchesMilestone(milestone))
  const events = useMemo<Event[]>(() => {
    const planned = milestones.map((item) => ({ date: item.date, kind: "plan" as const, title: item.title, detail: item.detail, minutes: 0 }))
    const real = tasks.filter((task) => task.due_date).map((task) => ({ date: task.due_date as string, kind: "task" as const, title: task.title, detail: task.location_name || task.source_label || text.general, minutes: task.estimated_minutes ?? 0 }))
    return [...planned, ...real].sort((a, b) => a.date.localeCompare(b.date))
  }, [milestones, tasks, text.general])
  const weeks = useMemo(() => { const groups = new Map<string, Event[]>(); events.forEach((event) => { const key = weekKey(event.date); groups.set(key, [...(groups.get(key) ?? []), event]) }); return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)) }, [events])

  const today = localDateKey()
  const nextWeek = localDateKey(7)
  const open = tasks.filter((task) => task.status === "nueva" || task.status === "en_progreso")
  const completed = tasks.filter((task) => task.status === "completada")
  const overdue = open.filter((task) => task.due_date && task.due_date < today)
  const dueToday = open.filter((task) => task.due_date === today)
  const upcoming = open.filter((task) => task.due_date && task.due_date > today && task.due_date <= nextWeek)
  const minutes = open.reduce((sum, item) => sum + (item.estimated_minutes ?? 0), 0)
  const people = new Set(assignments.filter((item) => open.some((task) => task.id === item.task_id)).map((item) => item.employee_id).filter(Boolean)).size

  const workloadByPerson = useMemo(() => employees.map((employee) => {
    const taskIds = new Set(assignments.filter((item) => item.employee_id === employee.id).map((item) => item.task_id))
    const assigned = open.filter((task) => taskIds.has(task.id))
    return { id: employee.id, name: employee.name, role: employee.role, tasks: assigned.length, minutes: assigned.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0) }
  }).filter((item) => item.tasks > 0).sort((a, b) => b.minutes - a.minutes), [employees, assignments, open])

  const workloadByCrop = useMemo(() => {
    const groups = new Map<string, { label: string; tasks: number; minutes: number }>()
    open.forEach((task) => {
      const succession = task.source_id ? successionById.get(task.source_id) : null
      const label = succession ? successionLabel(succession) : text.general
      const current = groups.get(label) ?? { label, tasks: 0, minutes: 0 }
      current.tasks += 1; current.minutes += task.estimated_minutes ?? 0; groups.set(label, current)
    })
    return [...groups.values()].sort((a, b) => b.minutes - a.minutes)
  }, [open, successionById, successionLabel, text.general])

  function prefillMilestone(item: Milestone) {
    setForm({ succession_id: item.successionId, source_type: item.sourceType, title: `${item.title}: ${item.detail}`, description: "", category: item.category, due_date: item.date, priority: "media", estimated_minutes: String(item.minutes), employee_id: "none" })
    document.getElementById("orchard-task-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function createTask(event: FormEvent) {
    event.preventDefault(); if (!form.title || !form.due_date) return
    const succession = form.succession_id === "none" ? null : successions.find((item) => item.id === form.succession_id) ?? null
    setSaving(true); setError(null)
    const result = await supabase.from("tasks").insert({ title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, due_date: form.due_date, operational_area: "huerto_vinedo", task_category: form.category.trim() || text.general, estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null, location_name: succession ? locationFor(succession.id) : null, source_type: succession ? form.source_type : "orchard_general", source_id: succession?.id ?? null, source_label: succession ? successionLabel(succession) : "Orchard", source_path: succession ? `/${language}/orchard/game-plan` : `/${language}/orchard/work` }).select("id").single()
    if (result.error || !result.data?.id) { setError(`${text.saveError}: ${result.error?.message ?? "Unknown error"}`); setSaving(false); return }
    if (form.employee_id !== "none") {
      const assignment = await supabase.from("task_assignments").insert({ task_id: result.data.id, employee_id: form.employee_id })
      if (assignment.error) { await supabase.from("tasks").delete().eq("id", result.data.id); setError(`${text.saveError}: ${assignment.error.message}`); setSaving(false); return }
    }
    setForm({ succession_id: "none", source_type: "orchard_general", title: "", description: "", category: text.general, due_date: "", priority: "media", estimated_minutes: "60", employee_id: "none" }); await load(); setSaving(false)
  }

  async function generateMissingTasks() {
    if (!missingMilestones.length) return
    setSaving(true); setError(null)
    const rows = missingMilestones.map((item) => ({ title: `${item.title}: ${item.detail}`, priority: "media" as Priority, due_date: item.date, operational_area: "huerto_vinedo", task_category: item.category, estimated_minutes: item.minutes, location_name: locationFor(item.successionId), source_type: item.sourceType, source_id: item.successionId, source_label: item.detail, source_path: `/${language}/orchard/game-plan` }))
    const result = await supabase.from("tasks").insert(rows)
    if (result.error) setError(`${text.saveError}: ${result.error.message}`)
    else await load()
    setSaving(false)
  }

  async function updateStatus(id: string, status: Status) {
    setSaving(true)
    const result = await supabase.from("tasks").update({ status, completed_at: status === "completada" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id)
    if (result.error) setError(`${text.saveError}: ${result.error.message}`)
    else await load()
    setSaving(false)
  }

  return <AppLayout>
    <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>} />
    <OrchardNavigation />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Clock3} label={text.open} value={open.length} />
        <Metric icon={AlertTriangle} label={text.overdue} value={overdue.length} />
        <Metric icon={CalendarDays} label={text.today} value={dueToday.length} />
        <Metric icon={CalendarDays} label={text.upcoming} value={upcoming.length} />
        <Metric icon={Clock3} label={text.minutes} value={minutes} />
        <Metric icon={Users} label={text.people} value={people} />
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>{text.milestones}</CardTitle><CardDescription>{text.milestonesHelp}</CardDescription></div>
          <Button onClick={() => void generateMissingTasks()} disabled={saving || missingMilestones.length === 0}><Sparkles className="mr-2 h-4 w-4" />{text.generateMissing}</Button>
        </CardHeader>
        <CardContent>{missingMilestones.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{text.allCovered}</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{missingMilestones.slice(0, 18).map((item) => <div key={`${item.sourceType}-${item.successionId}-${item.date}`} className="rounded-xl border bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{item.title} · {item.detail}</div><div className="mt-1 text-xs text-muted-foreground">{dateLabel(item.date, locale)} · {locationFor(item.successionId) ?? text.unassigned}</div></div><Badge variant="outline">{text.plannedOnly}</Badge></div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{item.minutes} min</span><Button size="sm" variant="secondary" onClick={() => prefillMilestone(item)}>{text.createFromPlan}</Button></div></div>)}</div>}</CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card id="orchard-task-form"><CardHeader><CardTitle>{text.newTask}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={createTask}><Field label={text.succession}><Select value={form.succession_id} onValueChange={(value) => { const item = successions.find((entry) => entry.id === value); setForm((f) => ({ ...f, succession_id: value, source_type: item ? "orchard_succession" : "orchard_general", due_date: item?.planned_sow_date ?? f.due_date, title: item ? `${text.sow}: ${successionLabel(item)}` : f.title })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{successions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.titleLabel}><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></Field><Field label={text.instructions}><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field><Field label={text.category}><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-3"><Field label={text.due}><Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} required /></Field><Field label={text.duration}><Input type="number" min="0" value={form.estimated_minutes} onChange={(e) => setForm((f) => ({ ...f, estimated_minutes: e.target.value }))} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label={text.priority}><Select value={form.priority} onValueChange={(value) => setForm((f) => ({ ...f, priority: value as Priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((item) => <SelectItem key={item} value={item}>{titleize(item)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.owner}><Select value={form.employee_id} onValueChange={(value) => setForm((f) => ({ ...f, employee_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.unassigned}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>)}</SelectContent></Select></Field></div><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></form></CardContent></Card>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle>{text.calendar}</CardTitle><CardDescription>{text.calendarHelp}</CardDescription></CardHeader><CardContent>{weeks.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{text.emptyCalendar}</div> : <div className="space-y-4">{weeks.map(([week, weekEvents]) => <div key={week} className="grid gap-3 border-b pb-4 last:border-0 lg:grid-cols-[150px_1fr]"><div><p className="font-medium">{text.week} {dateLabel(week, locale)}</p><p className="text-xs text-muted-foreground">{weekEvents.length} events</p></div><div className="space-y-2">{weekEvents.map((event, index) => <div key={`${event.kind}-${event.date}-${event.title}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"><div><div className="flex items-center gap-2"><Badge variant={event.kind === "task" ? "default" : "outline"}>{event.kind === "task" ? text.operational : text.plannedOnly}</Badge><span className="text-sm font-medium">{event.title}</span></div><div className="mt-1 text-xs text-muted-foreground">{event.detail}</div></div><div className="text-xs text-muted-foreground">{dateLabel(event.date, locale)}{event.minutes ? ` · ${event.minutes} min` : ""}</div></div>)}</div></div>)}</div>}</CardContent></Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>{text.workloadPeople}</CardTitle></CardHeader><CardContent>{workloadByPerson.length === 0 ? <p className="text-sm text-muted-foreground">{text.noWorkload}</p> : <div className="space-y-3">{workloadByPerson.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3"><div><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.role ?? "—"}</div></div><div className="text-right"><div className="font-semibold">{item.minutes} min</div><div className="text-xs text-muted-foreground">{item.tasks} {text.taskCount}</div></div></div>)}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle>{text.workloadCrop}</CardTitle></CardHeader><CardContent>{workloadByCrop.length === 0 ? <p className="text-sm text-muted-foreground">{text.noWorkload}</p> : <div className="space-y-3">{workloadByCrop.slice(0, 10).map((item) => <div key={item.label} className="flex items-center justify-between rounded-lg border p-3"><div className="font-medium">{item.label}</div><div className="text-right"><div className="font-semibold">{item.minutes} min</div><div className="text-xs text-muted-foreground">{item.tasks} {text.taskCount}</div></div></div>)}</div>}</CardContent></Card>
          </div>
        </div>
      </div>

      <Card><CardHeader><CardTitle>{text.tasks}</CardTitle><CardDescription>{completed.length} {text.completed}</CardDescription></CardHeader><CardContent>{tasks.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{text.empty}</div> : <div className="space-y-3">{tasks.map((task) => <div key={task.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{task.title}</span><Badge variant="outline">{titleize(task.priority)}</Badge>{task.due_date && task.status !== "completada" && task.status !== "cancelada" && task.due_date < today && <Badge variant="destructive">{text.overdue}</Badge>}</div><div className="mt-1 text-xs text-muted-foreground">{task.due_date ? dateLabel(task.due_date, locale) : "—"}{task.location_name ? ` · ${task.location_name}` : ""}{task.task_category ? ` · ${task.task_category}` : ""}{task.estimated_minutes ? ` · ${task.estimated_minutes} min` : ""}{assignedNames(task.id) ? ` · ${assignedNames(task.id)}` : ""}</div></div><Select value={task.status} onValueChange={(value) => void updateStatus(task.id, value as Status)} disabled={saving}><SelectTrigger className="w-[165px]"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{titleize(item)}</SelectItem>)}</SelectContent></Select></div>)}</div>}</CardContent></Card>
    </div>
  </AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: number }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card> }

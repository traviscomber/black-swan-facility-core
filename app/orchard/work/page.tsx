"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Clock3, Plus, RefreshCw, Users } from "lucide-react"
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

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type Priority = "baja" | "media" | "alta" | "urgente"
type Task = { id: string; title: string; description: string | null; priority: Priority; status: TaskStatus; due_date: string | null; location_name: string | null; task_category: string | null; estimated_minutes: number | null; source_type: string | null; source_id: string | null; source_label: string | null; source_path: string | null; task_assignments: Array<{ employee_id: string | null; employees: { id: string; name: string } | null }> }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null; planned_last_harvest_date: string | null }
type Cycle = { id: string; crop_name: string; variety: string | null }
type Employee = { id: string; name: string; role: string | null }
type Allocation = { crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string }
type CalendarEvent = { date: string; kind: "planned" | "task"; label: string; detail: string; minutes: number; task?: Task }

const statuses: TaskStatus[] = ["nueva", "en_progreso", "completada", "cancelada"]
const priorities: Priority[] = ["baja", "media", "alta", "urgente"]
const copy = {
  en: { title: "Tasks & Calendar", description: "Turn crop planning into assigned operational work. Planned agronomic events and canonical Blackswan tasks share one workload calendar.", refresh: "Refresh", newTask: "Create Orchard task", succession: "Crop succession", category: "Work type", titleLabel: "Task title", descriptionLabel: "Instructions", due: "Due date", priority: "Priority", duration: "Estimated minutes", owner: "Owner", noOwner: "Unassigned", create: "Create task", calendar: "Calendar & workload", calendarDescription: "Planned sow/transplant/harvest milestones plus real assigned tasks. Planned events remain forecasts until converted into tasks.", tasks: "Operational tasks", open: "Open", completed: "Completed", minutes: "Planned minutes", people: "Assigned people", loading: "Loading…", loadError: "Could not load Orchard work", saveError: "Could not save task", emptyTasks: "No Orchard operational tasks yet.", emptyCalendar: "No dated crop events or tasks yet.", weekOf: "Week of", planned: "Plan", task: "Task", location: "Location", status: "Status", sow: "Sow", transplant: "Transplant", harvest: "Harvest", general: "General field work" },
  es: { title: "Tareas y Calendario", description: "Convierte la planificación de cultivos en trabajo operativo asignado. Los hitos agronómicos y las tareas canónicas de Blackswan comparten una sola vista de carga.", refresh: "Actualizar", newTask: "Crear tarea de Orchard", succession: "Sucesión de cultivo", category: "Tipo de trabajo", titleLabel: "Título de tarea", descriptionLabel: "Instrucciones", due: "Fecha objetivo", priority: "Prioridad", duration: "Minutos estimados", owner: "Responsable", noOwner: "Sin asignar", create: "Crear tarea", calendar: "Calendario y carga", calendarDescription: "Hitos planificados de siembra/trasplante/cosecha más tareas reales. Los hitos siguen siendo previsiones hasta convertirse en tareas.", tasks: "Tareas operativas", open: "Abiertas", completed: "Completadas", minutes: "Minutos planificados", people: "Responsables", loading: "Cargando…", loadError: "No fue posible cargar el trabajo de Orchard", saveError: "No fue posible guardar la tarea", emptyTasks: "Aún no hay tareas operativas de Orchard.", emptyCalendar: "Aún no hay eventos o tareas con fecha.", weekOf: "Semana del", planned: "Plan", task: "Tarea", location: "Ubicación", status: "Estado", sow: "Siembra", transplant: "Trasplante", harvest: "Cosecha", general: "Trabajo general de terreno" },
} as const

const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateLabel = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale)
function weekKey(date: string) { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value.toISOString().slice(0, 10) }

export default function OrchardWorkPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [tasks, setTasks] = useState<Task[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ succession_id: "none", category: "General field work", title: "", description: "", due_date: "", priority: "media" as Priority, estimated_minutes: "60", employee_id: "none" })

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    const [t, s, c, e, a, b, p] = await Promise.all([
      supabase.from("tasks").select("id, title, description, priority, status, due_date, location_name, task_category, estimated_minutes, source_type, source_id, source_label, source_path, task_assignments(employee_id, employees(id, name))").eq("operational_area", "huerto_vinedo").like("source_type", "orchard_%").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_sow_date, planned_transplant_date, planned_first_harvest_date, planned_last_harvest_date").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id, crop_name, variety").order("crop_name"),
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id, bed_id"),
      supabase.from("orchard_beds").select("id, plot_id, name"),
      supabase.from("orchard_plots").select("id, name"),
    ])
    const fetchError = t.error ?? s.error ?? c.error ?? e.error ?? a.error ?? b.error ?? p.error
    if (fetchError) setError(`${text.loadError}: ${fetchError.message}`)
    else { setTasks((t.data ?? []) as Task[]); setSuccessions((s.data ?? []) as Succession[]); setCycles((c.data ?? []) as Cycle[]); setEmployees((e.data ?? []) as Employee[]); setAllocations((a.data ?? []) as Allocation[]); setBeds((b.data ?? []) as Bed[]); setPlots((p.data ?? []) as Plot[]) }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void loadData() }, [loadData])
  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds])
  const plotById = useMemo(() => new Map(plots.map((item) => [item.id, item])), [plots])
  const successionLabel = (item: Succession) => { const cycle = cycleById.get(item.crop_cycle_id); return `${cycle?.crop_name ?? "Crop"}${cycle?.variety ? ` · ${cycle.variety}` : ""} #${item.sequence_no}` }
  const successionLocation = (id: string) => { const allocation = allocations.find((item) => item.crop_succession_id === id); const bed = allocation ? bedById.get(allocation.bed_id) : null; const plot = bed ? plotById.get(bed.plot_id) : null; return bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : null }

  const events = useMemo<CalendarEvent[]>(() => {
    const planned = successions.flatMap((item) => {
      const label = successionLabel(item)
      const result: CalendarEvent[] = [{ date: item.planned_sow_date, kind: "planned", label: text.sow, detail: label, minutes: 0 }]
      if (item.planned_transplant_date) result.push({ date: item.planned_transplant_date, kind: "planned", label: text.transplant, detail: label, minutes: 0 })
      if (item.planned_first_harvest_date) result.push({ date: item.planned_first_harvest_date, kind: "planned", label: text.harvest, detail: label, minutes: 0 })
      return result
    })
    const operational = tasks.filter((task) => task.due_date).map((task) => ({ date: task.due_date as string, kind: "task" as const, label: task.title, detail: task.location_name || task.source_label || text.general, minutes: task.estimated_minutes ?? 0, task }))
    return [...planned, ...operational].sort((left, right) => left.date.localeCompare(right.date))
  }, [successions, tasks, cycleById, text.harvest, text.sow, text.transplant, text.general])
  const weeks = useMemo(() => { const map = new Map<string, CalendarEvent[]>(); events.forEach((event) => { const key = weekKey(event.date); map.set(key, [...(map.get(key) ?? []), event]) }); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)) }, [events])
  const openTasks = tasks.filter((task) => task.status === "nueva" || task.status === "en_progreso")
  const completedTasks = tasks.filter((task) => task.status === "completada")
  const totalMinutes = openTasks.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0)
  const assignedPeople = new Set(openTasks.flatMap((task) => task.task_assignments.map((assignment) => assignment.employee_id).filter(Boolean))).size

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form.title || !form.due_date) return
    const succession = form.succession_id === "none" ? null : successions.find((item) => item.id === form.succession_id) ?? null
    const sourceLabel = succession ? successionLabel(succession) : "Orchard"
    const locationName = succession ? successionLocation(succession.id) : null
    setSaving(true); setError(null)
    const { data, error: taskError } = await supabase.from("tasks").insert({
      title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, due_date: form.due_date,
      location_name: locationName, operational_area: "huerto_vinedo", task_category: form.category.trim() || text.general,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      source_type: succession ? "orchard_succession" : "orchard_general", source_id: succession?.id ?? null,
      source_label: sourceLabel, source_path: succession ? `/${language}/orchard/game-plan` : `/${language}/orchard/work`,
    }).select("id").single()
    if (taskError || !data?.id) { setError(`${text.saveError}: ${taskError?.message ?? "Unknown error"}`); setSaving(false); return }
    if (form.employee_id !== "none") {
      const { error: assignmentError } = await supabase.from("task_assignments").insert({ task_id: data.id, employee_id: form.employee_id })
      if (assignmentError) { await supabase.from("tasks").delete().eq("id", data.id); setError(`${text.saveError}: ${assignmentError.message}`); setSaving(false); return }
    }
    setForm({ succession_id: "none", category: text.general, title: "", description: "", due_date: "", priority: "media", estimated_minutes: "60", employee_id: "none" })
    await loadData(); setSaving(false)
  }

  async function updateStatus(id: string, status: TaskStatus) {
    setSaving(true); const changes: { status: TaskStatus; updated_at: string; completed_at?: string | null } = { status, updated_at: new Date().toISOString() }
    changes.completed_at = status === "completada" ? new Date().toISOString() : null
    const { error: updateError } = await supabase.from("tasks").update(changes).eq("id", id)
    if (updateError) setError(`${text.saveError}: ${updateError.message}`); else await loadData(); setSaving(false)
  }

  return <AppLayout>
    <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>} />
    <OrchardNavigation />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Clock3} label={text.open} value={openTasks.length.toLocaleString(locale)} /><Metric icon={CheckCircle2} label={text.completed} value={completedTasks.length.toLocaleString(locale)} /><Metric icon={CalendarDays} label={text.minutes} value={totalMinutes.toLocaleString(locale)} /><Metric icon={Users} label={text.people} value={assignedPeople.toLocaleString(locale)} /></div>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit"><CardHeader><CardTitle>{text.newTask}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={createTask}>
          <Field label={text.succession}><Select value={form.succession_id} onValueChange={(value) => { const item = successions.find((succession) => succession.id === value); setForm((current) => ({ ...current, succession_id: value, due_date: item?.planned_sow_date ?? current.due_date, title: item ? `${text.sow}: ${successionLabel(item)}` : current.title })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{successions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item)}</SelectItem>)}</SelectContent></Select></Field>
          <Field label={text.category}><Input value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} /></Field>
          <Field label={text.titleLabel}><Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} required /></Field>
          <Field label={text.descriptionLabel}><Textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label={text.due}><Input type="date" value={form.due_date} onChange={(e) => setForm((current) => ({ ...current, due_date: e.target.value }))} required /></Field><Field label={text.duration}><Input type="number" min="0" step="5" value={form.estimated_minutes} onChange={(e) => setForm((current) => ({ ...current, estimated_minutes: e.target.value }))} /></Field></div>
          <Field label={text.priority}><Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as Priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((item) => <SelectItem key={item} value={item}>{titleize(item)}</SelectItem>)}</SelectContent></Select></Field>
          <Field label={text.owner}><Select value={form.employee_id} onValueChange={(value) => setForm((current) => ({ ...current, employee_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.noOwner}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</SelectItem>)}</SelectContent></Select></Field>
          <Button type="submit" className="w-full" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.create}</Button>
        </form></CardContent></Card>
        <Card><CardHeader><CardTitle>{text.calendar}</CardTitle><CardDescription>{text.calendarDescription}</CardDescription></CardHeader><CardContent>{loading ? <p className="py-8 text-sm text-muted-foreground">{text.loading}</p> : weeks.length === 0 ? <p className="py-8 text-sm text-muted-foreground">{text.emptyCalendar}</p> : <div className="space-y-5">{weeks.map(([week, weekEvents]) => <section key={week} className="border-b pb-5 last:border-0"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{text.weekOf} {dateLabel(week, locale)}</h3><Badge variant="outline">{weekEvents.filter((item) => item.kind === "task").reduce((sum, item) => sum + item.minutes, 0)} min</Badge></div><div className="space-y-2">{weekEvents.map((item, index) => <div key={`${item.date}-${item.kind}-${index}`} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[110px_90px_1fr]"><p className="text-sm font-medium">{dateLabel(item.date, locale)}</p><Badge variant={item.kind === "task" ? "secondary" : "outline"} className="w-fit">{item.kind === "task" ? text.task : text.planned}</Badge><div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.detail}{item.minutes ? ` · ${item.minutes} min` : ""}</p></div></div>)}</div></section>)}</div>}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>{text.tasks}</CardTitle></CardHeader><CardContent>{tasks.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{text.emptyTasks}</p> : <div className="space-y-3">{tasks.map((task) => <div key={task.id} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{task.title}</p><Badge variant="outline">{titleize(task.priority)}</Badge>{task.task_category && <Badge variant="secondary">{task.task_category}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{task.due_date ? dateLabel(task.due_date, locale) : "—"}{task.location_name ? ` · ${task.location_name}` : ""}{task.source_label ? ` · ${task.source_label}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{task.task_assignments.map((assignment) => assignment.employees?.name).filter(Boolean).join(", ") || text.noOwner}</p></div><Select value={task.status} onValueChange={(value) => void updateStatus(task.id, value as TaskStatus)} disabled={saving}><SelectTrigger className="w-[155px]"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{titleize(item)}</SelectItem>)}</SelectContent></Select></div>)}</div>}</CardContent></Card>
    </div>
  </AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card> }

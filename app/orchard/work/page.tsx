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

type Status = "nueva" | "en_progreso" | "completada" | "cancelada"
type Priority = "baja" | "media" | "alta" | "urgente"
type Task = { id: string; title: string; priority: Priority; status: Status; due_date: string | null; location_name: string | null; task_category: string | null; estimated_minutes: number | null; source_id: string | null; source_label: string | null }
type Assignment = { task_id: string; employee_id: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null }
type Cycle = { id: string; crop_name: string; variety: string | null }
type Employee = { id: string; name: string; role: string | null }
type Allocation = { crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string }
type Event = { date: string; kind: "plan" | "task"; title: string; detail: string; minutes: number }

const statuses: Status[] = ["nueva", "en_progreso", "completada", "cancelada"]
const priorities: Priority[] = ["baja", "media", "alta", "urgente"]
const copy = {
  en: { title: "Tasks & Calendar", description: "Turn crop planning into assigned operational work using Blackswan's canonical task system.", refresh: "Refresh", newTask: "Create Orchard task", succession: "Crop succession", titleLabel: "Task title", instructions: "Instructions", category: "Work type", due: "Due date", priority: "Priority", duration: "Minutes", owner: "Owner", unassigned: "Unassigned", create: "Create task", calendar: "Calendar & workload", calendarHelp: "Planning milestones and real operational tasks in one weekly view.", tasks: "Operational tasks", open: "Open", completed: "Completed", minutes: "Open minutes", people: "Assigned people", empty: "No Orchard tasks yet.", emptyCalendar: "No dated work yet.", week: "Week of", plan: "Plan", task: "Task", sow: "Sow", transplant: "Transplant", harvest: "Harvest", general: "General field work", saveError: "Could not save task", loadError: "Could not load Orchard work" },
  es: { title: "Tareas y Calendario", description: "Convierte la planificación en trabajo asignado usando el sistema canónico de tareas de Blackswan.", refresh: "Actualizar", newTask: "Crear tarea de Orchard", succession: "Sucesión", titleLabel: "Título", instructions: "Instrucciones", category: "Tipo de trabajo", due: "Fecha objetivo", priority: "Prioridad", duration: "Minutos", owner: "Responsable", unassigned: "Sin asignar", create: "Crear tarea", calendar: "Calendario y carga", calendarHelp: "Hitos planificados y tareas operativas reales en una sola vista semanal.", tasks: "Tareas operativas", open: "Abiertas", completed: "Completadas", minutes: "Minutos abiertos", people: "Responsables", empty: "Aún no hay tareas de Orchard.", emptyCalendar: "Aún no hay trabajo con fecha.", week: "Semana del", plan: "Plan", task: "Tarea", sow: "Siembra", transplant: "Trasplante", harvest: "Cosecha", general: "Trabajo general de terreno", saveError: "No fue posible guardar la tarea", loadError: "No fue posible cargar el trabajo de Orchard" },
} as const

const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateLabel = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale)
function weekKey(date: string) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) }

export default function OrchardWorkPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const lang = language === "es" ? "es" : "en"; const text = copy[lang]; const locale = lang === "es" ? "es-CL" : "en-US"
  const [tasks, setTasks] = useState<Task[]>([]); const [assignments, setAssignments] = useState<Assignment[]>([]); const [successions, setSuccessions] = useState<Succession[]>([]); const [cycles, setCycles] = useState<Cycle[]>([]); const [employees, setEmployees] = useState<Employee[]>([]); const [allocations, setAllocations] = useState<Allocation[]>([]); const [beds, setBeds] = useState<Bed[]>([]); const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ succession_id: "none", title: "", description: "", category: "General field work", due_date: "", priority: "media" as Priority, estimated_minutes: "60", employee_id: "none" })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [t, s, c, e, a, b, p] = await Promise.all([
      supabase.from("tasks").select("id, title, priority, status, due_date, location_name, task_category, estimated_minutes, source_id, source_label").eq("operational_area", "huerto_vinedo").like("source_type", "orchard_%").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_sow_date, planned_transplant_date, planned_first_harvest_date").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id, crop_name, variety"),
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id, bed_id"), supabase.from("orchard_beds").select("id, plot_id, name"), supabase.from("orchard_plots").select("id, name"),
    ])
    const firstError = t.error ?? s.error ?? c.error ?? e.error ?? a.error ?? b.error ?? p.error
    if (firstError) { setError(`${text.loadError}: ${firstError.message}`); setLoading(false); return }
    const nextTasks = (t.data ?? []) as Task[]
    const ids = nextTasks.map((task) => task.id)
    let nextAssignments: Assignment[] = []
    if (ids.length) { const result = await supabase.from("task_assignments").select("task_id, employee_id").in("task_id", ids); if (result.error) setError(`${text.loadError}: ${result.error.message}`); else nextAssignments = (result.data ?? []) as Assignment[] }
    setTasks(nextTasks); setAssignments(nextAssignments); setSuccessions((s.data ?? []) as Succession[]); setCycles((c.data ?? []) as Cycle[]); setEmployees((e.data ?? []) as Employee[]); setAllocations((a.data ?? []) as Allocation[]); setBeds((b.data ?? []) as Bed[]); setPlots((p.data ?? []) as Plot[]); setLoading(false)
  }, [supabase, text.loadError])
  useEffect(() => { void load() }, [load])

  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles]); const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds]); const plotById = useMemo(() => new Map(plots.map((item) => [item.id, item])), [plots]); const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees])
  const successionLabel = (item: Succession) => { const cycle = cycleById.get(item.crop_cycle_id); return `${cycle?.crop_name ?? "Crop"}${cycle?.variety ? ` · ${cycle.variety}` : ""} #${item.sequence_no}` }
  const locationFor = (id: string) => { const allocation = allocations.find((item) => item.crop_succession_id === id); const bed = allocation ? bedById.get(allocation.bed_id) : null; const plot = bed ? plotById.get(bed.plot_id) : null; return bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : null }
  const assignedNames = (taskId: string) => assignments.filter((item) => item.task_id === taskId && item.employee_id).map((item) => employeeById.get(item.employee_id as string)?.name).filter(Boolean).join(", ")

  const events = useMemo<Event[]>(() => {
    const planned = successions.flatMap((item) => { const detail = successionLabel(item); const result: Event[] = [{ date: item.planned_sow_date, kind: "plan", title: text.sow, detail, minutes: 0 }]; if (item.planned_transplant_date) result.push({ date: item.planned_transplant_date, kind: "plan", title: text.transplant, detail, minutes: 0 }); if (item.planned_first_harvest_date) result.push({ date: item.planned_first_harvest_date, kind: "plan", title: text.harvest, detail, minutes: 0 }); return result })
    const real = tasks.filter((task) => task.due_date).map((task) => ({ date: task.due_date as string, kind: "task" as const, title: task.title, detail: task.location_name || task.source_label || text.general, minutes: task.estimated_minutes ?? 0 }))
    return [...planned, ...real].sort((a, b) => a.date.localeCompare(b.date))
  }, [successions, tasks, cycleById, text.sow, text.transplant, text.harvest, text.general])
  const weeks = useMemo(() => { const groups = new Map<string, Event[]>(); events.forEach((event) => { const key = weekKey(event.date); groups.set(key, [...(groups.get(key) ?? []), event]) }); return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)) }, [events])
  const open = tasks.filter((task) => task.status === "nueva" || task.status === "en_progreso"); const completed = tasks.filter((task) => task.status === "completada"); const minutes = open.reduce((sum, item) => sum + (item.estimated_minutes ?? 0), 0); const people = new Set(assignments.filter((item) => open.some((task) => task.id === item.task_id)).map((item) => item.employee_id).filter(Boolean)).size

  async function createTask(event: FormEvent) {
    event.preventDefault(); if (!form.title || !form.due_date) return
    const succession = form.succession_id === "none" ? null : successions.find((item) => item.id === form.succession_id) ?? null
    setSaving(true); setError(null)
    const result = await supabase.from("tasks").insert({ title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, due_date: form.due_date, operational_area: "huerto_vinedo", task_category: form.category.trim() || text.general, estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null, location_name: succession ? locationFor(succession.id) : null, source_type: succession ? "orchard_succession" : "orchard_general", source_id: succession?.id ?? null, source_label: succession ? successionLabel(succession) : "Orchard", source_path: succession ? `/${language}/orchard/game-plan` : `/${language}/orchard/work` }).select("id").single()
    if (result.error || !result.data?.id) { setError(`${text.saveError}: ${result.error?.message ?? "Unknown error"}`); setSaving(false); return }
    if (form.employee_id !== "none") { const assignment = await supabase.from("task_assignments").insert({ task_id: result.data.id, employee_id: form.employee_id }); if (assignment.error) { await supabase.from("tasks").delete().eq("id", result.data.id); setError(`${text.saveError}: ${assignment.error.message}`); setSaving(false); return } }
    setForm({ succession_id: "none", title: "", description: "", category: text.general, due_date: "", priority: "media", estimated_minutes: "60", employee_id: "none" }); await load(); setSaving(false)
  }
  async function updateStatus(id: string, status: Status) { setSaving(true); const result = await supabase.from("tasks").update({ status, completed_at: status === "completada" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false) }

  return <AppLayout><PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} /><OrchardNavigation /><div className="space-y-6 p-4 sm:p-8">{error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Clock3} label={text.open} value={open.length} /><Metric icon={CheckCircle2} label={text.completed} value={completed.length} /><Metric icon={CalendarDays} label={text.minutes} value={minutes} /><Metric icon={Users} label={text.people} value={people} /></div>
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle>{text.newTask}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={createTask}><Field label={text.succession}><Select value={form.succession_id} onValueChange={(value) => { const item = successions.find((entry) => entry.id === value); setForm((f) => ({ ...f, succession_id: value, due_date: item?.planned_sow_date ?? f.due_date, title: item ? `${text.sow}: ${successionLabel(item)}` : f.title })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{successions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.titleLabel}><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></Field><Field label={text.instructions}><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field><Field label={text.category}><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-3"><Field label={text.due}><Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} required /></Field><Field label={text.duration}><Input type="number" min="0" step="5" value={form.estimated_minutes} onChange={(e) => setForm((f) => ({ ...f, estimated_minutes: e.target.value }))} /></Field></div><Field label={text.priority}><Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p} value={p}>{titleize(p)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.owner}><Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.unassigned}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</SelectItem>)}</SelectContent></Select></Field><Button type="submit" className="w-full" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></form></CardContent></Card>
      <Card><CardHeader><CardTitle>{text.calendar}</CardTitle><CardDescription>{text.calendarHelp}</CardDescription></CardHeader><CardContent>{loading ? <p>Loading…</p> : weeks.length === 0 ? <p className="text-sm text-muted-foreground">{text.emptyCalendar}</p> : <div className="space-y-5">{weeks.map(([week, items]) => <section key={week} className="border-b pb-4 last:border-0"><div className="mb-2 flex justify-between"><p className="font-semibold">{text.week} {dateLabel(week, locale)}</p><Badge variant="outline">{items.reduce((sum, item) => sum + item.minutes, 0)} min</Badge></div><div className="space-y-2">{items.map((item, index) => <div key={`${item.date}-${index}`} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[110px_80px_1fr]"><span className="text-sm">{dateLabel(item.date, locale)}</span><Badge variant={item.kind === "task" ? "secondary" : "outline"} className="w-fit">{item.kind === "task" ? text.task : text.plan}</Badge><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.detail}{item.minutes ? ` · ${item.minutes} min` : ""}</p></div></div>)}</div></section>)}</div>}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>{text.tasks}</CardTitle></CardHeader><CardContent>{tasks.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> : <div className="space-y-3">{tasks.map((task) => <div key={task.id} className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap gap-2"><p className="font-semibold">{task.title}</p><Badge variant="outline">{titleize(task.priority)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{task.due_date ? dateLabel(task.due_date, locale) : "—"}{task.location_name ? ` · ${task.location_name}` : ""}</p><p className="text-xs text-muted-foreground">{assignedNames(task.id) || text.unassigned}</p></div><Select value={task.status} onValueChange={(v) => void updateStatus(task.id, v as Status)}><SelectTrigger className="w-[155px]"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{titleize(s)}</SelectItem>)}</SelectContent></Select></div>)}</div>}</CardContent></Card>
  </div></AppLayout>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: number }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card> }

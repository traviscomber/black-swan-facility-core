"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Plus, RefreshCw, Sparkles } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
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
import { ALL_GAME_PLANS, gamePlanScopeLabel, resolveRequestedGamePlanId, resolveSelectedGamePlan, scopeGamePlanGraph, withGamePlanQuery, type OrchardGamePlanRef } from "@/lib/orchard/game-plan-scope"

type Status = "nueva" | "en_progreso" | "completada" | "cancelada"
type Priority = "baja" | "media" | "alta" | "urgente"
type WorkLocale = "en" | "es" | "de"
type WorkForm = {
  succession_id: string
  source_type: string
  title: string
  description: string
  category: string
  due_date: string
  priority: Priority
  estimated_minutes: string
  employee_id: string
}
type Task = { id: string; title: string; priority: Priority; status: Status; due_date: string | null; location_name: string | null; task_category: string | null; estimated_minutes: number | null; source_type: string | null; source_id: string | null; source_label: string | null }
type Assignment = { task_id: string; employee_id: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null }
type Cycle = { id: string; game_plan_id: string; crop_name: string; variety: string | null }
type Employee = { id: string; name: string; role: string | null }
type Allocation = { crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string }
type Event = { date: string; kind: "plan" | "task"; title: string; detail: string; minutes: number }
type Milestone = { successionId: string; sourceType: string; date: string; title: string; detail: string; category: string; minutes: number }
type Photo = { src: string; alt: string }

const image = (id: string, width = 1800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=92&w=${width}`
const WORK_HERO: Photo = { src: image("1500937386664-56d1dfef3854", 2200), alt: "" }
const WORK_PHOTOS: Photo[] = [
  { src: image("1464226184884-fa280b87c399"), alt: "" },
  { src: image("1416879595882-3373a0480b5b"), alt: "" },
  { src: image("1488459716781-31db52582fe9"), alt: "" },
  { src: image("1518977676601-b53f82aba655"), alt: "" },
]
const CROP_PHOTOS: Record<string, Photo> = {
  Tomato: { src: "https://unsplash.com/photos/WHHbA0kU8Qg/download?force=true&w=1800", alt: "Tomato" },
  Lettuce: { src: "https://unsplash.com/photos/SXztF2mpCTA/download?force=true&w=1800", alt: "Lettuce" },
  Onion: { src: "https://unsplash.com/photos/e3F37BvB5Vg/download?force=true&w=1800", alt: "Onion" },
  Arugula: { src: "https://unsplash.com/photos/vlQ0g2jCgA4/download?force=true&w=1800", alt: "Arugula" },
  Radish: { src: "https://unsplash.com/photos/jU2Vv-it18c/download?force=true&w=1800", alt: "Radish" },
  Carrot: { src: "https://unsplash.com/photos/4yK8iDaWnm8/download?force=true&w=1800", alt: "Carrot" },
  Basil: { src: "https://unsplash.com/photos/T4uyB67uZ40/download?force=true&w=1800", alt: "Basil" },
}

const statuses: Status[] = ["nueva", "en_progreso", "completada", "cancelada"]
const priorities: Priority[] = ["baja", "media", "alta", "urgente"]
const copy = {
  en: {
    title: "Tasks & Calendar", description: "Run Orchard work from one cockpit: planning milestones, real tasks, workload and field accountability.", refresh: "Refresh", newTask: "Create Orchard task", succession: "Crop succession", titleLabel: "Task title", instructions: "Instructions", category: "Work type", due: "Due date", priority: "Priority", duration: "Minutes", owner: "Owner", unassigned: "Unassigned", create: "Create task", calendar: "Weekly calendar", calendarHelp: "Planning milestones and real operational tasks in one weekly view.", tasks: "Operational tasks", open: "Open", completed: "Completed", overdue: "Overdue", today: "Due today", upcoming: "Next 7 days", minutes: "Open minutes", people: "Assigned people", empty: "No attributed Orchard tasks in this scope.", emptyCalendar: "No dated work in this scope.", week: "Week of", plan: "Plan", task: "Task", sow: "Sow", transplant: "Transplant", harvest: "Harvest", general: "General field work", saveError: "Could not save task", loadError: "Could not load Orchard work", milestones: "Planning milestones", milestonesHelp: "Convert the selected Game Plan into canonical tasks only when work should become accountable.", generateMissing: "Create missing milestone tasks", generated: "Task created", createFromPlan: "Create task", allCovered: "All current planning milestones already have matching tasks.", workloadPeople: "Workload by person", workloadCrop: "Workload by crop", noWorkload: "No open assigned workload.", taskCount: "tasks", plannedOnly: "Planning milestone", operational: "Operational task", aiCreated: "Created by Orchard AI · focused record", scope: "Game Plan scope", allOrchard: "All Orchard", scopeHelp: "When a Game Plan is selected, only work attributable to its successions is included. Unlinked general Orchard tasks remain outside the scoped view.", heroEyebrow:"Orchard · Operations", heroAlt:"Hands working carefully among rows of healthy crops", fieldWorkAlt:"Field work", events:"events", unknownError:"Unknown error", cropFallback:"Crop"
  },
  es: {
    title: "Tareas y Calendario", description: "Opera Orchard desde un solo cockpit: hitos planificados, tareas reales, carga y responsabilidad en terreno.", refresh: "Actualizar", newTask: "Crear tarea de Orchard", succession: "Sucesión", titleLabel: "Título", instructions: "Instrucciones", category: "Tipo de trabajo", due: "Fecha objetivo", priority: "Prioridad", duration: "Minutos", owner: "Responsable", unassigned: "Sin asignar", create: "Crear tarea", calendar: "Calendario semanal", calendarHelp: "Hitos planificados y tareas operativas reales en una sola vista semanal.", tasks: "Tareas operativas", open: "Abiertas", completed: "Completadas", overdue: "Atrasadas", today: "Vencen hoy", upcoming: "Próximos 7 días", minutes: "Minutos abiertos", people: "Responsables", empty: "No hay tareas de Orchard atribuibles a este alcance.", emptyCalendar: "No hay trabajo con fecha en este alcance.", week: "Semana del", plan: "Plan", task: "Tarea", sow: "Siembra", transplant: "Trasplante", harvest: "Cosecha", general: "Trabajo general de terreno", saveError: "No fue posible guardar la tarea", loadError: "No fue posible cargar el trabajo de Orchard", milestones: "Hitos de planificación", milestonesHelp: "Convierte el Game Plan seleccionado en tareas canónicas solo cuando el trabajo deba tener responsable.", generateMissing: "Crear tareas faltantes de hitos", generated: "Tarea creada", createFromPlan: "Crear tarea", allCovered: "Todos los hitos actuales ya tienen una tarea equivalente.", workloadPeople: "Carga por persona", workloadCrop: "Carga por cultivo", noWorkload: "No hay carga abierta asignada.", taskCount: "tareas", plannedOnly: "Hito planificado", operational: "Tarea operativa", aiCreated: "Creado por Orchard AI · registro enfocado", scope: "Alcance del Game Plan", allOrchard: "Todo Orchard", scopeHelp: "Cuando hay un Game Plan seleccionado, solo se incluye trabajo atribuible a sus sucesiones. Las tareas generales sin vínculo quedan fuera de la vista acotada.", heroEyebrow:"Orchard · Operaciones", heroAlt:"Manos trabajando cuidadosamente entre hileras de cultivos sanos", fieldWorkAlt:"Trabajo en terreno", events:"eventos", unknownError:"Error desconocido", cropFallback:"Cultivo"
  },
  de: {
    title: "Aufgaben & Kalender", description: "Steuere Orchard-Arbeit aus einem Cockpit: Planungsmeilensteine, reale Aufgaben, Arbeitslast und Verantwortung im Feld.", refresh: "Aktualisieren", newTask: "Orchard-Aufgabe erstellen", succession: "Kulturfolge", titleLabel: "Aufgabentitel", instructions: "Anweisungen", category: "Arbeitsart", due: "Fälligkeitsdatum", priority: "Priorität", duration: "Minuten", owner: "Verantwortlich", unassigned: "Nicht zugewiesen", create: "Aufgabe erstellen", calendar: "Wochenkalender", calendarHelp: "Planungsmeilensteine und reale operative Aufgaben in einer Wochenansicht.", tasks: "Operative Aufgaben", open: "Offen", completed: "Abgeschlossen", overdue: "Überfällig", today: "Heute fällig", upcoming: "Nächste 7 Tage", minutes: "Offene Minuten", people: "Zugewiesene Personen", empty: "Keine zugeordneten Orchard-Aufgaben in diesem Umfang.", emptyCalendar: "Keine terminierten Arbeiten in diesem Umfang.", week: "Woche ab", plan: "Plan", task: "Aufgabe", sow: "Aussaat", transplant: "Pflanzung", harvest: "Ernte", general: "Allgemeine Feldarbeit", saveError: "Aufgabe konnte nicht gespeichert werden", loadError: "Orchard-Arbeit konnte nicht geladen werden", milestones: "Planungsmeilensteine", milestonesHelp: "Wandle den ausgewählten Game Plan nur dann in verbindliche Aufgaben um, wenn Arbeit verantwortet werden soll.", generateMissing: "Fehlende Meilenstein-Aufgaben erstellen", generated: "Aufgabe erstellt", createFromPlan: "Aufgabe erstellen", allCovered: "Für alle aktuellen Planungsmeilensteine existieren bereits passende Aufgaben.", workloadPeople: "Arbeitslast nach Person", workloadCrop: "Arbeitslast nach Kultur", noWorkload: "Keine offene zugewiesene Arbeitslast.", taskCount: "Aufgaben", plannedOnly: "Planungsmeilenstein", operational: "Operative Aufgabe", aiCreated: "Von Orchard AI erstellt · fokussierter Eintrag", scope: "Game-Plan-Umfang", allOrchard: "Gesamter Orchard", scopeHelp: "Bei ausgewähltem Game Plan wird nur Arbeit einbezogen, die seinen Folgen zugeordnet werden kann. Allgemeine, unverknüpfte Orchard-Aufgaben bleiben außerhalb der eingeschränkten Ansicht.", heroEyebrow:"Orchard · Betrieb", heroAlt:"Hände bei sorgfältiger Arbeit zwischen gesunden Kulturreihen", fieldWorkAlt:"Feldarbeit", events:"Ereignisse", unknownError:"Unbekannter Fehler", cropFallback:"Kultur"
  },
} as const

const statusLabels: Record<WorkLocale, Record<Status,string>> = {
  en:{nueva:"New",en_progreso:"In progress",completada:"Completed",cancelada:"Cancelled"},
  es:{nueva:"Nueva",en_progreso:"En progreso",completada:"Completada",cancelada:"Cancelada"},
  de:{nueva:"Neu",en_progreso:"In Bearbeitung",completada:"Abgeschlossen",cancelada:"Abgebrochen"},
}
const priorityLabels: Record<WorkLocale, Record<Priority,string>> = {
  en:{baja:"Low",media:"Medium",alta:"High",urgente:"Urgent"},
  es:{baja:"Baja",media:"Media",alta:"Alta",urgente:"Urgente"},
  de:{baja:"Niedrig",media:"Mittel",alta:"Hoch",urgente:"Dringend"},
}
const locales={en:"en-US",es:"es-CL",de:"de-DE"} as const
const dateLabel = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale)
function localDateFrom(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }
function weekKey(date: string) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localDateFrom(d) }
function localDateKey(offsetDays = 0) { const d = new Date(); d.setDate(d.getDate() + offsetDays); return localDateFrom(d) }

export default function OrchardWorkPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang:WorkLocale = language
  const text = copy[lang]
  const locale = locales[lang]
  const statusLabel=(value:Status)=>statusLabels[lang][value]
  const priorityLabel=(value:Priority)=>priorityLabels[lang][value]
  const [plans, setPlans] = useState<OrchardGamePlanRef[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ALL_GAME_PLANS)
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
  const [focusedEntity, setFocusedEntity] = useState<string | null>(null)
  const [form, setForm] = useState<WorkForm>({ succession_id: "none", source_type: "orchard_general", title: "", description: "", category: copy[language].general, due_date: "", priority: "media" as Priority, estimated_minutes: "60", employee_id: "none" })

  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get("from") === "orchard-ai") setFocusedEntity(params.get("entity")) }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [gp, t, s, c, e, a, b, p] = await Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date", { ascending: false }),
      supabase.from("tasks").select("id, title, priority, status, due_date, location_name, task_category, estimated_minutes, source_type, source_id, source_label").eq("operational_area", "huerto_vinedo").like("source_type", "orchard_%").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_sow_date, planned_transplant_date, planned_first_harvest_date").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id, game_plan_id, crop_name, variety"),
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id, bed_id"),
      supabase.from("orchard_beds").select("id, plot_id, name"),
      supabase.from("orchard_plots").select("id, name"),
    ])
    const firstError = gp.error ?? t.error ?? s.error ?? c.error ?? e.error ?? a.error ?? b.error ?? p.error
    if (firstError) { setError(`${text.loadError}: ${firstError.message}`); setLoading(false); return }
    const nextPlans = (gp.data ?? []) as OrchardGamePlanRef[]
    const requestedPlanId = resolveRequestedGamePlanId(nextPlans, window.location.search)
    const allCycles = (c.data ?? []) as Cycle[]
    const allSuccessions = (s.data ?? []) as Succession[]
    const graph = scopeGamePlanGraph(allCycles, allSuccessions, requestedPlanId)
    const scopedSuccessionIds = graph.successionIds
    const allTasks = (t.data ?? []) as Task[]
    const nextTasks = requestedPlanId === ALL_GAME_PLANS ? allTasks : allTasks.filter((task) => Boolean(task.source_id && scopedSuccessionIds.has(task.source_id)))
    const ids = nextTasks.map((task) => task.id)
    let nextAssignments: Assignment[] = []
    if (ids.length) { const result = await supabase.from("task_assignments").select("task_id, employee_id").in("task_id", ids); if (result.error) setError(`${text.loadError}: ${result.error.message}`); else nextAssignments = (result.data ?? []) as Assignment[] }
    setPlans(nextPlans); setSelectedPlanId(requestedPlanId); setTasks(nextTasks); setAssignments(nextAssignments); setSuccessions(graph.scopedSuccessions as Succession[]); setCycles(graph.scopedCycles as Cycle[]); setEmployees((e.data ?? []) as Employee[]); setAllocations((a.data ?? []).filter((item) => requestedPlanId === ALL_GAME_PLANS || scopedSuccessionIds.has(item.crop_succession_id)) as Allocation[]); setBeds((b.data ?? []) as Bed[]); setPlots((p.data ?? []) as Plot[]); setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (loading || !focusedEntity || !tasks.some((task) => task.id === focusedEntity)) return; window.setTimeout(() => document.getElementById(`task-${focusedEntity}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120) }, [loading, focusedEntity, tasks])

  const selectedPlan = useMemo(() => resolveSelectedGamePlan(plans, selectedPlanId), [plans, selectedPlanId])
  const scopeLabel = gamePlanScopeLabel(selectedPlan, text.allOrchard)
  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions])
  const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds])
  const plotById = useMemo(() => new Map(plots.map((item) => [item.id, item])), [plots])
  const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees])
  const successionLabel = useCallback((item: Succession) => { const cycle = cycleById.get(item.crop_cycle_id); return `${cycle?.crop_name ?? text.cropFallback}${cycle?.variety ? ` · ${cycle.variety}` : ""} #${item.sequence_no}` }, [cycleById,text.cropFallback])
  const locationFor = useCallback((id: string) => { const allocation = allocations.find((item) => item.crop_succession_id === id); const bed = allocation ? bedById.get(allocation.bed_id) : null; const plot = bed ? plotById.get(bed.plot_id) : null; return bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : null }, [allocations, bedById, plotById])
  const assignedNames = (taskId: string) => assignments.filter((item) => item.task_id === taskId && item.employee_id).map((item) => employeeById.get(item.employee_id as string)?.name).filter(Boolean).join(", ")
  const photoForSuccession = useCallback((id: string) => { const succession = successionById.get(id); const crop = succession ? cycleById.get(succession.crop_cycle_id)?.crop_name : null; return (crop && CROP_PHOTOS[crop]) || WORK_PHOTOS[Math.abs(id.length) % WORK_PHOTOS.length] }, [successionById, cycleById])

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

  const today = localDateKey(), nextWeek = localDateKey(7)
  const open = tasks.filter((task) => task.status === "nueva" || task.status === "en_progreso")
  const completed = tasks.filter((task) => task.status === "completada")
  const overdue = open.filter((task) => task.due_date && task.due_date < today)
  const dueToday = open.filter((task) => task.due_date === today)
  const upcoming = open.filter((task) => task.due_date && task.due_date > today && task.due_date <= nextWeek)
  const minutes = open.reduce((sum, item) => sum + (item.estimated_minutes ?? 0), 0)
  const people = new Set(assignments.filter((item) => open.some((task) => task.id === item.task_id)).map((item) => item.employee_id).filter(Boolean)).size

  const workloadByPerson = useMemo(() => employees.map((employee) => { const taskIds = new Set(assignments.filter((item) => item.employee_id === employee.id).map((item) => item.task_id)); const assigned = open.filter((task) => taskIds.has(task.id)); return { id: employee.id, name: employee.name, role: employee.role, tasks: assigned.length, minutes: assigned.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0) } }).filter((item) => item.tasks > 0).sort((a, b) => b.minutes - a.minutes), [employees, assignments, open])
  const workloadByCrop = useMemo(() => { const groups = new Map<string, { label: string; tasks: number; minutes: number }>(); open.forEach((task) => { const succession = task.source_id ? successionById.get(task.source_id) : null; const label = succession ? successionLabel(succession) : text.general; const current = groups.get(label) ?? { label, tasks: 0, minutes: 0 }; current.tasks += 1; current.minutes += task.estimated_minutes ?? 0; groups.set(label, current) }); return [...groups.values()].sort((a, b) => b.minutes - a.minutes) }, [open, successionById, successionLabel, text.general])

  function prefillMilestone(item: Milestone) { setForm({ succession_id: item.successionId, source_type: item.sourceType, title: `${item.title}: ${item.detail}`, description: "", category: item.category, due_date: item.date, priority: "media", estimated_minutes: String(item.minutes), employee_id: "none" }); document.getElementById("orchard-task-form")?.scrollIntoView({ behavior: "smooth", block: "start" }) }
  async function createTask(event: FormEvent) {
    event.preventDefault(); if (!form.title || !form.due_date) return
    const succession = form.succession_id === "none" ? null : successions.find((item) => item.id === form.succession_id) ?? null
    if (selectedPlanId !== ALL_GAME_PLANS && !succession) { setError(`${text.saveError}: ${text.scopeHelp}`); return }
    setSaving(true); setError(null)
    const result = await supabase.from("tasks").insert({ title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, due_date: form.due_date, operational_area: "huerto_vinedo", task_category: form.category.trim() || text.general, estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null, location_name: succession ? locationFor(succession.id) : null, source_type: succession ? form.source_type : "orchard_general", source_id: succession?.id ?? null, source_label: succession ? successionLabel(succession) : "Orchard", source_path: succession ? withGamePlanQuery(`/${language}/orchard/game-plan`, selectedPlanId) : `/${language}/orchard/work` }).select("id").single()
    if (result.error || !result.data?.id) { setError(`${text.saveError}: ${result.error?.message ?? text.unknownError}`); setSaving(false); return }
    if (form.employee_id !== "none") { const assignment = await supabase.from("task_assignments").insert({ task_id: result.data.id, employee_id: form.employee_id }); if (assignment.error) { await supabase.from("tasks").delete().eq("id", result.data.id); setError(`${text.saveError}: ${assignment.error.message}`); setSaving(false); return } }
    setForm({ succession_id: "none", source_type: "orchard_general", title: "", description: "", category: text.general, due_date: "", priority: "media", estimated_minutes: "60", employee_id: "none" }); await load(); setSaving(false)
  }
  async function generateMissingTasks() { if (!missingMilestones.length) return; setSaving(true); setError(null); const rows = missingMilestones.map((item) => ({ title: `${item.title}: ${item.detail}`, priority: "media" as Priority, due_date: item.date, operational_area: "huerto_vinedo", task_category: item.category, estimated_minutes: item.minutes, location_name: locationFor(item.successionId), source_type: item.sourceType, source_id: item.successionId, source_label: item.detail, source_path: withGamePlanQuery(`/${language}/orchard/game-plan`, selectedPlanId) })); const result = await supabase.from("tasks").insert(rows); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false) }
  async function updateStatus(id: string, status: Status) { setSaving(true); const result = await supabase.from("tasks").update({ status, completed_at: status === "completada" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false) }

  return <AppLayout>
    <OrchardNavigation />
    <main className="mx-auto w-full max-w-[1560px] space-y-10 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      <section className="relative isolate min-h-[360px] overflow-hidden bg-neutral-950 sm:min-h-[420px]">
        <img src={WORK_HERO.src} alt={text.heroAlt} className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.36)_58%,rgba(0,0,0,.12)_100%)]" />
        <div className="relative flex min-h-[360px] max-w-3xl flex-col justify-end p-6 text-white sm:min-h-[420px] sm:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">{text.heroEyebrow}</p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{text.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/75">{text.description}</p>
          <div className="mt-4 max-w-xl border border-white/15 bg-black/25 px-3 py-2 text-xs text-white/75"><span className="font-medium text-white">{text.scope}: {scopeLabel}</span><span className="ml-2 text-white/55">{text.scopeHelp}</span></div>
          <div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => void load()} disabled={loading} className="bg-white text-black hover:bg-white/90"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button><Badge className="border-white/20 bg-black/30 px-3 py-2 text-white">{open.length} {text.open}</Badge><Badge className="border-white/20 bg-black/30 px-3 py-2 text-white">{minutes} min</Badge></div>
        </div>
        <div className="absolute bottom-6 right-6 hidden grid-cols-2 gap-px bg-white/10 lg:grid"><HeroMetric label={text.overdue} value={overdue.length} /><HeroMetric label={text.today} value={dueToday.length} /><HeroMetric label={text.upcoming} value={upcoming.length} /><HeroMetric label={text.people} value={people} /></div>
      </section>
      {focusedEntity && tasks.some((task) => task.id === focusedEntity) && <div className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-4 py-3 text-sm"><Sparkles className="h-4 w-4 text-primary" /><span>{text.aiCreated}</span></div>}
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <section>
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">01</p><h2 className="mt-2">{text.milestones}</h2><p className="mt-1 text-sm text-muted-foreground">{text.milestonesHelp}</p></div><Button onClick={() => void generateMissingTasks()} disabled={saving || missingMilestones.length === 0}><Sparkles className="mr-2 h-4 w-4" />{text.generateMissing}</Button></div>
        {missingMilestones.length === 0 ? <div className="border border-dashed p-6 text-sm text-muted-foreground">{text.allCovered}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{missingMilestones.slice(0, 9).map((item) => { const photo = photoForSuccession(item.successionId); return <article key={`${item.sourceType}-${item.successionId}-${item.date}`} className="group overflow-hidden border bg-background"><div className="relative h-44 overflow-hidden"><img src={photo.src} alt={item.detail} loading="lazy" className="h-full w-full object-cover opacity-100 [filter:none] transition-transform duration-500 group-hover:scale-[1.015]" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.72)_0%,rgba(0,0,0,.06)_72%)]" /><div className="absolute inset-x-4 bottom-4 text-white"><Badge className="mb-2 border-white/20 bg-black/30 text-white">{text.plannedOnly}</Badge><h3 className="text-lg text-white!">{item.title} · {item.detail}</h3><p className="mt-1 text-xs text-white/70">{dateLabel(item.date, locale)} · {locationFor(item.successionId) ?? text.unassigned}</p></div></div><div className="flex items-center justify-between p-4"><span className="text-sm text-muted-foreground">{item.minutes} min</span><Button size="sm" variant="secondary" onClick={() => prefillMilestone(item)}>{text.createFromPlan}</Button></div></article> })}</div>}
      </section>
      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card id="orchard-task-form"><CardHeader><CardTitle>{text.newTask}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={createTask}><Field label={text.succession}><Select value={form.succession_id} onValueChange={(value) => { const item = successions.find((entry) => entry.id === value); setForm((f) => ({ ...f, succession_id: value, source_type: item ? "orchard_succession" : "orchard_general", due_date: item?.planned_sow_date ?? f.due_date, title: item ? `${text.sow}: ${successionLabel(item)}` : f.title })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{selectedPlanId === ALL_GAME_PLANS && <SelectItem value="none">—</SelectItem>}{successions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.titleLabel}><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></Field><Field label={text.instructions}><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field><Field label={text.category}><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-3"><Field label={text.due}><Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} required /></Field><Field label={text.duration}><Input type="number" min="0" value={form.estimated_minutes} onChange={(e) => setForm((f) => ({ ...f, estimated_minutes: e.target.value }))} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label={text.priority}><Select value={form.priority} onValueChange={(value) => setForm((f) => ({ ...f, priority: value as Priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((item) => <SelectItem key={item} value={item}>{priorityLabel(item)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.owner}><Select value={form.employee_id} onValueChange={(value) => setForm((f) => ({ ...f, employee_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.unassigned}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>)}</SelectContent></Select></Field></div><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></form></CardContent></Card>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>{text.calendar}</CardTitle><CardDescription>{text.calendarHelp}</CardDescription></CardHeader><CardContent>{weeks.length === 0 ? <div className="border border-dashed p-6 text-sm text-muted-foreground">{text.emptyCalendar}</div> : <div className="grid gap-4 lg:grid-cols-2">{weeks.slice(0, 8).map(([week, weekEvents], weekIndex) => <article key={week} className="overflow-hidden border"><div className="relative h-28 overflow-hidden"><img src={WORK_PHOTOS[weekIndex % WORK_PHOTOS.length].src} alt={text.fieldWorkAlt} className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-black/45" /><div className="absolute inset-x-4 bottom-3 text-white"><p className="text-sm font-medium">{text.week} {dateLabel(week, locale)}</p><p className="text-xs text-white/70">{weekEvents.length} {text.events}</p></div></div><div className="grid gap-px bg-border">{weekEvents.slice(0, 5).map((event, index) => <div key={`${event.kind}-${event.date}-${event.title}-${index}`} className="bg-background p-3"><div className="flex items-start justify-between gap-3"><div><Badge variant={event.kind === "task" ? "default" : "outline"}>{event.kind === "task" ? text.operational : text.plannedOnly}</Badge><p className="mt-2 text-sm font-medium">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{event.detail}</p></div><div className="text-right text-xs text-muted-foreground">{dateLabel(event.date, locale)}{event.minutes ? <><br />{event.minutes} min</> : null}</div></div></div>)}</div></article>)}</div>}</CardContent></Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>{text.workloadPeople}</CardTitle></CardHeader><CardContent>{workloadByPerson.length === 0 ? <p className="text-sm text-muted-foreground">{text.noWorkload}</p> : <div className="grid gap-3 sm:grid-cols-2">{workloadByPerson.slice(0, 8).map((item, index) => <article key={item.id} className="relative min-h-36 overflow-hidden border p-4 text-white"><img src={WORK_PHOTOS[index % WORK_PHOTOS.length].src} alt={text.fieldWorkAlt} className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-black/62" /><div className="relative flex h-full flex-col justify-between"><div><p className="font-medium">{item.name}</p><p className="text-xs text-white/65">{item.role ?? "—"}</p></div><div><p className="text-2xl font-medium">{item.minutes} min</p><p className="text-xs text-white/70">{item.tasks} {text.taskCount}</p></div></div></article>)}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle>{text.workloadCrop}</CardTitle></CardHeader><CardContent>{workloadByCrop.length === 0 ? <p className="text-sm text-muted-foreground">{text.noWorkload}</p> : <div className="grid gap-3 sm:grid-cols-2">{workloadByCrop.slice(0, 8).map((item, index) => { const cropName = item.label.split(" · ")[0].split(" #")[0]; const photo = CROP_PHOTOS[cropName] ?? WORK_PHOTOS[index % WORK_PHOTOS.length]; return <article key={item.label} className="overflow-hidden border"><div className="relative h-28"><img src={photo.src} alt={cropName || text.fieldWorkAlt} className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-black/45" /><p className="absolute bottom-3 left-3 right-3 line-clamp-2 text-sm font-medium text-white">{item.label}</p></div><div className="flex items-end justify-between p-3"><p className="text-lg font-medium">{item.minutes} min</p><p className="text-xs text-muted-foreground">{item.tasks} {text.taskCount}</p></div></article>})}</div>}</CardContent></Card>
          </div>
        </div>
      </section>
      <section id="orchard-tasks"><div className="mb-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">03</p><h2 className="mt-2">{text.tasks}</h2><p className="mt-1 text-sm text-muted-foreground">{completed.length} {text.completed}</p></div>{tasks.length === 0 ? <div className="border border-dashed p-6 text-sm text-muted-foreground">{text.empty}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tasks.map((task, index) => { const succession = task.source_id ? successionById.get(task.source_id) : null; const crop = succession ? cycleById.get(succession.crop_cycle_id)?.crop_name : null; const photo = (crop && CROP_PHOTOS[crop]) || WORK_PHOTOS[index % WORK_PHOTOS.length]; const late = Boolean(task.due_date && task.status !== "completada" && task.status !== "cancelada" && task.due_date < today); const focused = task.id === focusedEntity; return <article id={`task-${task.id}`} key={task.id} className={`overflow-hidden border bg-background transition-all duration-500 ${focused ? "border-primary ring-2 ring-primary/40 shadow-[0_0_0_6px_rgba(16,185,129,0.08)]" : ""}`}><div className="relative h-36 overflow-hidden"><img src={photo.src} alt={crop || text.fieldWorkAlt} className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.7)_0%,rgba(0,0,0,.08)_80%)]" /><div className="absolute inset-x-4 bottom-3"><div className="flex flex-wrap gap-2"><Badge className="bg-black/40 text-white">{priorityLabel(task.priority)}</Badge>{late && <Badge variant="destructive">{text.overdue}</Badge>}{focused && <Badge className="bg-primary text-primary-foreground">Orchard AI</Badge>}</div><p className="mt-2 line-clamp-2 font-medium text-white">{task.title}</p></div></div><div className="space-y-3 p-4"><p className="text-xs leading-5 text-muted-foreground">{task.due_date ? dateLabel(task.due_date, locale) : "—"}{task.location_name ? ` · ${task.location_name}` : ""}{task.task_category ? ` · ${task.task_category}` : ""}{task.estimated_minutes ? ` · ${task.estimated_minutes} min` : ""}{assignedNames(task.id) ? ` · ${assignedNames(task.id)}` : ""}</p><Select value={task.status} onValueChange={(value) => void updateStatus(task.id, value as Status)} disabled={saving}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent></Select></div></article>})}</div>}</section>
    </main>
  </AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function HeroMetric({ label, value }: { label: string; value: number }) { return <div className="min-w-32 bg-black/45 px-5 py-4 text-white"><p className="text-[10px] uppercase tracking-[0.14em] text-white/55">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{value}</p></div> }

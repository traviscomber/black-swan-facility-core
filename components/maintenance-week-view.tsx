"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronLeft, ChevronRight, ClipboardPlus } from "lucide-react"
import { format, addDays, startOfWeek } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LinkedOperationalTask } from "@/components/linked-operational-task"
import { useLanguage } from "@/lib/hooks/use-language"
import { buildOperationalTaskHref } from "@/lib/operational-task-links"

interface WorkOrder { id: string; title: string; description?: string | null; status?: string | null; estado_extendido?: string | null; priority?: string | null; prioridad?: string | null; assigned_to?: string | null; next_run?: string | null; fecha_objetivo?: string | null; assets?: { name?: string | null } | null }
interface MaintenanceWeekViewProps { tasks: WorkOrder[]; onTaskClick?: (task: WorkOrder) => void }

const priorityMap: Record<string, "baja" | "media" | "alta" | "urgente"> = { low: "baja", medium: "media", high: "alta", critical: "urgente", baja: "baja", media: "media", alta: "alta", urgente: "urgente" }
const COPY = {
  en: {
    noWork: "No work",
    createTask: "Create operational task",
    maintenanceCategory: "Maintenance",
    defaultDescription: (asset?: string | null) => `Execute maintenance work${asset ? ` on ${asset}` : ""} and record the result.`,
    status: { draft: "Draft", scheduled: "Scheduled", assigned: "Assigned", in_progress: "In progress", blocked: "Blocked", completed: "Completed", verified: "Verified", cancelled: "Cancelled" },
    priority: { baja: "Low", media: "Medium", alta: "High", urgente: "Urgent" },
  },
  es: {
    noWork: "Sin trabajos",
    createTask: "Crear tarea operativa",
    maintenanceCategory: "Mantenimiento",
    defaultDescription: (asset?: string | null) => `Ejecutar trabajo de mantenimiento${asset ? ` sobre ${asset}` : ""} y registrar resultado.`,
    status: { draft: "Borrador", scheduled: "Programada", assigned: "Asignada", in_progress: "En ejecución", blocked: "Bloqueada", completed: "Completada", verified: "Verificada", cancelled: "Cancelada" },
    priority: { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" },
  },
  de: {
    noWork: "Keine Arbeiten",
    createTask: "Operative Aufgabe erstellen",
    maintenanceCategory: "Instandhaltung",
    defaultDescription: (asset?: string | null) => `Instandhaltungsarbeit${asset ? ` an ${asset}` : ""} ausführen und Ergebnis dokumentieren.`,
    status: { draft: "Entwurf", scheduled: "Geplant", assigned: "Zugewiesen", in_progress: "In Bearbeitung", blocked: "Blockiert", completed: "Abgeschlossen", verified: "Verifiziert", cancelled: "Storniert" },
    priority: { baja: "Niedrig", media: "Mittel", alta: "Hoch", urgente: "Dringend" },
  },
} as const
const DATE_LOCALES = { en: enUS, es, de } as const

export function MaintenanceWeekView({ tasks, onTaskClick }: MaintenanceWeekViewProps) {
  const { language } = useLanguage()
  const text = COPY[language]
  const dateLocale = DATE_LOCALES[language]
  const [currentDate, setCurrentDate] = useState(new Date())
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const taskDate = (task: WorkOrder) => task.fecha_objetivo ?? task.next_run ?? null
  const getTasksForDate = (date: Date) => tasks.filter((task) => taskDate(task)?.startsWith(format(date, "yyyy-MM-dd")))

  return <div className="space-y-4">
    <div className="flex items-center justify-between"><Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, -7))}><ChevronLeft className="h-4 w-4" /></Button><div className="text-sm font-semibold">{format(weekStart, "d MMM", { locale: dateLocale })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: dateLocale })}</div><Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-4 w-4" /></Button></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">{weekDays.map((date) => { const dayTasks = getTasksForDate(date); const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"); return <Card key={format(date, "yyyy-MM-dd")} className={isToday ? "border-primary" : ""}><CardHeader className="pb-2"><div className="text-xs font-semibold uppercase text-muted-foreground">{format(date, "EEE", { locale: dateLocale })}</div><div className="text-lg font-bold">{format(date, "d")}</div></CardHeader><CardContent className="space-y-2">{dayTasks.length === 0 ? <div className="py-3 text-xs text-muted-foreground">{text.noWork}</div> : dayTasks.map((task) => { const status = task.estado_extendido ?? task.status ?? "draft"; const priority = task.prioridad ?? task.priority ?? "medium"; const canonicalPriority = priorityMap[priority] || "media"; const taskHref = buildOperationalTaskHref({ area: "mantenimiento", title: task.title, description: task.description || text.defaultDescription(task.assets?.name), category: text.maintenanceCategory, priority: canonicalPriority, dueDate: taskDate(task) ?? undefined, sourceType: "maintenance_task", sourceId: task.id, sourceLabel: task.title, sourcePath: `/maintenance/${task.id}` }); return <div key={task.id} className="space-y-2 rounded-md border bg-muted/20 p-2"><Link href={`/maintenance/${task.id}`} onClick={() => onTaskClick?.(task)} className="block w-full text-left hover:underline"><div className="truncate text-xs font-medium">{task.title}</div><div className="mt-1 flex flex-wrap gap-1"><Badge variant="secondary" className="text-[10px]">{text.status[status as keyof typeof text.status] || status}</Badge><Badge variant="outline" className="text-[10px]">{text.priority[canonicalPriority]}</Badge></div></Link><LinkedOperationalTask sourceType="maintenance_task" sourceId={task.id} compact /><Button asChild variant="ghost" size="sm" className="h-7 w-full px-2 text-xs"><Link href={taskHref}><ClipboardPlus className="mr-1 h-3.5 w-3.5" />{text.createTask}</Link></Button></div> })}</CardContent></Card> })}</div>
  </div>
}

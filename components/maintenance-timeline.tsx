"use client"

import { format, parseISO, isPast, isToday } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Clock3, Wrench } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

type MaintTask = {
  id: string
  bed_id: string | null
  maintenance_type: string | null
  scheduled_date: string | null
  duration_minutes: number | null
  priority: number | null
  status: string | null
  notes: string | null
  bed?: { bed_number: string; room?: { room_number: string; location: string | null } | null } | null
}

const COPY = {
  en: { low: "Low", normal: "Normal", high: "High", urgent: "Urgent", pending: "Pending", progress: "In progress", completed: "Completed", cancelled: "Cancelled", empty: "No maintenance tasks scheduled.", room: "Room", bed: "Bed", overdue: "Overdue", priority: "Priority", markReady: "Mark complete" },
  es: { low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente", pending: "Pendiente", progress: "En progreso", completed: "Completada", cancelled: "Cancelada", empty: "Sin tareas de mantenimiento programadas.", room: "Habitación", bed: "Cama", overdue: "Venció", priority: "Prioridad", markReady: "Marcar lista" },
  de: { low: "Niedrig", normal: "Normal", high: "Hoch", urgent: "Dringend", pending: "Ausstehend", progress: "In Bearbeitung", completed: "Abgeschlossen", cancelled: "Storniert", empty: "Keine Instandhaltungsaufgaben geplant.", room: "Zimmer", bed: "Bett", overdue: "Überfällig", priority: "Priorität", markReady: "Als abgeschlossen markieren" },
} as const

function overdue(task: MaintTask): boolean {
  if (!task.scheduled_date || task.status === "completed" || task.status === "cancelled") return false
  const d = parseISO(task.scheduled_date)
  return isPast(d) && !isToday(d)
}

export function MaintenanceTimeline({ tasks, onStatusChange }: { tasks: MaintTask[]; onStatusChange?: (id: string, status: string) => void }) {
  const { language } = useLanguage()
  const copy = COPY[language]
  const dateLocale = language === "de" ? de : language === "es" ? es : enUS
  const priorityConfig: Record<number, { label: string; color: string }> = {
    1: { label: copy.low, color: "text-muted-foreground" },
    2: { label: copy.normal, color: "text-blue-500" },
    3: { label: copy.high, color: "text-amber-500" },
    4: { label: copy.urgent, color: "text-rose-500" },
  }
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: copy.pending, variant: "secondary" },
    in_progress: { label: copy.progress, variant: "outline" },
    completed: { label: copy.completed, variant: "default" },
    cancelled: { label: copy.cancelled, variant: "destructive" },
  }

  if (tasks.length === 0) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{copy.empty}</p>

  const sorted = [...tasks].sort((a, b) => {
    const oa = overdue(a) ? 0 : 1
    const ob = overdue(b) ? 0 : 1
    if (oa !== ob) return oa - ob
    const da = a.scheduled_date ?? ""
    const db = b.scheduled_date ?? ""
    if (da !== db) return da.localeCompare(db)
    return (b.priority ?? 1) - (a.priority ?? 1)
  })

  return <div className="space-y-2">{sorted.map((task) => {
    const pCfg = priorityConfig[task.priority ?? 1] ?? priorityConfig[1]
    const sCfg = statusConfig[task.status ?? "pending"] ?? statusConfig.pending
    const isOv = overdue(task)
    const bedNum = task.bed?.bed_number ?? task.bed_id?.substring(0, 8) ?? "—"
    const roomNum = task.bed?.room?.room_number ?? ""
    const location = task.bed?.room?.location ?? ""
    const typeLabel = (task.maintenance_type ?? "general").replaceAll("_", " ")
    return <div key={task.id} className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${isOv ? "border-rose-500/40 bg-rose-500/5" : "bg-card"}`}>
      <div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 shrink-0">{isOv ? <AlertCircle className="h-4 w-4 text-rose-500" /> : task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : task.status === "in_progress" ? <Clock3 className="h-4 w-4 text-amber-500" /> : <Wrench className="h-4 w-4 text-muted-foreground" />}</div><div className="min-w-0"><p className="text-sm font-medium capitalize">{typeLabel}</p>{roomNum && <p className="text-xs text-muted-foreground">{copy.room} {roomNum} — {copy.bed} {bedNum}{location ? ` · ${location}` : ""}</p>}<div className="mt-1 flex flex-wrap items-center gap-2 text-xs">{task.scheduled_date && <span className={isOv ? "font-medium text-rose-500" : "text-muted-foreground"}>{isOv ? `${copy.overdue} ` : ""}{format(parseISO(task.scheduled_date), "d MMM yyyy", { locale: dateLocale })}</span>}{task.duration_minutes && <span className="text-muted-foreground">{task.duration_minutes} min</span>}<span className={`font-medium ${pCfg.color}`}>{copy.priority} {pCfg.label}</span></div>{task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}</div></div>
      <div className="flex shrink-0 items-center gap-2"><Badge variant={sCfg.variant}>{sCfg.label}</Badge>{onStatusChange && task.status !== "completed" && task.status !== "cancelled" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onStatusChange(task.id, "completed")}>{copy.markReady}</Button>}</div>
    </div>
  })}</div>
}

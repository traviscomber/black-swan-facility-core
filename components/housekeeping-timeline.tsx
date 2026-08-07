"use client"

import { format, parseISO, isToday, isTomorrow, startOfDay } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock3, AlertCircle, User } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

type HKTask = {
  id: string
  bed_id: string | null
  checkout_reservation_id: string | null
  checkout_time: string | null
  cleaning_duration_minutes: number | null
  assigned_staff_id: string | null
  status: string | null
  notes: string | null
  created_at: string | null
  bed?: { bed_number: string; room?: { room_number: string; location: string | null } | null } | null
  reservation?: { guest_name: string; check_out: string } | null
}

const COPY = {
  en: { pending: "Pending", progress: "In progress", completed: "Completed", skipped: "Skipped", noDate: "No date", today: "Today", tomorrow: "Tomorrow", empty: "No housekeeping tasks scheduled.", room: "Room", bed: "Bed", departure: "Departure", estimated: "min estimated", markReady: "Mark ready" },
  es: { pending: "Pendiente", progress: "En progreso", completed: "Completada", skipped: "Omitida", noDate: "Sin fecha", today: "Hoy", tomorrow: "Mañana", empty: "Sin tareas de housekeeping programadas.", room: "Habitación", bed: "Cama", departure: "Salida", estimated: "min estimados", markReady: "Marcar lista" },
  de: { pending: "Ausstehend", progress: "In Bearbeitung", completed: "Abgeschlossen", skipped: "Übersprungen", noDate: "Ohne Datum", today: "Heute", tomorrow: "Morgen", empty: "Keine Housekeeping-Aufgaben geplant.", room: "Zimmer", bed: "Bett", departure: "Abreise", estimated: "Min. geschätzt", markReady: "Als bereit markieren" },
} as const

export function HousekeepingTimeline({ tasks, onStatusChange }: { tasks: HKTask[]; onStatusChange?: (id: string, status: string) => void }) {
  const { language } = useLanguage()
  const copy = COPY[language]
  const dateLocale = language === "de" ? de : language === "es" ? es : enUS
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: copy.pending, variant: "secondary" },
    in_progress: { label: copy.progress, variant: "outline" },
    completed: { label: copy.completed, variant: "default" },
    skipped: { label: copy.skipped, variant: "destructive" },
  }

  function dayLabel(dateStr: string | null): string {
    if (!dateStr) return copy.noDate
    const d = parseISO(dateStr)
    if (isToday(d)) return copy.today
    if (isTomorrow(d)) return copy.tomorrow
    return format(d, "EEEE d MMM", { locale: dateLocale })
  }

  if (tasks.length === 0) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{copy.empty}</p>

  const groups = tasks.reduce<Record<string, HKTask[]>>((acc, task) => {
    const key = task.checkout_time ? startOfDay(parseISO(task.checkout_time)).toISOString() : "no-date"
    ;(acc[key] ??= []).push(task)
    return acc
  }, {})

  return <div className="space-y-6">{Object.keys(groups).sort().map((key) => <div key={key}>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{key === "no-date" ? copy.noDate : dayLabel(groups[key][0].checkout_time)}</p>
    <div className="space-y-2">{groups[key].map((task) => {
      const cfg = statusConfig[task.status ?? "pending"] ?? statusConfig.pending
      const bedNum = task.bed?.bed_number ?? task.bed_id?.substring(0, 8) ?? "—"
      const roomNum = task.bed?.room?.room_number ?? ""
      const location = task.bed?.room?.location ?? ""
      const guest = task.reservation?.guest_name ?? null
      return <div key={task.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 shrink-0">{task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : task.status === "in_progress" ? <Clock3 className="h-4 w-4 text-amber-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}</div><div className="min-w-0"><p className="text-sm font-medium">{roomNum ? `${copy.room} ${roomNum}` : copy.bed} — {copy.bed} {bedNum}</p>{location && <p className="text-xs text-muted-foreground">{location}</p>}{guest && <p className="text-xs text-muted-foreground">{copy.departure}: <span className="text-foreground">{guest}</span></p>}{task.cleaning_duration_minutes && <p className="text-xs text-muted-foreground">{task.cleaning_duration_minutes} {copy.estimated}</p>}{task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}</div></div>
        <div className="flex shrink-0 items-center gap-2">{task.assigned_staff_id && <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" />{task.assigned_staff_id.substring(0, 8)}</span>}<Badge variant={cfg.variant}>{cfg.label}</Badge>{onStatusChange && task.status !== "completed" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onStatusChange(task.id, "completed")}>{copy.markReady}</Button>}</div>
      </div>
    })}</div>
  </div>)}</div>
}

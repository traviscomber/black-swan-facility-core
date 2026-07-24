"use client"

import { format, parseISO, isToday, isTomorrow, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock3, AlertCircle, User } from "lucide-react"

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
  // joined
  bed?: { bed_number: string; room?: { room_number: string; location: string | null } | null } | null
  reservation?: { guest_name: string; check_out: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:     { label: "Pendiente",    variant: "secondary" },
  in_progress: { label: "En progreso",  variant: "outline" },
  completed:   { label: "Completada",   variant: "default" },
  skipped:     { label: "Omitida",      variant: "destructive" },
}

function dayLabel(dateStr: string | null): string {
  if (!dateStr) return "Sin fecha"
  const d = parseISO(dateStr)
  if (isToday(d))    return "Hoy"
  if (isTomorrow(d)) return "Manana"
  return format(d, "EEEE d MMM", { locale: es })
}

export function HousekeepingTimeline({
  tasks,
  onStatusChange,
}: {
  tasks: HKTask[]
  onStatusChange?: (id: string, status: string) => void
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin tareas de housekeeping programadas.
      </p>
    )
  }

  // Group by checkout_time date
  const groups = tasks.reduce<Record<string, HKTask[]>>((acc, task) => {
    const key = task.checkout_time
      ? startOfDay(parseISO(task.checkout_time)).toISOString()
      : "sin-fecha"
    ;(acc[key] ??= []).push(task)
    return acc
  }, {})

  const sortedKeys = Object.keys(groups).sort()

  return (
    <div className="space-y-6">
      {sortedKeys.map((key) => (
        <div key={key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {key === "sin-fecha" ? "Sin fecha" : dayLabel(groups[key][0].checkout_time)}
          </p>
          <div className="space-y-2">
            {groups[key].map((task) => {
              const cfg = STATUS_CONFIG[task.status ?? "pending"] ?? STATUS_CONFIG.pending
              const bedNum   = task.bed?.bed_number  ?? task.bed_id?.substring(0, 8) ?? "—"
              const roomNum  = task.bed?.room?.room_number ?? ""
              const location = task.bed?.room?.location ?? ""
              const guest    = task.reservation?.guest_name ?? null

              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {task.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : task.status === "in_progress" ? (
                        <Clock3 className="h-4 w-4 text-amber-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {roomNum ? `Habitacion ${roomNum}` : "Cama"} — Cama {bedNum}
                      </p>
                      {location && (
                        <p className="text-xs text-muted-foreground">{location}</p>
                      )}
                      {guest && (
                        <p className="text-xs text-muted-foreground">
                          Salida: <span className="text-foreground">{guest}</span>
                        </p>
                      )}
                      {task.cleaning_duration_minutes && (
                        <p className="text-xs text-muted-foreground">
                          {task.cleaning_duration_minutes} min estimados
                        </p>
                      )}
                      {task.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.assigned_staff_id && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {task.assigned_staff_id.substring(0, 8)}
                      </span>
                    )}
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    {onStatusChange && task.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => onStatusChange(task.id, "completed")}
                      >
                        Marcar lista
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

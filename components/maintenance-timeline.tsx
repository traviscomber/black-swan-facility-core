"use client"

import { format, parseISO, isPast, isToday } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Clock3, Wrench } from "lucide-react"

type MaintTask = {
  id: string
  bed_id: string | null
  maintenance_type: string | null
  scheduled_date: string | null
  duration_minutes: number | null
  priority: number | null
  status: string | null
  notes: string | null
  // joined
  bed?: { bed_number: string; room?: { room_number: string; location: string | null } | null } | null
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: "Baja",     color: "text-muted-foreground" },
  2: { label: "Normal",   color: "text-blue-500" },
  3: { label: "Alta",     color: "text-amber-500" },
  4: { label: "Urgente",  color: "text-rose-500" },
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:     { label: "Pendiente",   variant: "secondary" },
  in_progress: { label: "En progreso", variant: "outline" },
  completed:   { label: "Completada",  variant: "default" },
  cancelled:   { label: "Cancelada",   variant: "destructive" },
}

function overdue(task: MaintTask): boolean {
  if (!task.scheduled_date || task.status === "completed" || task.status === "cancelled") return false
  const d = parseISO(task.scheduled_date)
  return isPast(d) && !isToday(d)
}

export function MaintenanceTimeline({
  tasks,
  onStatusChange,
}: {
  tasks: MaintTask[]
  onStatusChange?: (id: string, status: string) => void
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin tareas de mantenimiento programadas.
      </p>
    )
  }

  // Sort: overdue first, then by date, then by priority desc
  const sorted = [...tasks].sort((a, b) => {
    const oa = overdue(a) ? 0 : 1
    const ob = overdue(b) ? 0 : 1
    if (oa !== ob) return oa - ob
    const da = a.scheduled_date ?? ""
    const db = b.scheduled_date ?? ""
    if (da !== db) return da.localeCompare(db)
    return (b.priority ?? 1) - (a.priority ?? 1)
  })

  return (
    <div className="space-y-2">
      {sorted.map((task) => {
        const pCfg  = PRIORITY_CONFIG[task.priority ?? 1] ?? PRIORITY_CONFIG[1]
        const sCfg  = STATUS_CONFIG[task.status ?? "pending"] ?? STATUS_CONFIG.pending
        const isOv  = overdue(task)
        const bedNum   = task.bed?.bed_number ?? task.bed_id?.substring(0, 8) ?? "—"
        const roomNum  = task.bed?.room?.room_number ?? ""
        const location = task.bed?.room?.location ?? ""
        const typeLabel = (task.maintenance_type ?? "general").replaceAll("_", " ")

        return (
          <div
            key={task.id}
            className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
              isOv ? "border-rose-500/40 bg-rose-500/5" : "bg-card"
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 shrink-0">
                {isOv ? (
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                ) : task.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : task.status === "in_progress" ? (
                  <Clock3 className="h-4 w-4 text-amber-500" />
                ) : (
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm capitalize">{typeLabel}</p>
                {roomNum && (
                  <p className="text-xs text-muted-foreground">
                    Habitacion {roomNum} — Cama {bedNum}
                    {location ? ` · ${location}` : ""}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {task.scheduled_date && (
                    <span className={`${isOv ? "text-rose-500 font-medium" : "text-muted-foreground"}`}>
                      {isOv ? "Vencio " : ""}
                      {format(parseISO(task.scheduled_date), "d MMM yyyy", { locale: es })}
                    </span>
                  )}
                  {task.duration_minutes && (
                    <span className="text-muted-foreground">{task.duration_minutes} min</span>
                  )}
                  <span className={`font-medium ${pCfg.color}`}>
                    Prioridad {pCfg.label}
                  </span>
                </div>
                {task.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={sCfg.variant}>{sCfg.label}</Badge>
              {onStatusChange && task.status !== "completed" && task.status !== "cancelled" && (
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
  )
}

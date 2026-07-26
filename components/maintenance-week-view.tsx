"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronLeft, ChevronRight, ClipboardPlus } from "lucide-react"
import { format, addDays, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { buildOperationalTaskHref } from "@/lib/operational-task-links"

interface WorkOrder {
  id: string
  title: string
  description?: string | null
  status?: string | null
  estado_extendido?: string | null
  priority?: string | null
  prioridad?: string | null
  assigned_to?: string | null
  next_run?: string | null
  fecha_objetivo?: string | null
  assets?: { name?: string | null } | null
}

interface MaintenanceWeekViewProps {
  tasks: WorkOrder[]
  onTaskClick?: (task: WorkOrder) => void
}

const statusLabels: Record<string, string> = { draft: "Borrador", scheduled: "Programada", assigned: "Asignada", in_progress: "En ejecución", blocked: "Bloqueada", completed: "Completada", verified: "Verificada", cancelled: "Cancelada" }
const priorityMap: Record<string, "baja" | "media" | "alta" | "urgente"> = { low: "baja", medium: "media", high: "alta", critical: "urgente", baja: "baja", media: "media", alta: "alta", urgente: "urgente" }

export function MaintenanceWeekView({ tasks, onTaskClick }: MaintenanceWeekViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  function taskDate(task: WorkOrder) {
    return task.fecha_objetivo ?? task.next_run ?? null
  }

  function getTasksForDate(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd")
    return tasks.filter((task) => taskDate(task)?.startsWith(dateStr))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, -7))}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-sm font-semibold">{format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}</div>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {weekDays.map((date) => {
          const dayTasks = getTasksForDate(date)
          const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
          return <Card key={format(date, "yyyy-MM-dd")} className={isToday ? "border-primary" : ""}>
            <CardHeader className="pb-2"><div className="text-xs font-semibold uppercase text-muted-foreground">{format(date, "EEE", { locale: es })}</div><div className="text-lg font-bold">{format(date, "d")}</div></CardHeader>
            <CardContent className="space-y-2">
              {dayTasks.length === 0 ? <div className="py-3 text-xs text-muted-foreground">Sin trabajos</div> : dayTasks.map((task) => {
                const status = task.estado_extendido ?? task.status ?? "draft"
                const priority = task.prioridad ?? task.priority ?? "medium"
                const taskHref = buildOperationalTaskHref({
                  area: "mantenimiento",
                  title: task.title,
                  description: task.description || `Ejecutar trabajo de mantenimiento${task.assets?.name ? ` sobre ${task.assets.name}` : ""} y registrar resultado.`,
                  category: "Mantenimiento",
                  priority: priorityMap[priority] || "media",
                  dueDate: taskDate(task) ?? undefined,
                  sourceType: "maintenance_task",
                  sourceId: task.id,
                  sourceLabel: task.title,
                  sourcePath: "/maintenance",
                })
                return <div key={task.id} className="rounded-md border bg-muted/20 p-2">
                  <button type="button" onClick={() => onTaskClick?.(task)} className="w-full text-left"><div className="truncate text-xs font-medium">{task.title}</div><div className="mt-1 flex flex-wrap gap-1"><Badge variant="secondary" className="text-[10px]">{statusLabels[status] || status}</Badge><Badge variant="outline" className="text-[10px]">{priorityMap[priority] || priority}</Badge></div></button>
                  <Button asChild variant="ghost" size="sm" className="mt-2 h-7 w-full px-2 text-xs"><Link href={taskHref}><ClipboardPlus className="mr-1 h-3.5 w-3.5" />Crear tarea operativa</Link></Button>
                </div>
              })}
            </CardContent>
          </Card>
        })}
      </div>
    </div>
  )
}

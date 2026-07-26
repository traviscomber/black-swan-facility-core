"use client"

import { useMemo, useState } from "react"
import { Calendar, MapPin, Pencil, Users, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type Task = {
  id: string
  title: string
  description?: string | null
  priority: "baja" | "media" | "alta" | "urgente"
  status: TaskStatus
  due_date?: string | null
  location_name?: string | null
  created_at: string
  task_assignments: Array<{ employee_id: string; employees?: { id: string; name: string; email?: string | null } | null }>
}

const statusLabels: Record<TaskStatus, string> = { nueva: "Pendiente", en_progreso: "En curso", completada: "Completada", cancelada: "Cancelada" }
const priorityLabels = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" }

export function TaskDetailPanel({ task, onUpdate, onClose, onEdit }: { task: Task; onUpdate: () => void; onClose: () => void; onEdit: (task: Task) => void }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [saving, setSaving] = useState(false)

  async function saveStatus() {
    if (status === task.status) return
    setSaving(true)
    const { error } = await supabase.from("tasks").update({ status, completed_at: status === "completada" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", task.id)
    if (error) {
      toast({ title: "No fue posible actualizar el estado", description: error.message, variant: "destructive" })
      setSaving(false)
      return
    }
    await supabase.from("task_status_history").insert({ task_id: task.id, old_status: task.status, new_status: status })
    toast({ title: "Estado actualizado", description: `${task.title}: ${statusLabels[status]}` })
    setSaving(false)
    onUpdate()
  }

  return <div className="space-y-5 p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Detalle de tarea</p><h2 className="mt-1 text-xl font-semibold">{task.title}</h2></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => onEdit(task)} aria-label="Editar tarea"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar detalle"><X className="h-4 w-4" /></Button></div></div>
    <div className="flex flex-wrap gap-2"><Badge variant="outline">{statusLabels[task.status]}</Badge><Badge variant="outline">Prioridad {priorityLabels[task.priority]}</Badge></div>
    <Card><CardHeader><CardTitle className="text-base">Información</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{task.description && <p className="text-muted-foreground">{task.description}</p>}{task.due_date && <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{format(parseISO(task.due_date), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>}{task.location_name && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{task.location_name}</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Responsables</CardTitle></CardHeader><CardContent>{task.task_assignments.length === 0 ? <p className="text-sm text-muted-foreground">Sin responsables asignados.</p> : <ul className="space-y-2">{task.task_assignments.map((assignment) => <li key={assignment.employee_id} className="text-sm"><span className="font-medium">{assignment.employees?.name ?? "Persona no disponible"}</span>{assignment.employees?.email && <span className="ml-2 text-muted-foreground">{assignment.employees.email}</span>}</li>)}</ul>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Actualizar estado</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nueva">Pendiente</SelectItem><SelectItem value="en_progreso">En curso</SelectItem><SelectItem value="completada">Completada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select><Button className="w-full" onClick={saveStatus} disabled={saving || status === task.status}>{saving ? "Guardando…" : "Guardar estado"}</Button><p className="text-xs text-muted-foreground">Las tareas se completan o cancelan para conservar su historial. No se eliminan desde esta vista.</p></CardContent></Card>
  </div>
}

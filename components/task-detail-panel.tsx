"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, Clock, MapPin, Pencil, Users, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { operationalAreaLabels, type OperationalArea } from "@/lib/operational-task-templates"

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
  operational_area?: OperationalArea | null
  task_category?: string | null
  estimated_minutes?: number | null
  animal_handling?: boolean
  safety_notes?: string | null
  task_assignments: Array<{
    employee_id?: string | null
    volunteer_id?: string | null
    employees?: { id: string; name: string; email?: string | null } | null
    volunteers?: { id: string; name: string; email?: string | null; volunteer_role?: string | null } | null
  }>
}

const statusLabels: Record<TaskStatus, string> = { nueva: "Pendiente", en_progreso: "En curso", completada: "Completada", cancelada: "Cancelada" }
const priorityLabels = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" }

export function TaskDetailPanel({ task, onUpdate, onClose, onEdit }: { task: Task; onUpdate: () => void; onClose: () => void; onEdit: (task: Task) => void }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [saving, setSaving] = useState(false)

  useEffect(() => setStatus(task.status), [task.status])

  async function saveStatus() {
    if (status === task.status) return
    setSaving(true)
    const employeeIds = task.task_assignments.map((item) => item.employee_id).filter(Boolean) as string[]
    const volunteerIds = task.task_assignments.map((item) => item.volunteer_id).filter(Boolean) as string[]
    const { error } = await supabase.rpc("update_operational_task_atomic", {
      p_task_id: task.id,
      p_title: task.title,
      p_description: task.description ?? null,
      p_priority: task.priority,
      p_status: status,
      p_due_date: task.due_date ?? null,
      p_location_id: null,
      p_location_name: task.location_name ?? null,
      p_latitude: null,
      p_longitude: null,
      p_operational_area: task.operational_area ?? null,
      p_task_category: task.task_category ?? null,
      p_estimated_minutes: task.estimated_minutes ?? null,
      p_animal_handling: Boolean(task.animal_handling),
      p_safety_notes: task.safety_notes ?? null,
      p_employee_ids: employeeIds,
      p_volunteer_ids: volunteerIds,
    })
    if (error) {
      toast({ title: "No fue posible actualizar el estado", description: error.message, variant: "destructive" })
      setSaving(false)
      return
    }
    toast({ title: "Estado actualizado", description: `${task.title}: ${statusLabels[status]}` })
    setSaving(false)
    onUpdate()
  }

  return <div className="space-y-5 p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Detalle de tarea</p><h2 className="mt-1 text-xl font-semibold">{task.title}</h2></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => onEdit(task)} aria-label="Editar tarea"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar detalle"><X className="h-4 w-4" /></Button></div></div>
    <div className="flex flex-wrap gap-2"><Badge variant="outline">{statusLabels[task.status]}</Badge><Badge variant="outline">Prioridad {priorityLabels[task.priority]}</Badge>{task.operational_area && <Badge variant="secondary">{operationalAreaLabels[task.operational_area]}</Badge>}{task.task_category && <Badge variant="outline">{task.task_category}</Badge>}{task.animal_handling && <Badge variant="outline" className="border-amber-400 text-amber-700">Manejo animal</Badge>}</div>
    <Card><CardHeader><CardTitle className="text-base">Información</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{task.description && <p className="text-muted-foreground">{task.description}</p>}{task.due_date && <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{format(parseISO(task.due_date), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>}{task.location_name && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{task.location_name}</p>}{task.estimated_minutes && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Duración estimada: {task.estimated_minutes} minutos</p>}</CardContent></Card>
    {(task.animal_handling || task.safety_notes) && <Card className="border-amber-400/50"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />Seguridad</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{task.safety_notes || "Esta tarea requiere manejo o cercanía con animales y debe realizarse bajo instrucciones del responsable del área."}</CardContent></Card>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Responsables</CardTitle></CardHeader><CardContent>{task.task_assignments.length === 0 ? <p className="text-sm text-muted-foreground">Sin responsables asignados.</p> : <ul className="space-y-2">{task.task_assignments.map((assignment, index) => { const person = assignment.employees ?? assignment.volunteers; const kind = assignment.volunteer_id ? "Voluntario" : "Trabajador"; return <li key={assignment.employee_id ?? assignment.volunteer_id ?? index} className="flex items-start justify-between gap-3 text-sm"><span><span className="font-medium">{person?.name ?? "Persona no disponible"}</span>{person?.email && <span className="ml-2 text-muted-foreground">{person.email}</span>}</span><Badge variant="outline">{kind}</Badge></li> })}</ul>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Actualizar estado</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nueva">Pendiente</SelectItem><SelectItem value="en_progreso">En curso</SelectItem><SelectItem value="completada">Completada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select><Button className="w-full" onClick={saveStatus} disabled={saving || status === task.status}>{saving ? "Guardando…" : "Guardar estado"}</Button><p className="text-xs text-muted-foreground">Las tareas se completan o cancelan para conservar trazabilidad. No se eliminan desde esta vista.</p></CardContent></Card>
  </div>
}

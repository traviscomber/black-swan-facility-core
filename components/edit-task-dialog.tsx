"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type TaskPriority = "baja" | "media" | "alta" | "urgente"
type Employee = { id: string; name: string; role?: string | null }
type Location = { id: string; name: string; latitude?: number | null; longitude?: number | null }

type EditableTask = {
  id: string
  title: string
  description?: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date?: string | null
  location_name?: string | null
  location_id?: string | null
  latitude?: number | null
  longitude?: number | null
  task_assignments: Array<{ employee_id: string }>
}

export function EditTaskDialog({ open, onOpenChange, onTaskUpdated, task }: { open: boolean; onOpenChange: (open: boolean) => void; onTaskUpdated: () => void; task: EditableTask }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [dueDate, setDueDate] = useState(task.due_date ?? "")
  const [locationId, setLocationId] = useState(task.location_id ?? "")
  const [employeeIds, setEmployeeIds] = useState(task.task_assignments.map((assignment) => assignment.employee_id))
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(task.title)
    setDescription(task.description ?? "")
    setPriority(task.priority)
    setStatus(task.status)
    setDueDate(task.due_date ?? "")
    setLocationId(task.location_id ?? "")
    setEmployeeIds(task.task_assignments.map((assignment) => assignment.employee_id))
    setError(null)
    void Promise.all([
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("locations").select("id, name, latitude, longitude").eq("is_active", true).order("name"),
    ]).then(([employeeResult, locationResult]) => {
      if (!employeeResult.error) setEmployees((employeeResult.data ?? []) as Employee[])
      if (!locationResult.error) setLocations((locationResult.data ?? []) as Location[])
    })
  }, [open, task, supabase])

  function toggleEmployee(employeeId: string) {
    setEmployeeIds((current) => current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId])
  }

  async function handleSubmit() {
    const cleanTitle = title.trim()
    if (!cleanTitle) return setError("El título es obligatorio.")
    if (employeeIds.length === 0) return setError("Selecciona al menos una persona responsable.")

    setIsSubmitting(true)
    setError(null)
    const location = locations.find((item) => item.id === locationId)
    const completedAt = status === "completada" ? new Date().toISOString() : null
    const { error: taskError } = await supabase.from("tasks").update({
      title: cleanTitle,
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
      location_id: location?.id ?? null,
      location_name: location?.name ?? null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id)

    if (taskError) {
      setError(`No fue posible actualizar la tarea: ${taskError.message}`)
      setIsSubmitting(false)
      return
    }

    const { error: deleteError } = await supabase.from("task_assignments").delete().eq("task_id", task.id)
    if (deleteError) {
      setError(`La tarea se actualizó, pero no fue posible renovar responsables: ${deleteError.message}`)
      setIsSubmitting(false)
      return
    }

    const { error: assignmentError } = await supabase.from("task_assignments").insert(employeeIds.map((employeeId) => ({ task_id: task.id, employee_id: employeeId })))
    if (assignmentError) {
      setError(`No fue posible guardar los responsables: ${assignmentError.message}`)
      setIsSubmitting(false)
      return
    }

    if (status !== task.status) await supabase.from("task_status_history").insert({ task_id: task.id, old_status: task.status, new_status: status })
    toast({ title: "Tarea actualizada", description: cleanTitle })
    setIsSubmitting(false)
    onTaskUpdated()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Editar tarea</DialogTitle><DialogDescription>Actualiza trabajo, estado, responsables y fecha objetivo.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-2"><Label htmlFor="edit-task-title">Trabajo a realizar *</Label><Input id="edit-task-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="edit-task-description">Indicaciones</Label><Textarea id="edit-task-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Prioridad</Label><Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Estado</Label><Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nueva">Pendiente</SelectItem><SelectItem value="en_progreso">En curso</SelectItem><SelectItem value="completada">Completada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="edit-task-date">Fecha objetivo</Label><Input id="edit-task-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div className="space-y-2"><Label>Lugar</Label><Select value={locationId || "none"} onValueChange={(value) => setLocationId(value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin ubicación específica</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="space-y-2"><Label>Responsables *</Label><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">{employees.map((employee) => <label key={employee.id} htmlFor={`edit-task-${employee.id}`} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"><Checkbox id={`edit-task-${employee.id}`} checked={employeeIds.includes(employee.id)} onCheckedChange={() => toggleEmployee(employee.id)} /><span><span className="block text-sm font-medium">{employee.name.trim()}</span>{employee.role && <span className="block text-xs text-muted-foreground">{employee.role.trim()}</span>}</span></label>)}</div></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

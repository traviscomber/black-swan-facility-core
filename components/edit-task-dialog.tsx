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
import { operationalAreaLabels, type OperationalArea } from "@/lib/operational-task-templates"

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type TaskPriority = "baja" | "media" | "alta" | "urgente"
type Employee = { id: string; name: string; role?: string | null }
type Volunteer = { id: string; name: string; volunteer_role?: string | null }
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
  operational_area?: OperationalArea | null
  task_category?: string | null
  estimated_minutes?: number | null
  animal_handling?: boolean
  safety_notes?: string | null
  task_assignments: Array<{ employee_id?: string | null; volunteer_id?: string | null }>
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
  const [area, setArea] = useState<OperationalArea | "">(task.operational_area ?? "")
  const [category, setCategory] = useState(task.task_category ?? "")
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes ? String(task.estimated_minutes) : "")
  const [animalHandling, setAnimalHandling] = useState(Boolean(task.animal_handling))
  const [safetyNotes, setSafetyNotes] = useState(task.safety_notes ?? "")
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [volunteerIds, setVolunteerIds] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
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
    setArea(task.operational_area ?? "")
    setCategory(task.task_category ?? "")
    setEstimatedMinutes(task.estimated_minutes ? String(task.estimated_minutes) : "")
    setAnimalHandling(Boolean(task.animal_handling))
    setSafetyNotes(task.safety_notes ?? "")
    setEmployeeIds(task.task_assignments.map((assignment) => assignment.employee_id).filter(Boolean) as string[])
    setVolunteerIds(task.task_assignments.map((assignment) => assignment.volunteer_id).filter(Boolean) as string[])
    setError(null)
    void Promise.all([
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("volunteers").select("id, name, volunteer_role").eq("is_active", true).order("name"),
      supabase.from("locations").select("id, name, latitude, longitude").eq("is_active", true).order("name"),
    ]).then(([employeeResult, volunteerResult, locationResult]) => {
      if (!employeeResult.error) setEmployees((employeeResult.data ?? []) as Employee[])
      if (!volunteerResult.error) setVolunteers((volunteerResult.data ?? []) as Volunteer[])
      if (!locationResult.error) setLocations((locationResult.data ?? []) as Location[])
    })
  }, [open, task, supabase])

  function toggle(list: string[], id: string, setter: (value: string[]) => void) {
    setter(list.includes(id) ? list.filter((current) => current !== id) : [...list, id])
  }

  async function handleSubmit() {
    const cleanTitle = title.trim()
    if (!cleanTitle) return setError("El título es obligatorio.")
    if (employeeIds.length + volunteerIds.length === 0) return setError("Selecciona al menos una persona responsable.")

    setIsSubmitting(true)
    setError(null)
    const location = locations.find((item) => item.id === locationId)
    const { error: rpcError } = await supabase.rpc("update_operational_task_atomic", {
      p_task_id: task.id,
      p_title: cleanTitle,
      p_description: description.trim() || null,
      p_priority: priority,
      p_status: status,
      p_due_date: dueDate || null,
      p_location_id: location?.id ?? null,
      p_location_name: location?.name ?? task.location_name ?? null,
      p_latitude: location?.latitude ?? task.latitude ?? null,
      p_longitude: location?.longitude ?? task.longitude ?? null,
      p_operational_area: area || null,
      p_task_category: category.trim() || null,
      p_estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      p_animal_handling: animalHandling,
      p_safety_notes: safetyNotes.trim() || null,
      p_employee_ids: employeeIds,
      p_volunteer_ids: volunteerIds,
    })

    if (rpcError) {
      setError(`No fue posible actualizar la tarea: ${rpcError.message}`)
      setIsSubmitting(false)
      return
    }

    toast({ title: "Tarea actualizada", description: cleanTitle })
    setIsSubmitting(false)
    onTaskUpdated()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Editar tarea operativa</DialogTitle><DialogDescription>Actualiza área, seguridad, responsables, estado y fecha objetivo.</DialogDescription></DialogHeader>
        <div className="space-y-5 py-2">
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-2"><Label>Trabajo a realizar *</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div className="space-y-2"><Label>Indicaciones</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Área</Label><Select value={area || "none"} onValueChange={(value) => setArea(value === "none" ? "" : value as OperationalArea)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin área</SelectItem>{Object.entries(operationalAreaLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Categoría</Label><Input value={category} onChange={(event) => setCategory(event.target.value)} /></div>
            <div className="space-y-2"><Label>Duración estimada</Label><Input type="number" min="5" max="1440" step="5" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} placeholder="Minutos" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Prioridad</Label><Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Estado</Label><Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nueva">Pendiente</SelectItem><SelectItem value="en_progreso">En curso</SelectItem><SelectItem value="completada">Completada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Fecha objetivo</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div className="space-y-2"><Label>Lugar</Label><Select value={locationId || "none"} onValueChange={(value) => setLocationId(value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin ubicación específica</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="rounded-lg border p-4"><label className="flex items-start gap-3"><Checkbox checked={animalHandling} onCheckedChange={(checked) => setAnimalHandling(Boolean(checked))} /><span><span className="block text-sm font-medium">Incluye manejo o cercanía con animales</span><span className="block text-xs text-muted-foreground">Debe incluir instrucciones de seguridad y supervisión.</span></span></label>{(animalHandling || safetyNotes) && <div className="mt-3 space-y-2"><Label>Indicaciones de seguridad</Label><Textarea value={safetyNotes} onChange={(event) => setSafetyNotes(event.target.value)} rows={3} /></div>}</div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AssigneeList title="Trabajadores" items={employees.map((item) => ({ id: item.id, name: item.name, subtitle: item.role }))} selected={employeeIds} onToggle={(id) => toggle(employeeIds, id, setEmployeeIds)} />
            <AssigneeList title="Voluntarios" items={volunteers.map((item) => ({ id: item.id, name: item.name, subtitle: item.volunteer_role }))} selected={volunteerIds} onToggle={(id) => toggle(volunteerIds, id, setVolunteerIds)} />
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssigneeList({ title, items, selected, onToggle }: { title: string; items: Array<{ id: string; name: string; subtitle?: string | null }>; selected: string[]; onToggle: (id: string) => void }) {
  return <div className="space-y-2"><Label>{title}</Label><div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">{items.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Sin personas activas.</p> : items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"><Checkbox checked={selected.includes(item.id)} onCheckedChange={() => onToggle(item.id)} /><span><span className="block text-sm font-medium">{item.name.trim()}</span>{item.subtitle && <span className="block text-xs text-muted-foreground">{item.subtitle.trim()}</span>}</span></label>)}</div></div>
}

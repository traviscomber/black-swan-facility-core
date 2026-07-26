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

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskCreated: () => void
}

type Employee = { id: string; name: string; role?: string | null }
type Location = { id: string; name: string; latitude?: number | null; longitude?: number | null }
type Priority = "baja" | "media" | "alta" | "urgente"

export function AddTaskDialog({ open, onOpenChange, onTaskCreated }: AddTaskDialogProps) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Priority>("media")
  const [dueDate, setDueDate] = useState("")
  const [locationId, setLocationId] = useState("")
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    void Promise.all([
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("locations").select("id, name, latitude, longitude").eq("is_active", true).order("name"),
    ]).then(([employeeResult, locationResult]) => {
      if (!employeeResult.error) setEmployees((employeeResult.data ?? []) as Employee[])
      if (!locationResult.error) setLocations((locationResult.data ?? []) as Location[])
    })
  }, [open, supabase])

  function resetForm() {
    setTitle("")
    setDescription("")
    setPriority("media")
    setDueDate("")
    setLocationId("")
    setEmployeeIds([])
    setError(null)
  }

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
    const { data: task, error: taskError } = await supabase.from("tasks").insert({
      title: cleanTitle,
      description: description.trim() || null,
      priority,
      status: "nueva",
      due_date: dueDate || null,
      location_id: location?.id ?? null,
      location_name: location?.name ?? null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    }).select("id").single()

    if (taskError || !task) {
      setError(`No fue posible crear la tarea: ${taskError?.message ?? "respuesta incompleta"}`)
      setIsSubmitting(false)
      return
    }

    const { error: assignmentError } = await supabase.from("task_assignments").insert(employeeIds.map((employeeId) => ({ task_id: task.id, employee_id: employeeId })))
    if (assignmentError) {
      await supabase.from("tasks").delete().eq("id", task.id)
      setError(`No fue posible asignar responsables: ${assignmentError.message}`)
      setIsSubmitting(false)
      return
    }

    toast({ title: "Tarea creada", description: `${cleanTitle} quedó asignada a ${employeeIds.length} persona${employeeIds.length === 1 ? "" : "s"}.` })
    resetForm()
    setIsSubmitting(false)
    onTaskCreated()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) resetForm() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Registra solo el trabajo, responsables, lugar y fecha necesarios para coordinar la operación.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-2"><Label htmlFor="task-title">Trabajo a realizar *</Label><Input id="task-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisar bomba de agua del sector norte" /></div>
          <div className="space-y-2"><Label htmlFor="task-description">Indicaciones</Label><Textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalle breve, materiales o condición esperada" rows={3} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Prioridad</Label><Select value={priority} onValueChange={(value: Priority) => setPriority(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="task-date">Fecha objetivo</Label><Input id="task-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Lugar</Label><Select value={locationId || "none"} onValueChange={(value) => setLocationId(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Sin ubicación específica" /></SelectTrigger><SelectContent><SelectItem value="none">Sin ubicación específica</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Responsables *</Label><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">{employees.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No hay personas activas disponibles.</p> : employees.map((employee) => <label key={employee.id} htmlFor={`task-${employee.id}`} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"><Checkbox id={`task-${employee.id}`} checked={employeeIds.includes(employee.id)} onCheckedChange={() => toggleEmployee(employee.id)} /><span className="min-w-0"><span className="block text-sm font-medium">{employee.name.trim()}</span>{employee.role && <span className="block truncate text-xs text-muted-foreground">{employee.role.trim()}</span>}</span></label>)}</div><p className="text-xs text-muted-foreground">{employeeIds.length} responsable{employeeIds.length === 1 ? "" : "s"} seleccionado{employeeIds.length === 1 ? "" : "s"}</p></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Creando…" : "Crear tarea"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

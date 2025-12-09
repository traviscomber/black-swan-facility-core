"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { MapPin } from "lucide-react"

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdated: () => void
  task: {
    id: string
    title: string
    description: string
    priority: string
    status: string
    due_date: string
    location_name: string
    location_id: string
    latitude: number
    longitude: number
    task_assignments: {
      employee_id: string
    }[]
  }
}

interface Employee {
  id: string
  name: string
  email: string
  phone: string
}

interface Location {
  id: string
  name: string
  latitude: number
  longitude: number
}

export function EditTaskDialog({ open, onOpenChange, onTaskUpdated, task }: EditTaskDialogProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || "")
  const [priority, setPriority] = useState(task.priority)
  const [status, setStatus] = useState(task.status)
  const [dueDate, setDueDate] = useState(task.due_date || "")
  const [locationName, setLocationName] = useState(task.location_name || "")
  const [selectedLocationId, setSelectedLocationId] = useState<string>(task.location_id || "")
  const [coordinates, setCoordinates] = useState(
    task.latitude && task.longitude ? `${task.latitude},${task.longitude}` : "",
  )
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(task.task_assignments.map((a) => a.employee_id))
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    if (open) {
      // Reset form with task data
      setTitle(task.title)
      setDescription(task.description || "")
      setPriority(task.priority)
      setStatus(task.status)
      setDueDate(task.due_date || "")
      setLocationName(task.location_name || "")
      setSelectedLocationId(task.location_id || "")
      setCoordinates(task.latitude && task.longitude ? `${task.latitude},${task.longitude}` : "")
      setSelectedEmployees(task.task_assignments.map((a) => a.employee_id))

      fetchEmployees()
      fetchLocations()
    }
  }, [open, task])

  async function fetchEmployees() {
    const { data, error } = await supabase.from("employees").select("*").eq("is_active", true).order("name")

    if (!error && data) {
      setEmployees(data)
    }
  }

  async function fetchLocations() {
    const { data, error } = await supabase.from("locations").select("*").eq("is_active", true).order("name")

    if (!error && data) {
      setLocations(data)
    }
  }

  function handleLocationSelect(locationId: string) {
    setSelectedLocationId(locationId)
    const location = locations.find((l) => l.id === locationId)
    if (location) {
      setLocationName(location.name)
      setCoordinates(`${location.latitude},${location.longitude}`)
    }
  }

  function toggleEmployee(employeeId: string) {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId],
    )
  }

  async function handleSubmit() {
    if (!title || selectedEmployees.length === 0) {
      alert("Por favor completa el título y asigna al menos un empleado")
      return
    }

    setIsSubmitting(true)

    try {
      // Parse coordinates
      let latitude = null
      let longitude = null
      if (coordinates) {
        const [lat, lng] = coordinates.split(",").map((s) => Number.parseFloat(s.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          latitude = lat
          longitude = lng
        }
      }

      // Update task
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          title,
          description,
          priority,
          status,
          due_date: dueDate || null,
          location_name: locationName,
          location_id: selectedLocationId || null,
          latitude,
          longitude,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)

      if (taskError) throw taskError

      // Delete old assignments
      await supabase.from("task_assignments").delete().eq("task_id", task.id)

      // Create new assignments
      const assignments = selectedEmployees.map((employeeId) => ({
        task_id: task.id,
        employee_id: employeeId,
      }))

      const { error: assignmentError } = await supabase.from("task_assignments").insert(assignments)

      if (assignmentError) throw assignmentError

      onTaskUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error updating task:", error)
      alert("Error al actualizar la tarea")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Tarea</DialogTitle>
          <p className="text-sm text-muted-foreground">Actualiza los detalles de la tarea</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="ej: Llamar para cotizar campo Cholchol"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Detalles de la tarea..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nueva">Nueva</SelectItem>
                  <SelectItem value="en_progreso">En Progreso</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate">Fecha límite</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="location">Ubicación</Label>
            <Select value={selectedLocationId} onValueChange={handleLocationSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ubicación" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {location.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLocationId && (
            <>
              <div>
                <Label>Nombre de ubicación</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="ej: Campo Cholchol, Lote 45"
                />
              </div>

              <div>
                <Label>Coordenadas (lat,lng)</Label>
                <Input value={coordinates} onChange={(e) => setCoordinates(e.target.value)} placeholder="-38.5,-72.3" />
              </div>
            </>
          )}

          <div>
            <Label className="mb-3 block">Asignar a Usuarios *</Label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`edit-${employee.id}`}
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={() => toggleEmployee(employee.id)}
                  />
                  <label htmlFor={`edit-${employee.id}`} className="text-sm cursor-pointer flex-1">
                    {employee.name} ({employee.email})
                  </label>
                </div>
              ))}
            </div>
            {selectedEmployees.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedEmployees.length} usuario(s) seleccionado(s)
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Actualizando..." : "Actualizar Tarea"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

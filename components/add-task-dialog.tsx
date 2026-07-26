"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { operationalAreaLabels, operationalTaskTemplates, type OperationalArea } from "@/lib/operational-task-templates"
import type { OperationalTaskPrefill } from "@/lib/operational-task-links"

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskCreated: () => void
  prefill?: OperationalTaskPrefill | null
}

type Employee = { id: string; name: string; role?: string | null }
type Volunteer = { id: string; name: string; volunteer_role?: string | null }
type Location = { id: string; name: string; latitude?: number | null; longitude?: number | null }
type Priority = "baja" | "media" | "alta" | "urgente"

export function AddTaskDialog({ open, onOpenChange, onTaskCreated, prefill }: AddTaskDialogProps) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [templateId, setTemplateId] = useState("")
  const [area, setArea] = useState<OperationalArea | "">("")
  const [category, setCategory] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Priority>("media")
  const [dueDate, setDueDate] = useState("")
  const [locationId, setLocationId] = useState("")
  const [estimatedMinutes, setEstimatedMinutes] = useState("")
  const [animalHandling, setAnimalHandling] = useState(false)
  const [safetyNotes, setSafetyNotes] = useState("")
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [volunteerIds, setVolunteerIds] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    void Promise.all([
      supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("volunteers").select("id, name, volunteer_role").eq("is_active", true).order("name"),
      supabase.from("locations").select("id, name, latitude, longitude").eq("is_active", true).order("name"),
    ]).then(([employeeResult, volunteerResult, locationResult]) => {
      if (!employeeResult.error) setEmployees((employeeResult.data ?? []) as Employee[])
      if (!volunteerResult.error) setVolunteers((volunteerResult.data ?? []) as Volunteer[])
      if (!locationResult.error) setLocations((locationResult.data ?? []) as Location[])
    })
  }, [open, supabase])

  useEffect(() => {
    if (!open || !prefill) return
    const template = prefill.template ? operationalTaskTemplates.find((item) => item.id === prefill.template) : null
    if (template) {
      setTemplateId(template.id)
      setArea(template.area)
      setCategory(template.category)
      setTitle(template.title)
      setDescription(template.description)
      setPriority(template.priority)
      setEstimatedMinutes(String(template.estimatedMinutes))
      setAnimalHandling(Boolean(template.animalHandling))
      setSafetyNotes(template.safetyNotes ?? "")
    }
    if (prefill.area) setArea(prefill.area)
    if (prefill.category) setCategory(prefill.category)
    if (prefill.title) setTitle(prefill.title)
    if (prefill.description) setDescription(prefill.description)
    if (prefill.priority) setPriority(prefill.priority)
    if (prefill.dueDate) setDueDate(prefill.dueDate)
    if (prefill.locationId) setLocationId(prefill.locationId)
  }, [open, prefill])

  const templatesForArea = area ? operationalTaskTemplates.filter((template) => template.area === area) : operationalTaskTemplates

  function applyTemplate(value: string) {
    setTemplateId(value)
    const template = operationalTaskTemplates.find((item) => item.id === value)
    if (!template) return
    setArea(template.area)
    setCategory(template.category)
    setTitle(template.title)
    setDescription(template.description)
    setPriority(template.priority)
    setEstimatedMinutes(String(template.estimatedMinutes))
    setAnimalHandling(Boolean(template.animalHandling))
    setSafetyNotes(template.safetyNotes ?? "")
  }

  function resetForm() {
    setTemplateId("")
    setArea("")
    setCategory("")
    setTitle("")
    setDescription("")
    setPriority("media")
    setDueDate("")
    setLocationId("")
    setEstimatedMinutes("")
    setAnimalHandling(false)
    setSafetyNotes("")
    setEmployeeIds([])
    setVolunteerIds([])
    setError(null)
  }

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
    const { error: rpcError } = await supabase.rpc("create_operational_task_atomic", {
      p_title: cleanTitle,
      p_description: description.trim() || null,
      p_priority: priority,
      p_due_date: dueDate || null,
      p_location_id: location?.id ?? null,
      p_location_name: location?.name ?? null,
      p_latitude: location?.latitude ?? null,
      p_longitude: location?.longitude ?? null,
      p_operational_area: area || null,
      p_task_category: category.trim() || null,
      p_estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      p_animal_handling: animalHandling,
      p_safety_notes: safetyNotes.trim() || null,
      p_employee_ids: employeeIds,
      p_volunteer_ids: volunteerIds,
      p_source_type: prefill?.sourceType ?? null,
      p_source_id: prefill?.sourceId ?? null,
      p_source_label: prefill?.sourceLabel ?? null,
      p_source_path: prefill?.sourcePath ?? null,
    })

    if (rpcError) {
      setError(`No fue posible crear la tarea: ${rpcError.message}`)
      setIsSubmitting(false)
      return
    }

    const total = employeeIds.length + volunteerIds.length
    toast({ title: "Tarea creada", description: `${cleanTitle} quedó asignada a ${total} persona${total === 1 ? "" : "s"}.` })
    resetForm()
    setIsSubmitting(false)
    onTaskCreated()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) resetForm() }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva tarea operativa</DialogTitle>
          <DialogDescription>Asigna trabajo a trabajadores o voluntarios en ganadería, hospitalidad y las demás áreas de Black Swan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          {prefill && <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"><p className="font-medium">Origen: {prefill.sourceLabel}</p><p className="mt-1 text-muted-foreground">La tarea quedará vinculada al registro original para mantener trazabilidad.</p><Button asChild variant="link" className="mt-1 h-auto p-0"><Link href={prefill.sourcePath}><ExternalLink className="mr-1 h-3.5 w-3.5" />Abrir origen</Link></Button></div>}

          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-3 text-sm font-medium">Plantilla de trabajo habitual</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Área</Label><Select value={area || "all"} onValueChange={(value) => { setArea(value === "all" ? "" : value as OperationalArea); setTemplateId("") }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las áreas</SelectItem>{Object.entries(operationalAreaLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Trabajo sugerido</Label><Select value={templateId || "custom"} onValueChange={(value) => value === "custom" ? setTemplateId("") : applyTemplate(value)}><SelectTrigger><SelectValue placeholder="Seleccionar plantilla" /></SelectTrigger><SelectContent><SelectItem value="custom">Tarea personalizada</SelectItem>{templatesForArea.map((template) => <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>

          <div className="space-y-2"><Label htmlFor="task-title">Trabajo a realizar *</Label><Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisar bebederos del potrero norte" /></div>
          <div className="space-y-2"><Label htmlFor="task-description">Indicaciones</Label><Textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Resultado esperado, materiales y observaciones" rows={4} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Categoría</Label><Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ej. Alimentación" /></div>
            <div className="space-y-2"><Label>Prioridad</Label><Select value={priority} onValueChange={(value: Priority) => setPriority(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Duración estimada</Label><Input type="number" min="5" max="1440" step="5" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} placeholder="Minutos" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="task-date">Fecha objetivo</Label><Input id="task-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div className="space-y-2"><Label>Lugar</Label><Select value={locationId || "none"} onValueChange={(value) => setLocationId(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Sin ubicación específica" /></SelectTrigger><SelectContent><SelectItem value="none">Sin ubicación específica</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="rounded-lg border p-4"><label className="flex items-start gap-3"><Checkbox checked={animalHandling} onCheckedChange={(checked) => setAnimalHandling(Boolean(checked))} /><span><span className="block text-sm font-medium">Incluye manejo o cercanía con animales</span><span className="block text-xs text-muted-foreground">Activa advertencias y exige instrucciones de seguridad claras.</span></span></label>{(animalHandling || safetyNotes) && <div className="mt-3 space-y-2"><Label>Indicaciones de seguridad</Label><Textarea value={safetyNotes} onChange={(event) => setSafetyNotes(event.target.value)} rows={3} placeholder="Riesgos, supervisión y acciones no autorizadas" /></div>}</div>
          <div className="grid gap-4 lg:grid-cols-2"><AssigneeList title="Trabajadores" empty="No hay trabajadores activos." items={employees.map((item) => ({ id: item.id, name: item.name, subtitle: item.role }))} selected={employeeIds} onToggle={(id) => toggle(employeeIds, id, setEmployeeIds)} /><AssigneeList title="Voluntarios" empty="No hay voluntarios activos." items={volunteers.map((item) => ({ id: item.id, name: item.name, subtitle: item.volunteer_role }))} selected={volunteerIds} onToggle={(id) => toggle(volunteerIds, id, setVolunteerIds)} /></div>
          <p className="text-xs text-muted-foreground">{employeeIds.length} trabajador{employeeIds.length === 1 ? "" : "es"} y {volunteerIds.length} voluntario{volunteerIds.length === 1 ? "" : "s"} seleccionados.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Creando…" : "Crear tarea"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssigneeList({ title, empty, items, selected, onToggle }: { title: string; empty: string; items: Array<{ id: string; name: string; subtitle?: string | null }>; selected: string[]; onToggle: (id: string) => void }) {
  return <div className="space-y-2"><Label>{title}</Label><div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">{items.length === 0 ? <p className="p-2 text-sm text-muted-foreground">{empty}</p> : items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"><Checkbox checked={selected.includes(item.id)} onCheckedChange={() => onToggle(item.id)} /><span className="min-w-0"><span className="block text-sm font-medium">{item.name.trim()}</span>{item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle.trim()}</span>}</span></label>)}</div></div>
}

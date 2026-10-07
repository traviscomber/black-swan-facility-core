"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, Check, Clock3, Loader2, Pause, Play, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { operationalAreaLabels, operationalTaskTemplates, type OperationalArea, type OperationalTaskTemplate } from "@/lib/operational-task-templates"
import type { Employee } from "@/lib/types"

type RoutineArea = "hospitalidad" | "housekeeping" | "cocina"

type Routine = {
  id: string
  name: string
  task_template_id: string
  operational_area: RoutineArea
  task_category: string | null
  title: string
  description: string | null
  priority: "baja" | "media" | "alta" | "urgente"
  estimated_minutes: number | null
  employee_id: string
  location_id: string | null
  weekdays: number[]
  local_time: string
  timezone: string
  is_active: boolean
}

type Profile = {
  employee_id: string
  primary_operational_area: string | null
  secondary_operational_areas: string[] | null
  task_categories: string[] | null
  can_receive_tasks: boolean | null
}

type Location = { id: string; name: string }

const routineAreas: RoutineArea[] = ["hospitalidad", "housekeeping", "cocina"]

const dayOptions = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
]

function chileDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function candidateForArea(employee: Employee, profile: Profile | undefined, area: RoutineArea) {
  if (profile?.can_receive_tasks === false) return false
  const role = employee.role?.toLowerCase() ?? ""
  const primary = profile?.primary_operational_area?.toLowerCase() ?? ""
  const secondary = (profile?.secondary_operational_areas ?? []).map((item) => item.toLowerCase())
  const categories = (profile?.task_categories ?? []).map((item) => item.toLowerCase())

  if (area === "hospitalidad") {
    return primary === "hospitality" || primary === "hospitalidad" || secondary.some((item) => item.includes("hospital")) || role.includes("hospitality") || categories.some((item) => item.includes("hospital"))
  }
  if (area === "housekeeping") {
    return primary === "housekeeping" || secondary.includes("housekeeping") || role.includes("limpieza") || role.includes("laundry") || categories.some((item) => item.includes("clean"))
  }
  return primary === "kitchen" || secondary.includes("kitchen") || role.includes("chef") || role.includes("cocina") || role.includes("cooker") || categories.some((item) => item.includes("kitchen"))
}

function scheduleLabel(weekdays: number[]) {
  const normalized = [...weekdays].sort((a, b) => a - b)
  if (normalized.join(",") === "1,2,3,4,5") return "Lun–Vie"
  if (normalized.join(",") === "1,2,3,4,5,6,7") return "Todos los días"
  return normalized.map((value) => dayOptions.find((day) => day.value === value)?.label ?? String(value)).join(" · ")
}

function displayTime(value: string) {
  return value.slice(0, 5)
}

export function PeopleOperationalRoutines({ employees, onTasksGenerated }: { employees: Employee[]; onTasksGenerated?: () => void }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const activeEmployees = useMemo(() => employees.filter((employee) => employee.is_active), [employees])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [materializing, setMaterializing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [area, setArea] = useState<RoutineArea>("hospitalidad")
  const [templateId, setTemplateId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [localTime, setLocalTime] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [routineResult, profileResult, locationResult] = await Promise.all([
      supabase
        .from("operational_task_routines")
        .select("id,name,task_template_id,operational_area,task_category,title,description,priority,estimated_minutes,employee_id,location_id,weekdays,local_time,timezone,is_active")
        .order("is_active", { ascending: false })
        .order("local_time"),
      supabase
        .from("employee_task_profiles")
        .select("employee_id,primary_operational_area,secondary_operational_areas,task_categories,can_receive_tasks"),
      supabase.from("locations").select("id,name").eq("is_active", true).order("name"),
    ])

    if (routineResult.error) {
      toast.error("No fue posible cargar las rutinas operativas")
      setRoutines([])
    } else {
      setRoutines((routineResult.data ?? []) as Routine[])
    }
    if (!profileResult.error) setProfiles((profileResult.data ?? []) as Profile[])
    if (!locationResult.error) setLocations((locationResult.data ?? []) as Location[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const templates = useMemo(
    () => operationalTaskTemplates.filter((template) => routineAreas.includes(template.area as RoutineArea) && template.area === area),
    [area],
  )

  const profileByEmployee = useMemo(() => new Map(profiles.map((profile) => [profile.employee_id, profile])), [profiles])

  const candidateEmployees = useMemo(
    () => activeEmployees.filter((employee) => candidateForArea(employee, profileByEmployee.get(employee.id), area)),
    [activeEmployees, area, profileByEmployee],
  )

  const selectedTemplate = operationalTaskTemplates.find((template) => template.id === templateId) as OperationalTaskTemplate | undefined

  function resetDialog() {
    setArea("hospitalidad")
    setTemplateId("")
    setEmployeeId("")
    setLocationId("")
    setWeekdays([])
    setLocalTime("")
    setError(null)
  }

  function toggleDay(value: number) {
    setWeekdays((current) => current.includes(value) ? current.filter((day) => day !== value) : [...current, value].sort((a, b) => a - b))
  }

  async function createRoutine() {
    if (!selectedTemplate) return setError("Selecciona una tarea habitual.")
    if (!employeeId) return setError("Selecciona una persona responsable.")
    if (weekdays.length === 0) return setError("Selecciona al menos un día.")
    if (!localTime) return setError("Selecciona una hora.")

    setSaving(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc("create_operational_task_routine", {
      p_name: selectedTemplate.title,
      p_task_template_id: selectedTemplate.id,
      p_operational_area: selectedTemplate.area,
      p_task_category: selectedTemplate.category,
      p_title: selectedTemplate.title,
      p_description: selectedTemplate.description,
      p_priority: selectedTemplate.priority,
      p_estimated_minutes: selectedTemplate.estimatedMinutes,
      p_employee_id: employeeId,
      p_location_id: locationId || null,
      p_weekdays: weekdays,
      p_local_time: localTime,
    })

    if (rpcError) {
      setError(rpcError.message)
      setSaving(false)
      return
    }

    toast.success("Rutina operativa creada")
    setSaving(false)
    setDialogOpen(false)
    resetDialog()
    await load()
  }

  async function setActive(routine: Routine, next: boolean) {
    const { error: rpcError } = await supabase.rpc("set_operational_task_routine_active", {
      p_routine_id: routine.id,
      p_is_active: next,
    })
    if (rpcError) return toast.error(rpcError.message)
    toast.success(next ? "Rutina reactivada" : "Rutina pausada")
    await load()
  }

  async function materializeToday() {
    setMaterializing(true)
    const { data, error: rpcError } = await supabase.rpc("materialize_operational_task_routines", {
      p_local_date: chileDate(),
    })
    if (rpcError) {
      toast.error(rpcError.message)
      setMaterializing(false)
      return
    }
    const result = (data ?? {}) as { created_count?: number; existing_count?: number }
    const created = result.created_count ?? 0
    const existing = result.existing_count ?? 0
    toast.success(created > 0 ? `${created} tarea${created === 1 ? "" : "s"} creada${created === 1 ? "" : "s"} para hoy` : existing > 0 ? "Las rutinas de hoy ya estaban generadas" : "No hay rutinas activas para hoy")
    setMaterializing(false)
    onTasksGenerated?.()
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b bg-muted/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rutinas operativas</p>
            <CardTitle className="mt-1 text-xl">Trabajo repetible, sin recrearlo cada día</CardTitle>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Santiago define responsable, días y hora. Black Swan genera la tarea del día una sola vez y conserva su trazabilidad.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => void materializeToday()} disabled={materializing || loading}>
              {materializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Generar hoy
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva rutina
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando rutinas…</div>
        ) : routines.length === 0 ? (
          <div className="p-6">
            <p className="font-medium">Aún no hay rutinas operativas confirmadas.</p>
            <p className="mt-1 text-sm text-muted-foreground">Crea sólo rutinas reales. Black Swan no asume horarios ni responsables automáticamente.</p>
          </div>
        ) : (
          <div className="divide-y">
            {routines.map((routine) => {
              const employee = activeEmployees.find((item) => item.id === routine.employee_id) ?? employees.find((item) => item.id === routine.employee_id)
              const location = locations.find((item) => item.id === routine.location_id)
              return (
                <div key={routine.id} className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.8fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{routine.name}</p>
                      <Badge variant="secondary">{operationalAreaLabels[routine.operational_area as OperationalArea]}</Badge>
                      <Badge variant={routine.is_active ? "outline" : "secondary"}>{routine.is_active ? "Activa" : "Pausada"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{employee?.name ?? "Responsable no disponible"}{location ? ` · ${location.name}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-muted-foreground" />{scheduleLabel(routine.weekdays)}</span>
                    <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-muted-foreground" />{displayTime(routine.local_time)}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void setActive(routine, !routine.is_active)}>
                    {routine.is_active ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {routine.is_active ? "Pausar" : "Reactivar"}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDialog() }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva rutina operativa</DialogTitle>
            <DialogDescription>Define una rutina real. Los días y la hora quedan confirmados por Santiago al guardar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={area} onValueChange={(value: RoutineArea) => { setArea(value); setTemplateId(""); setEmployeeId("") }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hospitalidad">Hospitality</SelectItem>
                    <SelectItem value="housekeeping">Limpieza</SelectItem>
                    <SelectItem value="cocina">Cocina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tarea habitual</Label>
                <Select value={templateId || "none"} onValueChange={(value) => setTemplateId(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar</SelectItem>
                    {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={employeeId || "none"} onValueChange={(value) => setEmployeeId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar persona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar persona</SelectItem>
                  {candidateEmployees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name.trim()} · {employee.role || "Sin función registrada"}</SelectItem>)}
                </SelectContent>
              </Select>
              {candidateEmployees.length === 0 && <p className="text-xs text-muted-foreground">No hay personas activas con perfil compatible para esta área.</p>}
            </div>

            <div className="space-y-2">
              <Label>Días</Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {dayOptions.map((day) => (
                  <label key={day.value} className="flex cursor-pointer items-center justify-center gap-2 rounded-md border p-2 text-sm hover:bg-muted">
                    <Checkbox checked={weekdays.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="routine-time">Hora</Label>
                <Input id="routine-time" type="time" value={localTime} onChange={(event) => setLocalTime(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ubicación</Label>
                <Select value={locationId || "none"} onValueChange={(value) => setLocationId(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Sin ubicación específica" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin ubicación específica</SelectItem>
                    {locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedTemplate && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="font-medium">{selectedTemplate.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedTemplate.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{selectedTemplate.estimatedMinutes} min · prioridad {selectedTemplate.priority}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void createRoutine()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar rutina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChefHat, ClipboardPlus, ConciergeBell, Loader2, RefreshCw, Sparkles, Users } from "lucide-react"
import { AddTaskDialog } from "@/components/add-task-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Employee } from "@/lib/types"
import type { OperationalArea } from "@/lib/operational-task-templates"

type Profile = {
  employee_id: string
  canonical_job_title: string | null
  role_summary: string | null
  primary_operational_area: string | null
  secondary_operational_areas: string[] | null
  task_categories: string[] | null
  core_responsibilities: string[] | null
  can_receive_tasks: boolean | null
}

type AssignmentRow = {
  employee_id: string | null
  tasks: { id: string; status: string; due_date: string | null; operational_area: string | null } | null
}

type Focus = "hospitality" | "housekeeping" | "kitchen" | "all"

type PersonRow = {
  employee: Employee
  profile: Profile | null
  openTasks: number
  dueToday: number
}

const focusMeta: Record<Focus, { label: string; area?: OperationalArea; icon: typeof Users }> = {
  hospitality: { label: "Hospitality", area: "hospitalidad", icon: ConciergeBell },
  housekeeping: { label: "Limpieza", area: "housekeeping", icon: Sparkles },
  kitchen: { label: "Cocina", area: "cocina", icon: ChefHat },
  all: { label: "Todo el personal", icon: Users },
}

function chileDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function focusMatch(row: PersonRow, focus: Focus) {
  if (focus === "all") return row.employee.is_active
  const area = row.profile?.primary_operational_area?.toLowerCase() ?? ""
  const secondary = (row.profile?.secondary_operational_areas ?? []).map((item) => item.toLowerCase())
  const role = row.employee.role?.toLowerCase() ?? ""
  const categories = (row.profile?.task_categories ?? []).map((item) => item.toLowerCase())

  if (focus === "hospitality") {
    return area === "hospitality" || secondary.includes("hospitality") || role.includes("hospitality") || categories.some((item) => item.includes("hospitality"))
  }
  if (focus === "housekeeping") {
    return area === "housekeeping" || secondary.includes("housekeeping") || role.includes("limpieza") || role.includes("laundry") || categories.some((item) => item.includes("clean"))
  }
  return area === "kitchen" || secondary.includes("kitchen") || role.includes("chef") || role.includes("cocina") || categories.some((item) => item.includes("kitchen"))
}

export function PeopleOperationsDispatch({ employees }: { employees: Employee[] }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [focus, setFocus] = useState<Focus>("hospitality")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogEmployeeId, setDialogEmployeeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [profileResult, assignmentResult] = await Promise.all([
      supabase
        .from("employee_task_profiles")
        .select("employee_id,canonical_job_title,role_summary,primary_operational_area,secondary_operational_areas,task_categories,core_responsibilities,can_receive_tasks"),
      supabase
        .from("task_assignments")
        .select("employee_id,tasks!inner(id,status,due_date,operational_area)")
        .not("employee_id", "is", null)
        .in("tasks.status", ["nueva", "en_progreso"]),
    ])
    if (!profileResult.error) setProfiles((profileResult.data ?? []) as Profile[])
    if (!assignmentResult.error) setAssignments((assignmentResult.data ?? []) as unknown as AssignmentRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const rows = useMemo<PersonRow[]>(() => {
    const profileByEmployee = new Map(profiles.map((profile) => [profile.employee_id, profile]))
    const counts = new Map<string, { open: number; dueToday: number }>()
    const today = chileDate()
    const acceptedAreas = focus === "all"
      ? null
      : focus === "hospitality"
        ? new Set(["hospitalidad", "hospitality"])
        : focus === "housekeeping"
          ? new Set(["housekeeping"])
          : new Set(["cocina", "kitchen"])
    for (const assignment of assignments) {
      if (!assignment.employee_id || !assignment.tasks) continue
      const taskArea = assignment.tasks.operational_area?.toLowerCase() ?? ""
      if (acceptedAreas && !acceptedAreas.has(taskArea)) continue
      const current = counts.get(assignment.employee_id) ?? { open: 0, dueToday: 0 }
      current.open += 1
      if (assignment.tasks.due_date === today) current.dueToday += 1
      counts.set(assignment.employee_id, current)
    }
    return employees
      .filter((employee) => employee.is_active)
      .map((employee) => {
        const count = counts.get(employee.id) ?? { open: 0, dueToday: 0 }
        return {
          employee,
          profile: profileByEmployee.get(employee.id) ?? null,
          openTasks: count.open,
          dueToday: count.dueToday,
        }
      })
  }, [assignments, employees, focus, profiles])

  const visible = useMemo(
    () => rows.filter((row) => focusMatch(row, focus)).sort((a, b) => a.openTasks - b.openTasks || a.employee.name.localeCompare(b.employee.name, "es")),
    [focus, rows],
  )

  const selectedEmployee = employees.find((employee) => employee.id === dialogEmployeeId) ?? null
  const defaultArea = focusMeta[focus].area ?? null

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b bg-muted/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Personal · operación diaria</p>
            <CardTitle className="mt-1 text-xl">Asignar trabajo sin perder contexto</CardTitle>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Santiago puede ver quién está disponible por función, cuánta carga abierta tiene y asignarle una tarea operativa con trazabilidad.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
        <Tabs value={focus} onValueChange={(value) => setFocus(value as Focus)}>
          <TabsList className="h-auto flex-wrap justify-start">
            {(Object.keys(focusMeta) as Focus[]).map((key) => {
              const item = focusMeta[key]
              const Icon = item.icon
              return <TabsTrigger key={key} value={key} className="gap-2"><Icon className="h-4 w-4" />{item.label}</TabsTrigger>
            })}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando carga operacional…</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No hay personal canónico habilitado para esta función.</div>
        ) : (
          <div className="divide-y">
            {visible.map((row) => {
              const canReceive = row.profile?.can_receive_tasks !== false
              const responsibilities = row.profile?.core_responsibilities?.slice(0, 3) ?? []
              return (
                <div key={row.employee.id} className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.5fr)_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.employee.name.trim()}</p>
                      <Badge variant="outline">{row.profile?.canonical_job_title || row.employee.role || "Función por validar"}</Badge>
                      {!canReceive && <Badge variant="secondary">No asignable</Badge>}
                    </div>
                    {row.profile?.role_summary && <p className="mt-1 text-sm text-muted-foreground">{row.profile.role_summary}</p>}
                    {responsibilities.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">{responsibilities.join(" · ")}</p>
                    )}
                  </div>

                  <div className="flex gap-6 md:justify-end">
                    <div>
                      <p className="text-xs text-muted-foreground">Abiertas</p>
                      <p className="text-lg font-semibold">{row.openTasks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Para hoy</p>
                      <p className="text-lg font-semibold">{row.dueToday}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="md:min-w-36"
                    disabled={!canReceive}
                    onClick={() => setDialogEmployeeId(row.employee.id)}
                  >
                    <ClipboardPlus className="mr-2 h-4 w-4" />
                    Asignar tarea
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <AddTaskDialog
        open={Boolean(dialogEmployeeId)}
        onOpenChange={(open) => { if (!open) setDialogEmployeeId(null) }}
        onTaskCreated={() => void load()}
        defaultEmployeeIds={selectedEmployee ? [selectedEmployee.id] : []}
        defaultArea={defaultArea}
      />
    </Card>
  )
}

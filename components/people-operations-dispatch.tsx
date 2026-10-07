"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChefHat, CheckCircle2, ClipboardPlus, ConciergeBell, Loader2, RefreshCw, Sparkles, Users } from "lucide-react"
import { AddTaskDialog } from "@/components/add-task-dialog"
import { PeopleOperationalRoutines } from "@/components/people-operational-routines"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
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

type AssignedTask = {
  id: string
  title: string
  status: string
  due_date: string | null
  operational_area: string | null
  priority: string
  task_category: string | null
  source_type: string | null
  source_label: string | null
}

type AssignmentRow = {
  employee_id: string | null
  tasks: AssignedTask | null
}

type Focus = "hospitality" | "housekeeping" | "kitchen" | "all"

type PersonRow = {
  employee: Employee
  profile: Profile | null
  openTasks: number
  dueToday: number
  overdue: number
  currentTasks: AssignedTask[]
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

function isCurrentOperationalTask(task: AssignedTask) {
  if (task.title.trim().startsWith("[DEMO]")) return false
  if (task.source_label?.startsWith("DEMO") === true) return false
  if (task.task_category?.startsWith("asana_import") === true) return false
  if (task.source_label?.startsWith("Asana ·") === true) return false
  return true
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
  const { language } = useLanguage()
  const locale = language === "en" || language === "de" ? language : "es"
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
        .select("employee_id,tasks!inner(id,title,status,due_date,operational_area,priority,task_category,source_type,source_label)")
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
    const taskMap = new Map<string, AssignedTask[]>()
    const today = chileDate()
    const acceptedAreas = focus === "all"
      ? null
      : focus === "hospitality"
        ? new Set(["hospitalidad", "hospitality"])
        : focus === "housekeeping"
          ? new Set(["housekeeping"])
          : new Set(["cocina", "kitchen"])

    for (const assignment of assignments) {
      if (!assignment.employee_id || !assignment.tasks || !isCurrentOperationalTask(assignment.tasks)) continue
      const taskArea = assignment.tasks.operational_area?.toLowerCase() ?? ""
      if (acceptedAreas && !acceptedAreas.has(taskArea)) continue
      const current = taskMap.get(assignment.employee_id) ?? []
      if (!current.some((task) => task.id === assignment.tasks?.id)) current.push(assignment.tasks)
      taskMap.set(assignment.employee_id, current)
    }

    return employees
      .filter((employee) => employee.is_active)
      .map((employee) => {
        const currentTasks = (taskMap.get(employee.id) ?? []).sort((a, b) => {
          const aOverdue = Boolean(a.due_date && a.due_date < today)
          const bOverdue = Boolean(b.due_date && b.due_date < today)
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
          if (a.due_date) return -1
          if (b.due_date) return 1
          return a.title.localeCompare(b.title, "es")
        })
        return {
          employee,
          profile: profileByEmployee.get(employee.id) ?? null,
          openTasks: currentTasks.length,
          dueToday: currentTasks.filter((task) => task.due_date === today).length,
          overdue: currentTasks.filter((task) => Boolean(task.due_date && task.due_date < today)).length,
          currentTasks,
        }
      })
  }, [assignments, employees, focus, profiles])

  const visible = useMemo(
    () => rows
      .filter((row) => focusMatch(row, focus))
      .sort((a, b) => b.overdue - a.overdue || b.dueToday - a.dueToday || a.openTasks - b.openTasks || a.employee.name.localeCompare(b.employee.name, "es")),
    [focus, rows],
  )

  const focusTotals = useMemo(() => visible.reduce(
    (totals, row) => ({
      open: totals.open + row.openTasks,
      today: totals.today + row.dueToday,
      overdue: totals.overdue + row.overdue,
    }),
    { open: 0, today: 0, overdue: 0 },
  ), [visible])

  const selectedEmployee = employees.find((employee) => employee.id === dialogEmployeeId) ?? null
  const defaultArea = focusMeta[focus].area ?? null

  return (
    <div className="space-y-4">
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
        <div className="grid gap-2 border-t pt-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <span className="text-xs text-muted-foreground">Trabajo abierto</span>
            <span className="text-sm font-semibold">{focusTotals.open}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <span className="text-xs text-muted-foreground">Para hoy</span>
            <span className="text-sm font-semibold">{focusTotals.today}</span>
          </div>
          <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${focusTotals.overdue > 0 ? "border-amber-400/40 bg-amber-500/5" : "bg-background"}`}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {focusTotals.overdue > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              Vencidas
            </span>
            <span className={`text-sm font-semibold ${focusTotals.overdue > 0 ? "text-amber-500" : ""}`}>{focusTotals.overdue}</span>
          </div>
        </div>
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
                    {row.currentTasks.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {row.currentTasks.slice(0, 2).map((task) => {
                          const overdue = Boolean(task.due_date && task.due_date < chileDate())
                          return (
                            <Link
                              key={task.id}
                              href={`/${locale}/tasks?selected=${task.id}`}
                              className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-xs transition-colors hover:bg-muted/50"
                            >
                              <span className="min-w-0 truncate font-medium">{task.title}</span>
                              <span className={overdue ? "shrink-0 text-amber-500" : "shrink-0 text-muted-foreground"}>
                                {overdue ? "Vencida" : task.due_date === chileDate() ? "Hoy" : task.status === "en_progreso" ? "En curso" : "Pendiente"}
                              </span>
                            </Link>
                          )
                        })}
                        {row.currentTasks.length > 2 && <p className="text-[11px] text-muted-foreground">+{row.currentTasks.length - 2} tarea{row.currentTasks.length - 2 === 1 ? "" : "s"} más</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-5 md:justify-end">
                    <div>
                      <p className="text-xs text-muted-foreground">Abiertas</p>
                      <p className="text-lg font-semibold">{row.openTasks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hoy</p>
                      <p className="text-lg font-semibold">{row.dueToday}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vencidas</p>
                      <p className={`text-lg font-semibold ${row.overdue > 0 ? "text-amber-500" : ""}`}>{row.overdue}</p>
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
    <PeopleOperationalRoutines employees={employees} onTasksGenerated={() => void load()} />
    </div>
  )
}

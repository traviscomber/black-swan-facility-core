"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, CheckCircle2, Clock, ExternalLink, ListChecks, MapPin, RefreshCw, Users } from "lucide-react"
import { isPast, isThisWeek, isToday, parseISO } from "date-fns"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { TaskDetailPanel } from "@/components/task-detail-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { operationalAreaLabels, type OperationalArea } from "@/lib/operational-task-templates"

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type TaskPriority = "baja" | "media" | "alta" | "urgente"
type TaskAssignment = {
  employee_id?: string | null
  volunteer_id?: string | null
  employees?: { id: string; name: string; email?: string | null; phone?: string | null } | null
  volunteers?: { id: string; name: string; email?: string | null; phone?: string | null; volunteer_role?: string | null } | null
}
type PersonalTask = {
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
  created_at: string
  completed_at?: string | null
  operational_area?: OperationalArea | null
  task_category?: string | null
  estimated_minutes?: number | null
  animal_handling?: boolean
  safety_notes?: string | null
  source_label?: string | null
  source_path?: string | null
  task_assignments: TaskAssignment[]
}
type CurrentAsanaTask = {
  external_task_id: string
  task_title: string
  project_name: string | null
  assignee_label: string | null
  assignee_email: string | null
  start_on: string | null
  due_on: string | null
  created_at_source: string | null
  modified_at_source: string | null
  source_url: string | null
  last_seen_at: string
}
type ViewTab = "pendientes" | "completadas" | "todas"

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const DEFAULT_WORKSPACE_GID = "1205953160575908"

const COPY = {
  en: { eyebrow: "Black Swan · Personal workspace", title: "My tasks", description: "Only explicitly assigned Black Swan work and new Asana intake are shown here. Historical Asana backlog and demo routing stay separate.", pending: "Open", today: "Due today", completedWeek: "Completed this week", loadError: "Your tasks could not be loaded.", noProfile: "This account is not linked to an employee profile yet.", tabPending: "Open", tabCompleted: "Completed", tabAll: "All mine", empty: "No current tasks in this view.", allTasks: "All operational tasks", history: "Asana history", select: "Select a Black Swan task to review instructions, status, comments and evidence.", overdue: "Overdue", inProgress: "In progress", due: "Due", minutes: "min", asanaNew: "New from Asana", asanaNewDetail: "Only tasks created in Asana on or after the current-work cutover and still present in the latest workspace sync are shown.", sync: "Refresh from Asana", syncing: "Syncing…", syncOk: "Asana refreshed", syncFailed: "Asana could not be synchronized." },
  es: { eyebrow: "Black Swan · Espacio personal", title: "Mis tareas", description: "Aquí sólo aparecen trabajo Black Swan asignado explícitamente y tareas nuevas de Asana. El backlog histórico y el ruteo demo quedan separados.", pending: "Abiertas", today: "Para hoy", completedWeek: "Completadas esta semana", loadError: "No fue posible cargar tus tareas.", noProfile: "Esta cuenta todavía no está vinculada a un perfil de trabajador.", tabPending: "Abiertas", tabCompleted: "Completadas", tabAll: "Todas las mías", empty: "No hay tareas vigentes en esta vista.", allTasks: "Todas las tareas operativas", history: "Histórico Asana", select: "Selecciona una tarea Black Swan para revisar instrucciones, estado, comentarios y evidencia.", overdue: "Vencida", inProgress: "En curso", due: "Fecha", minutes: "min", asanaNew: "Nuevas desde Asana", asanaNewDetail: "Sólo se muestran tareas creadas en Asana desde el corte de trabajo vigente y que siguen presentes en la última sincronización del workspace.", sync: "Actualizar desde Asana", syncing: "Sincronizando…", syncOk: "Asana actualizado", syncFailed: "No fue posible sincronizar con Asana." },
  de: { eyebrow: "Black Swan · Persönlicher Bereich", title: "Meine Aufgaben", description: "Hier erscheinen nur ausdrücklich zugewiesene Black-Swan-Aufgaben und neue Asana-Eingänge. Historischer Asana-Backlog und Demo-Routing bleiben getrennt.", pending: "Offen", today: "Heute fällig", completedWeek: "Diese Woche erledigt", loadError: "Deine Aufgaben konnten nicht geladen werden.", noProfile: "Dieses Konto ist noch keinem Mitarbeiterprofil zugeordnet.", tabPending: "Offen", tabCompleted: "Erledigt", tabAll: "Alle meine", empty: "Keine aktuellen Aufgaben in dieser Ansicht.", allTasks: "Alle operativen Aufgaben", history: "Asana-Verlauf", select: "Wähle eine Black-Swan-Aufgabe, um Anweisungen, Status, Kommentare und Nachweise zu prüfen.", overdue: "Überfällig", inProgress: "In Bearbeitung", due: "Fällig", minutes: "Min", asanaNew: "Neu aus Asana", asanaNewDetail: "Nur Aufgaben, die seit dem aktuellen Arbeits-Cutover in Asana erstellt wurden und im letzten Workspace-Sync noch vorhanden sind, werden angezeigt.", sync: "Aus Asana aktualisieren", syncing: "Synchronisierung…", syncOk: "Asana aktualisiert", syncFailed: "Asana konnte nicht synchronisiert werden." },
} as const

const priorityClasses: Record<TaskPriority, string> = {
  baja: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
  media: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  alta: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  urgente: "border-destructive/30 bg-destructive/10 text-destructive",
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase()
}

function isHistoricalAsanaTask(task: PersonalTask) {
  return task.task_category?.startsWith("asana_import") === true || task.source_label?.startsWith("Asana ·") === true
}

function isDemoTask(task: PersonalTask) {
  return task.title.trim().startsWith("[DEMO]") || task.source_label?.startsWith("DEMO") === true
}

export default function MyTasksPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const locale = LOCALES[lang]
  const supabase = useMemo(() => createBrowserClient(), [])
  const [tasks, setTasks] = useState<PersonalTask[]>([])
  const [asanaTasks, setAsanaTasks] = useState<CurrentAsanaTask[]>([])
  const [selectedTask, setSelectedTask] = useState<PersonalTask | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>("pendientes")
  const [employeeName, setEmployeeName] = useState<string | null>(null)
  const [hasEmployeeProfile, setHasEmployeeProfile] = useState(true)
  const [canSyncAsana, setCanSyncAsana] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Santiago" }), [locale])

  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      router.replace(`/${lang}/auth/login`)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_access_profiles")
      .select("employee_id,email,role_key,employees(name,email)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (profileError) {
      setError(copy.loadError)
      setIsLoading(false)
      return
    }

    const employeeId = profile?.employee_id ?? null
    const employee = Array.isArray(profile?.employees) ? profile?.employees[0] : profile?.employees
    setEmployeeName((employee as { name?: string | null } | null)?.name ?? profile?.email ?? user.email ?? null)
    setHasEmployeeProfile(Boolean(employeeId))
    setCanSyncAsana(["admin", "approver"].includes(normalize(profile?.role_key)))

    if (!employeeId) {
      setTasks([])
      setAsanaTasks([])
      setSelectedTask(null)
      setIsLoading(false)
      return
    }

    const [assignmentsResult, baselineResult, identityResult] = await Promise.all([
      supabase.from("task_assignments").select("task_id").eq("employee_id", employeeId),
      supabase.from("asana_sync_baselines").select("cutover_at,last_synced_at").eq("workspace_gid", DEFAULT_WORKSPACE_GID).maybeSingle(),
      supabase.from("asana_identity_links").select("asana_email,asana_user_gid").eq("employee_id", employeeId).eq("is_active", true).maybeSingle(),
    ])

    if (assignmentsResult.error) {
      setError(copy.loadError)
      setIsLoading(false)
      return
    }

    const assignedTaskIds = (assignmentsResult.data ?? []).map((item) => item.task_id).filter(Boolean) as string[]
    let nextTasks: PersonalTask[] = []
    if (assignedTaskIds.length > 0) {
      const { data: taskRows, error: taskError } = await supabase
        .from("tasks")
        .select("*, task_assignments(employee_id, volunteer_id, employees(id, name, email, phone), volunteers(id, name, email, phone, volunteer_role))")
        .in("id", assignedTaskIds)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })

      if (taskError) {
        setError(copy.loadError)
        setIsLoading(false)
        return
      }
      nextTasks = ((taskRows ?? []) as PersonalTask[]).filter((task) => !isDemoTask(task) && !isHistoricalAsanaTask(task))
    }

    let nextAsanaTasks: CurrentAsanaTask[] = []
    const cutoverAt = baselineResult.data?.cutover_at ?? null
    const latestSeenAt = baselineResult.data?.last_synced_at ?? null
    const asanaEmail = identityResult.data?.asana_email ?? null
    if (asanaEmail && cutoverAt && latestSeenAt) {
      const { data: currentRows, error: currentError } = await supabase
        .from("asana_current_tasks")
        .select("external_task_id,task_title,project_name,assignee_label,assignee_email,start_on,due_on,created_at_source,modified_at_source,source_url,last_seen_at")
        .eq("task_status", "open")
        .eq("assignee_email", asanaEmail)
        .eq("last_seen_at", latestSeenAt)
        .gte("created_at_source", cutoverAt)
        .order("due_on", { ascending: true, nullsFirst: false })
        .order("created_at_source", { ascending: false })
      if (!currentError) nextAsanaTasks = (currentRows ?? []) as CurrentAsanaTask[]
    }

    const selectedId = new URLSearchParams(window.location.search).get("selected")
    setTasks(nextTasks)
    setAsanaTasks(nextAsanaTasks)
    setSelectedTask((current) => selectedId ? nextTasks.find((task) => task.id === selectedId) ?? null : current ? nextTasks.find((task) => task.id === current.id) ?? null : null)
    if (selectedId) {
      const selected = nextTasks.find((task) => task.id === selectedId)
      setActiveTab(selected?.status === "completada" ? "completadas" : selected?.status === "cancelada" ? "todas" : "pendientes")
    }
    setIsLoading(false)
  }, [copy.loadError, lang, router, supabase])

  useEffect(() => { void loadTasks() }, [loadTasks])

  const syncAsana = useCallback(async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const response = await fetch("/api/asana-live/sync", { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSyncMessage(copy.syncFailed)
        return
      }
      setSyncMessage(`${copy.syncOk}: ${payload.synced ?? 0}/${payload.observed ?? 0}`)
      await loadTasks()
    } catch {
      setSyncMessage(copy.syncFailed)
    } finally {
      setSyncing(false)
    }
  }, [copy.syncFailed, copy.syncOk, loadTasks])

  const openTasks = tasks.filter((task) => task.status === "nueva" || task.status === "en_progreso")
  const completedWeek = tasks.filter((task) => task.status === "completada" && task.completed_at && isThisWeek(parseISO(task.completed_at), { weekStartsOn: 1 })).length
  const dueToday = openTasks.filter((task) => task.due_date && isToday(parseISO(task.due_date))).length + asanaTasks.filter((task) => task.due_on && isToday(parseISO(task.due_on))).length
  const filteredTasks = tasks.filter((task) => activeTab === "pendientes" ? task.status === "nueva" || task.status === "en_progreso" : activeTab === "completadas" ? task.status === "completada" : true)
  const visibleAsanaTasks = activeTab === "pendientes" || activeTab === "todas" ? asanaTasks : []
  const hasVisibleWork = filteredTasks.length + visibleAsanaTasks.length > 0

  function openTask(task: PersonalTask) {
    setSelectedTask(task)
    window.history.replaceState({}, "", `/${lang}/my-tasks?selected=${task.id}`)
  }

  return <AppLayout><div className="space-y-6 p-4 sm:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{copy.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-medium text-accent">{copy.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.description}{employeeName ? ` · ${employeeName}` : ""}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canSyncAsana && <Button variant="outline" onClick={() => void syncAsana()} disabled={syncing || isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? copy.syncing : copy.sync}</Button>}
        <Button variant="outline" onClick={() => router.push(`/${lang}/asana-live`)}>{copy.history}</Button>
        <Button variant="outline" onClick={() => router.push(`/${lang}/tasks`)}><Users className="mr-2 h-4 w-4" />{copy.allTasks}</Button>
      </div>
    </header>

    {syncMessage && <div className="border-l-2 border-primary/60 bg-primary/5 p-3 text-sm">{syncMessage}</div>}
    {error && <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
    {!isLoading && !hasEmployeeProfile && <div className="border-l-2 border-amber-400/60 bg-amber-500/5 p-4 text-sm text-muted-foreground">{copy.noProfile}</div>}

    {!isLoading && !error && hasEmployeeProfile && <div className="grid grid-cols-3 gap-x-6 border-y py-4">
      <Metric icon={ListChecks} label={copy.pending} value={openTasks.length + asanaTasks.length} />
      <Metric icon={Calendar} label={copy.today} value={dueToday} />
      <Metric icon={CheckCircle2} label={copy.completedWeek} value={completedWeek} />
    </div>}

    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ViewTab)}>
      <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
        <TabsTrigger value="pendientes">{copy.tabPending}</TabsTrigger>
        <TabsTrigger value="completadas">{copy.tabCompleted}</TabsTrigger>
        <TabsTrigger value="todas">{copy.tabAll}</TabsTrigger>
      </TabsList>
    </Tabs>

    <div className="grid gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-6">
        {visibleAsanaTasks.length > 0 && <div>
          <div className="border-b pb-3"><h2 className="text-sm font-medium">{copy.asanaNew}</h2><p className="mt-1 text-xs text-muted-foreground">{copy.asanaNewDetail}</p></div>
          <div className="border-t-0">
            {visibleAsanaTasks.map((task) => <a key={task.external_task_id} href={task.source_url ?? "#"} target="_blank" rel="noreferrer" className="block border-b px-1 py-4 transition-colors hover:bg-muted/30">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-medium">{task.task_title}</h3><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">Asana</Badge>{task.project_name && <Badge variant="secondary">{task.project_name}</Badge>}</div></div><ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{task.due_on && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{copy.due}: {date.format(parseISO(task.due_on))}</span>}{task.assignee_label && <span>{task.assignee_label}</span>}</div>
            </a>)}
          </div>
        </div>}

        {isLoading ? <p className="border-y py-10 text-center text-sm text-muted-foreground">…</p> : !hasVisibleWork ? <div className="border-y py-10 text-center text-sm text-muted-foreground">{copy.empty}</div> : filteredTasks.length > 0 ? <div className="border-t">
          {filteredTasks.map((task) => {
            const due = task.due_date ? parseISO(task.due_date) : null
            const overdue = due && isPast(due) && !isToday(due) && task.status !== "completada" && task.status !== "cancelada"
            return <button key={task.id} type="button" onClick={() => openTask(task)} className={`w-full border-b px-1 py-4 text-left transition-colors hover:bg-muted/30 ${selectedTask?.id === task.id ? "bg-primary/5" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-medium">{task.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {task.status === "en_progreso" && <Badge variant="outline">{copy.inProgress}</Badge>}
                    <Badge variant="outline" className={priorityClasses[task.priority]}>{task.priority}</Badge>
                    {task.operational_area && <Badge variant="secondary">{operationalAreaLabels[task.operational_area]}</Badge>}
                    {task.task_category && <Badge variant="outline">{task.task_category}</Badge>}
                  </div>
                </div>
                {overdue && <Badge variant="destructive">{copy.overdue}</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {task.due_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{copy.due}: {date.format(parseISO(task.due_date))}</span>}
                {task.location_name && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{task.location_name}</span>}
                {task.estimated_minutes && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{task.estimated_minutes} {copy.minutes}</span>}
              </div>
            </button>
          })}
        </div> : null}
      </section>

      <section className="min-w-0 border-l-0 lg:border-l lg:pl-6">
        {selectedTask ? <TaskDetailPanel task={selectedTask} onUpdate={loadTasks} onClose={() => { setSelectedTask(null); window.history.replaceState({}, "", `/${lang}/my-tasks`) }} onEdit={(task) => router.push(`/${lang}/tasks?selected=${task.id}`)} /> : <div className="flex min-h-64 items-center justify-center border-y p-8 text-center text-sm text-muted-foreground">{copy.select}</div>}
      </section>
    </div>
  </div></AppLayout>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
  return <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-medium">{value}</p></div></div>
}

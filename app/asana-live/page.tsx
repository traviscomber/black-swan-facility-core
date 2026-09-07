"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Calendar, CheckCircle2, ExternalLink, RefreshCw, Search, ShieldCheck, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type LiveObservation = {
  id: string
  task_title: string
  task_status: "open" | "completed" | "unknown"
  project_name: string | null
  project_url: string | null
  due_on: string | null
  start_on: string | null
  assignee_label: string | null
  external_task_id: string | null
  recency_class: string | null
  source_surface: string
  source_surface_url: string | null
  last_seen_at: string
}

type ProjectObservation = {
  id: string
  project_name: string
  parent_portfolio_name: string | null
  owner_name: string | null
  progress_percent: number | null
  task_count_total: number | null
  task_count_incomplete: number | null
  task_count_completed: number | null
  access_state: "api_accessible" | "browser_only" | "unknown"
  resource_type: "project" | "portfolio"
  source_surface_url: string | null
  last_seen_at: string
}

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

const COPY = {
  es: {
    title: "Asana en vivo",
    description: "Estado vivo observado del trabajo de Raimundo. Esta superficie no modifica Asana ni convierte observaciones en tareas canónicas de Black Swan.",
    readOnly: "Sólo lectura",
    readOnlyDetail: "Los 191 snapshots históricos permanecen separados en Tareas → Asana por conciliar. Aquí sólo se muestra evidencia viva observada.",
    openObserved: "Abiertas observadas",
    exactIdentity: "Con GID exacto",
    favorites: "Desde Favoritos",
    projects: "Proyectos observados",
    searchPlaceholder: "Buscar tarea o proyecto",
    allProjects: "Todos los proyectos",
    refresh: "Actualizar vista",
    tasksTitle: "Trabajo vivo observado",
    tasksDetail: "Se conserva cada observación abierta registrada. Las filas con GID real de Asana tienen identidad exacta; las privadas mantienen su evidencia de sesión.",
    scopeTitle: "Ámbito de Raimundo",
    scopeDetail: "Proyectos y portafolios observados bajo su responsabilidad. Los conteos sólo aparecen cuando fueron verificados.",
    noTasks: "No hay tareas que coincidan con el filtro.",
    noProjects: "No hay proyectos observados.",
    projectUnknown: "Sin proyecto",
    assigneeUnknown: "Responsable individual no verificado",
    exact: "GID exacto",
    favorite: "Favoritos",
    myTasks: "Mis tareas",
    api: "API Asana",
    browserOnly: "Sesión Raimundo",
    apiAccessible: "API accesible",
    unknownSource: "Fuente observada",
    due: "Vence",
    lastSeen: "Observado",
    open: "Abierta",
    progress: "Progreso",
    incomplete: "abiertas",
    completed: "cerradas",
    total: "total",
    loadError: "No fue posible cargar la evidencia viva de Asana.",
    identityNote: "La ausencia de GID no significa que la tarea no exista: varios proyectos privados sólo fueron visibles en la sesión autenticada de Raimundo. Se preservan filas repetidas cuando Asana contiene tareas distintas con el mismo nombre.",
  },
  en: {
    title: "Live Asana",
    description: "Observed live state of Raimundo's work. This surface does not modify Asana or turn observations into canonical Black Swan tasks.",
    readOnly: "Read only",
    readOnlyDetail: "The 191 historical snapshots remain separate under Tasks → Asana reconciliation. This view shows only observed live evidence.",
    openObserved: "Observed open",
    exactIdentity: "Exact GID",
    favorites: "From Favorites",
    projects: "Observed projects",
    searchPlaceholder: "Search task or project",
    allProjects: "All projects",
    refresh: "Refresh view",
    tasksTitle: "Observed live work",
    tasksDetail: "Every recorded open observation is preserved. Rows with a real Asana GID have exact identity; private rows retain session evidence.",
    scopeTitle: "Raimundo scope",
    scopeDetail: "Projects and portfolios observed under his responsibility. Counts appear only when verified.",
    noTasks: "No tasks match this filter.",
    noProjects: "No observed projects.",
    projectUnknown: "No project",
    assigneeUnknown: "Individual assignee not verified",
    exact: "Exact GID",
    favorite: "Favorites",
    myTasks: "My Tasks",
    api: "Asana API",
    browserOnly: "Raimundo session",
    apiAccessible: "API accessible",
    unknownSource: "Observed source",
    due: "Due",
    lastSeen: "Observed",
    open: "Open",
    progress: "Progress",
    incomplete: "open",
    completed: "closed",
    total: "total",
    loadError: "Live Asana evidence could not be loaded.",
    identityNote: "A missing GID does not mean the task does not exist: several private projects were only visible in Raimundo's authenticated session. Repeated rows are preserved when Asana contains distinct tasks with the same name.",
  },
  de: {
    title: "Asana live",
    description: "Beobachteter Live-Stand von Raimundos Arbeit. Diese Ansicht ändert Asana nicht und macht Beobachtungen nicht zu kanonischen Black-Swan-Aufgaben.",
    readOnly: "Nur lesen",
    readOnlyDetail: "Die 191 historischen Snapshots bleiben unter Aufgaben → Asana-Abgleich getrennt. Hier wird nur beobachtete Live-Evidenz gezeigt.",
    openObserved: "Beobachtet offen",
    exactIdentity: "Exakte GID",
    favorites: "Aus Favoriten",
    projects: "Beobachtete Projekte",
    searchPlaceholder: "Aufgabe oder Projekt suchen",
    allProjects: "Alle Projekte",
    refresh: "Ansicht aktualisieren",
    tasksTitle: "Beobachtete Live-Arbeit",
    tasksDetail: "Jede erfasste offene Beobachtung bleibt erhalten. Zeilen mit echter Asana-GID haben eine exakte Identität; private Zeilen behalten Sitzungsnachweise.",
    scopeTitle: "Raimundos Bereich",
    scopeDetail: "Beobachtete Projekte und Portfolios unter seiner Verantwortung. Zähler erscheinen nur, wenn sie verifiziert wurden.",
    noTasks: "Keine Aufgaben entsprechen dem Filter.",
    noProjects: "Keine beobachteten Projekte.",
    projectUnknown: "Ohne Projekt",
    assigneeUnknown: "Individuelle Zuständigkeit nicht verifiziert",
    exact: "Exakte GID",
    favorite: "Favoriten",
    myTasks: "Meine Aufgaben",
    api: "Asana API",
    browserOnly: "Raimundo-Sitzung",
    apiAccessible: "API zugänglich",
    unknownSource: "Beobachtete Quelle",
    due: "Fällig",
    lastSeen: "Beobachtet",
    open: "Offen",
    progress: "Fortschritt",
    incomplete: "offen",
    completed: "geschlossen",
    total: "gesamt",
    loadError: "Live-Asana-Evidenz konnte nicht geladen werden.",
    identityNote: "Eine fehlende GID bedeutet nicht, dass die Aufgabe nicht existiert: mehrere private Projekte waren nur in Raimundos authentifizierter Sitzung sichtbar. Wiederholte Zeilen bleiben erhalten, wenn Asana verschiedene Aufgaben mit demselben Namen enthält.",
  },
} as const

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase()
}

function safeDate(value: string | null) {
  return value ? new Date(`${value}T12:00:00`) : null
}

export default function AsanaLivePage() {
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const locale = LOCALES[lang]
  const supabase = useMemo(() => createBrowserClient(), [])
  const [observations, setObservations] = useState<LiveObservation[]>([])
  const [projects, setProjects] = useState<ProjectObservation[]>([])
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [taskResult, projectResult] = await Promise.all([
      supabase
        .from("asana_live_observations")
        .select("id,task_title,task_status,project_name,project_url,due_on,start_on,assignee_label,external_task_id,recency_class,source_surface,source_surface_url,last_seen_at")
        .eq("task_status", "open")
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("asana_live_project_observations")
        .select("id,project_name,parent_portfolio_name,owner_name,progress_percent,task_count_total,task_count_incomplete,task_count_completed,access_state,resource_type,source_surface_url,last_seen_at")
        .eq("owner_name", "Raimundo Colvin")
        .order("task_count_incomplete", { ascending: false, nullsFirst: false })
        .order("project_name", { ascending: true }),
    ])
    if (taskResult.error || projectResult.error) {
      console.error("asana live load failed", taskResult.error ?? projectResult.error)
      setError(copy.loadError)
      setLoading(false)
      return
    }
    setObservations((taskResult.data ?? []) as LiveObservation[])
    setProjects((projectResult.data ?? []) as ProjectObservation[])
    setLoading(false)
  }, [copy.loadError, supabase])

  useEffect(() => { void load() }, [load])

  const projectNames = useMemo(() => [...new Set(observations.map((row) => row.project_name).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, locale)), [locale, observations])
  const filtered = useMemo(() => {
    const needle = normalize(search)
    return observations
      .filter((row) => projectFilter === "all" || row.project_name === projectFilter)
      .filter((row) => !needle || normalize(row.task_title).includes(needle) || normalize(row.project_name).includes(needle) || normalize(row.assignee_label).includes(needle))
      .sort((a, b) => {
        const dueA = a.due_on ?? "9999-12-31"
        const dueB = b.due_on ?? "9999-12-31"
        if (dueA !== dueB) return dueA.localeCompare(dueB)
        const projectCompare = (a.project_name ?? "").localeCompare(b.project_name ?? "", locale)
        return projectCompare || a.task_title.localeCompare(b.task_title, locale)
      })
  }, [locale, observations, projectFilter, search])

  const exactCount = observations.filter((row) => Boolean(row.external_task_id)).length
  const favoritesCount = observations.filter((row) => row.source_surface === "asana_favorites_project").length
  const observedProjectCount = projects.filter((row) => row.resource_type === "project").length
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Santiago" }), [locale])
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }), [locale])
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale])

  return <AppLayout><div className="space-y-6 p-4 sm:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-medium text-accent sm:text-3xl">{copy.title}</h1><Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5" />{copy.readOnly}</Badge></div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.description}</p>
      </div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{copy.refresh}</Button>
    </div>

    <div className="border-l-2 border-primary/60 bg-primary/5 p-4 text-sm text-muted-foreground"><p className="font-medium text-foreground">{copy.readOnly}</p><p className="mt-1">{copy.readOnlyDetail}</p></div>
    {error && <div className="flex gap-3 border-l-2 border-destructive bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 lg:grid-cols-4">
      <Metric icon={CheckCircle2} label={copy.openObserved} value={observations.length} locale={locale} />
      <Metric icon={ShieldCheck} label={copy.exactIdentity} value={exactCount} locale={locale} />
      <Metric icon={Users} label={copy.favorites} value={favoritesCount} locale={locale} />
      <Metric icon={Calendar} label={copy.projects} value={observedProjectCount} locale={locale} />
    </div>

    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
      <section className="min-w-0">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-base font-medium">{copy.tasksTitle}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.tasksDetail}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchPlaceholder} className="h-9 w-full min-w-[220px] border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-9 border bg-background px-3 text-sm outline-none focus:border-primary"><option value="all">{copy.allProjects}</option>{projectNames.map((project) => <option key={project} value={project}>{project}</option>)}</select>
          </div>
        </div>

        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">…</div> : filtered.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">{copy.noTasks}</div> : <div className="divide-y">{filtered.map((row) => {
          const due = safeDate(row.due_on)
          const sourceLabel = row.external_task_id ? copy.api : row.source_surface === "asana_favorites_project" ? copy.favorite : row.source_surface === "asana_my_tasks" ? copy.myTasks : copy.unknownSource
          const href = row.source_surface_url || row.project_url
          return <article key={row.id} className="py-4">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-medium leading-snug">{row.task_title}</h3><p className="mt-1 text-xs text-muted-foreground">{row.project_name || copy.projectUnknown}</p></div><Badge variant="outline">{copy.open}</Badge></div>
            <div className="mt-2 flex flex-wrap gap-2"><Badge variant="secondary">{sourceLabel}</Badge>{row.external_task_id && <Badge variant="outline">{copy.exact}</Badge>}{row.recency_class === "browser_only" && <Badge variant="outline">{copy.browserOnly}</Badge>}</div>
            <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
              <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{row.assignee_label || copy.assigneeUnknown}</p>
              {due && <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{copy.due}: {date.format(due)}</p>}
              <p>{copy.lastSeen}: {dateTime.format(new Date(row.last_seen_at))}</p>
              {row.external_task_id && <p className="font-mono">GID {row.external_task_id}</p>}
            </div>
            {href && <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Asana <ExternalLink className="h-3 w-3" /></a>}
          </article>
        })}</div>}
        <p className="mt-4 text-xs text-muted-foreground">{copy.identityNote}</p>
      </section>

      <aside className="min-w-0 xl:border-l xl:pl-8">
        <div className="border-b pb-4"><h2 className="text-base font-medium">{copy.scopeTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.scopeDetail}</p></div>
        {loading ? <div className="py-10 text-center text-sm text-muted-foreground">…</div> : projects.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">{copy.noProjects}</div> : <div className="divide-y">{projects.map((project) => <article key={project.id} className="py-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-medium">{project.project_name}</h3>{project.parent_portfolio_name && <p className="mt-1 text-xs text-muted-foreground">{project.parent_portfolio_name}</p>}</div><Badge variant="outline">{project.resource_type === "portfolio" ? "Portfolio" : "Project"}</Badge></div>
          <div className="mt-2 flex flex-wrap gap-2">{project.access_state === "api_accessible" ? <Badge variant="secondary">{copy.apiAccessible}</Badge> : project.access_state === "browser_only" ? <Badge variant="secondary">{copy.browserOnly}</Badge> : null}{project.progress_percent !== null && <Badge variant="outline">{copy.progress}: {Math.round(Number(project.progress_percent))}%</Badge>}</div>
          {(project.task_count_total !== null || project.task_count_incomplete !== null || project.task_count_completed !== null) && <p className="mt-3 text-xs text-muted-foreground">{project.task_count_incomplete !== null ? `${number.format(project.task_count_incomplete)} ${copy.incomplete}` : ""}{project.task_count_completed !== null ? ` · ${number.format(project.task_count_completed)} ${copy.completed}` : ""}{project.task_count_total !== null ? ` · ${number.format(project.task_count_total)} ${copy.total}` : ""}</p>}
          {project.source_surface_url && <a href={project.source_surface_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Asana <ExternalLink className="h-3 w-3" /></a>}
        </article>)}</div>}
      </aside>
    </div>
  </div></AppLayout>
}

function Metric({ icon: Icon, label, value, locale }: { icon: typeof CheckCircle2; label: string; value: number; locale: string }) {
  return <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{new Intl.NumberFormat(locale).format(value)}</p></div><Icon className="mt-1 h-4 w-4 text-muted-foreground" /></div>
}

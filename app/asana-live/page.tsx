"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Archive, ExternalLink, Search, ShieldCheck, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type HistoricalObservation = {
  id: string
  task_title: string
  task_status: "open" | "completed" | "unknown"
  project_name: string | null
  due_on: string | null
  due_label: string | null
  assignee_label: string | null
  collaborator_label: string | null
  external_task_id: string | null
  source_surface: string
  source_surface_url: string | null
  first_seen_at: string
  last_seen_at: string
}

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

const COPY = {
  es: {
    title: "Histórico Asana",
    description: "Archivo personal de observaciones y snapshots previos. No se usa para calcular tus tareas vigentes ni para crear trabajo canónico automáticamente.",
    readOnly: "Archivo · sólo lectura",
    identity: "Usuario",
    back: "Volver a Mis tareas",
    records: "Registros históricos",
    projects: "Proyectos",
    exact: "Con GID exacto",
    latest: "Última observación",
    search: "Buscar histórico",
    allProjects: "Todos los proyectos",
    allStatuses: "Todos los estados",
    open: "Abierta al observar",
    completed: "Completada al observar",
    unknown: "Estado no verificado",
    noRows: "No hay histórico Asana asociado a este usuario.",
    loadError: "No fue posible cargar el histórico Asana.",
    exactBadge: "GID exacto",
    source: "Fuente histórica",
    observed: "Observado",
  },
  en: {
    title: "Asana history",
    description: "Personal archive of prior observations and snapshots. It is not used to calculate current work or automatically create canonical tasks.",
    readOnly: "Archive · read only",
    identity: "User",
    back: "Back to My tasks",
    records: "Historical records",
    projects: "Projects",
    exact: "With exact GID",
    latest: "Latest observation",
    search: "Search history",
    allProjects: "All projects",
    allStatuses: "All statuses",
    open: "Open when observed",
    completed: "Completed when observed",
    unknown: "Status unverified",
    noRows: "No Asana history is associated with this user.",
    loadError: "Asana history could not be loaded.",
    exactBadge: "Exact GID",
    source: "Historical source",
    observed: "Observed",
  },
  de: {
    title: "Asana-Verlauf",
    description: "Persönliches Archiv früherer Beobachtungen und Snapshots. Es wird nicht zur Berechnung aktueller Arbeit oder zur automatischen Erstellung kanonischer Aufgaben verwendet.",
    readOnly: "Archiv · nur Lesen",
    identity: "Benutzer",
    back: "Zurück zu Meine Aufgaben",
    records: "Historische Einträge",
    projects: "Projekte",
    exact: "Mit exakter GID",
    latest: "Letzte Beobachtung",
    search: "Verlauf durchsuchen",
    allProjects: "Alle Projekte",
    allStatuses: "Alle Status",
    open: "Bei Beobachtung offen",
    completed: "Bei Beobachtung erledigt",
    unknown: "Status nicht verifiziert",
    noRows: "Diesem Benutzer ist kein Asana-Verlauf zugeordnet.",
    loadError: "Asana-Verlauf konnte nicht geladen werden.",
    exactBadge: "Exakte GID",
    source: "Historische Quelle",
    observed: "Beobachtet",
  },
} as const

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase()
}

function belongsToIdentity(row: HistoricalObservation, asanaEmail: string | null, employeeName: string | null) {
  const observedEmail = normalize(row.collaborator_label)
  if (asanaEmail && observedEmail) return observedEmail === normalize(asanaEmail)
  if (!observedEmail && employeeName && row.assignee_label) return normalize(row.assignee_label) === normalize(employeeName)
  return false
}

export default function AsanaHistoryPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const locale = LOCALES[lang]
  const supabase = useMemo(() => createBrowserClient(), [])
  const [identityLabel, setIdentityLabel] = useState<string>("—")
  const [rows, setRows] = useState<HistoricalObservation[]>([])
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }), [locale])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      router.replace(`/${lang}/auth/login`)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_access_profiles")
      .select("employee_id,email,employees(name,email)")
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (profileError) {
      setError(copy.loadError)
      setLoading(false)
      return
    }

    const employeeId = profile?.employee_id ?? null
    const employee = Array.isArray(profile?.employees) ? profile?.employees[0] ?? null : profile?.employees ?? null
    const employeeName = (employee as { name?: string | null } | null)?.name ?? null
    setIdentityLabel(employeeName || profile?.email || authData.user.email || "—")

    if (!employeeId) {
      setRows([])
      setLoading(false)
      return
    }

    const [identityResult, historyResult] = await Promise.all([
      supabase.from("asana_identity_links").select("asana_email").eq("employee_id", employeeId).eq("is_active", true).maybeSingle(),
      supabase.from("asana_live_observations").select("id,task_title,task_status,project_name,due_on,due_label,assignee_label,collaborator_label,external_task_id,source_surface,source_surface_url,first_seen_at,last_seen_at").order("last_seen_at", { ascending: false }),
    ])

    if (identityResult.error || historyResult.error) {
      setError(copy.loadError)
      setLoading(false)
      return
    }

    const asanaEmail = identityResult.data?.asana_email ?? null
    setRows(((historyResult.data ?? []) as HistoricalObservation[]).filter((row) => belongsToIdentity(row, asanaEmail, employeeName)))
    setLoading(false)
  }, [copy.loadError, lang, router, supabase])

  useEffect(() => { void load() }, [load])

  const projects = useMemo(() => [...new Set(rows.map((row) => row.project_name).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, locale)), [locale, rows])
  const filtered = useMemo(() => {
    const needle = normalize(search)
    return rows.filter((row) => projectFilter === "all" || row.project_name === projectFilter)
      .filter((row) => statusFilter === "all" || row.task_status === statusFilter)
      .filter((row) => !needle || normalize(row.task_title).includes(needle) || normalize(row.project_name).includes(needle))
  }, [projectFilter, rows, search, statusFilter])
  const latest = rows[0]?.last_seen_at ?? null
  const exactCount = rows.filter((row) => Boolean(row.external_task_id)).length

  return <AppLayout><div className="space-y-6 p-4 sm:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-medium text-accent sm:text-3xl">{copy.title}</h1><Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5" />{copy.readOnly}</Badge></div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.description}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><UserRound className="h-3.5 w-3.5" />{copy.identity}: {identityLabel}</p>
      </div>
      <Button variant="outline" onClick={() => router.push(`/${lang}/my-tasks`)}>{copy.back}</Button>
    </header>

    {error && <div className="border-l-2 border-destructive bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 lg:grid-cols-4">
      <Metric label={copy.records} value={rows.length} />
      <Metric label={copy.projects} value={projects.length} />
      <Metric label={copy.exact} value={exactCount} />
      <div><p className="text-xs text-muted-foreground">{copy.latest}</p><p className="mt-1 text-sm font-medium">{latest ? dateTime.format(new Date(latest)) : "—"}</p></div>
    </div>

    <section>
      <div className="grid gap-2 border-b pb-4 md:grid-cols-3">
        <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} className="h-9 w-full border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
        <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-9 border bg-background px-3 text-sm outline-none focus:border-primary"><option value="all">{copy.allProjects}</option>{projects.map((project) => <option key={project} value={project}>{project}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 border bg-background px-3 text-sm outline-none focus:border-primary"><option value="all">{copy.allStatuses}</option><option value="open">{copy.open}</option><option value="completed">{copy.completed}</option><option value="unknown">{copy.unknown}</option></select>
      </div>

      {loading ? <div className="py-12 text-center text-sm text-muted-foreground">…</div> : filtered.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">{copy.noRows}</div> : <div className="border-t-0">
        {filtered.map((row) => <article key={row.id} className="border-b py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="font-medium">{row.task_title}</h2><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">{row.project_name && <Badge variant="secondary">{row.project_name}</Badge>}<Badge variant="outline">{row.task_status === "completed" ? copy.completed : row.task_status === "open" ? copy.open : copy.unknown}</Badge>{row.external_task_id && <Badge variant="outline">{copy.exactBadge}</Badge>}<Badge variant="outline"><Archive className="mr-1 h-3 w-3" />{copy.source}</Badge></div></div>
            {row.source_surface_url && <a href={row.source_surface_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Asana"><ExternalLink className="h-4 w-4" /></a>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{copy.observed}: {dateTime.format(new Date(row.last_seen_at))}</p>
        </article>)}
      </div>}
    </section>
  </div></AppLayout>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-medium">{value}</p></div>
}

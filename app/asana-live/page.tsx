"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Calendar, CheckCircle2, ExternalLink, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react"
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
  assignee_external_id: string | null
  collaborator_label: string | null
  external_task_id: string | null
  recency_class: string | null
  source_surface: string
  source_surface_url: string | null
  last_seen_at: string
}

type CurrentIdentity = {
  email: string
  employeeName: string | null
  employeeEmail: string | null
}

type RecencyFilter = "all" | "current_2026" | "legacy_open" | "browser_only" | "unclassified"

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

const ASANA_EMAIL_BY_EMPLOYEE: Record<string, string> = {
  "juan vial": "travis@blackswn.org",
  "raimundo colvin": "raimundo@blackswn.org",
}

const COPY = {
  es: {
    title: "Mis tareas de Asana",
    description: "Tareas observadas en Asana asociadas a tu identidad de Black Swan. La fuente es compartida, pero esta vista siempre se filtra por el usuario autenticado.",
    readOnly: "Sólo lectura en Asana",
    readOnlyDetail: "La sincronización actualiza evidencia del workspace de Asana. No modifica Asana ni convierte automáticamente observaciones en tareas canónicas de Black Swan.",
    accountingNote: "Estos conteos son clases de evidencia, no un total de tareas actuales. Los snapshots históricos siguen separados en Tareas → Asana por conciliar y no se mezclan con esta vista personal.",
    current2026: "2026 verificadas",
    legacyOpen: "Antiguas abiertas",
    privateObserved: "Privadas observadas",
    unclassified: "Sin fecha verificada",
    searchPlaceholder: "Buscar en mis tareas",
    allProjects: "Todos mis proyectos",
    allEvidence: "Toda la evidencia",
    sync: "Actualizar desde Asana",
    syncing: "Sincronizando…",
    syncSuccess: "Asana sincronizado",
    syncNotConfigured: "Falta configurar ASANA_ACCESS_TOKEN en producción.",
    syncForbidden: "Tu sesión no puede actualizar la evidencia de Asana.",
    syncFailed: "No fue posible sincronizar con Asana.",
    freshest: "Última observación",
    identity: "Usuario",
    tasksTitle: "Mis tareas observadas",
    tasksDetail: "Sólo aparecen tareas cuyo responsable de Asana coincide con la cuenta Asana vinculada explícitamente a tu identidad Black Swan.",
    noTasks: "No hay tareas de Asana asociadas a este usuario.",
    projectUnknown: "Sin proyecto",
    exact: "GID exacto",
    favorite: "Favoritos",
    api: "API Asana",
    browserOnly: "Observación histórica",
    unknownSource: "Fuente observada",
    due: "Vence",
    lastSeen: "Observado",
    open: "Abierta",
    loadError: "No fue posible cargar la evidencia de Asana.",
    identityError: "No fue posible resolver la identidad del usuario actual.",
  },
  en: {
    title: "My Asana tasks",
    description: "Observed Asana tasks associated with your Black Swan identity. The source is shared, but this view is always filtered to the authenticated user.",
    readOnly: "Read only in Asana",
    readOnlyDetail: "Synchronization refreshes evidence from the Asana workspace. It never changes Asana or automatically converts observations into canonical Black Swan tasks.",
    accountingNote: "These counts are evidence classes, not a total of current tasks. Historical snapshots remain separate under Tasks → Asana reconciliation and are not mixed into this personal view.",
    current2026: "Verified 2026",
    legacyOpen: "Older open",
    privateObserved: "Private observed",
    unclassified: "Date unverified",
    searchPlaceholder: "Search my tasks",
    allProjects: "All my projects",
    allEvidence: "All evidence",
    sync: "Refresh from Asana",
    syncing: "Syncing…",
    syncSuccess: "Asana synced",
    syncNotConfigured: "ASANA_ACCESS_TOKEN is not configured in production.",
    syncForbidden: "Your session cannot refresh Asana evidence.",
    syncFailed: "Asana could not be synchronized.",
    freshest: "Latest observation",
    identity: "User",
    tasksTitle: "My observed tasks",
    tasksDetail: "Only tasks whose Asana assignee matches the Asana account explicitly linked to your Black Swan identity are shown.",
    noTasks: "No Asana tasks are associated with this user.",
    projectUnknown: "No project",
    exact: "Exact GID",
    favorite: "Favorites",
    api: "Asana API",
    browserOnly: "Historical observation",
    unknownSource: "Observed source",
    due: "Due",
    lastSeen: "Observed",
    open: "Open",
    loadError: "Asana evidence could not be loaded.",
    identityError: "The current user identity could not be resolved.",
  },
  de: {
    title: "Meine Asana-Aufgaben",
    description: "Beobachtete Asana-Aufgaben, die Ihrer Black-Swan-Identität zugeordnet sind. Die Quelle ist gemeinsam, diese Ansicht wird jedoch immer auf den angemeldeten Benutzer gefiltert.",
    readOnly: "Nur Lesen in Asana",
    readOnlyDetail: "Die Synchronisierung aktualisiert Evidenz aus dem Asana-Workspace. Sie ändert Asana nie und wandelt Beobachtungen nicht automatisch in kanonische Black-Swan-Aufgaben um.",
    accountingNote: "Diese Zähler sind Evidenzklassen und keine Summe aktueller Aufgaben. Historische Snapshots bleiben unter Aufgaben → Asana-Abgleich getrennt und werden nicht mit dieser persönlichen Ansicht vermischt.",
    current2026: "2026 verifiziert",
    legacyOpen: "Älter offen",
    privateObserved: "Privat beobachtet",
    unclassified: "Datum nicht verifiziert",
    searchPlaceholder: "Meine Aufgaben durchsuchen",
    allProjects: "Alle meine Projekte",
    allEvidence: "Alle Evidenz",
    sync: "Aus Asana aktualisieren",
    syncing: "Synchronisierung…",
    syncSuccess: "Asana synchronisiert",
    syncNotConfigured: "ASANA_ACCESS_TOKEN ist in Produktion nicht konfiguriert.",
    syncForbidden: "Ihre Sitzung darf Asana-Evidenz nicht aktualisieren.",
    syncFailed: "Asana konnte nicht synchronisiert werden.",
    freshest: "Letzte Beobachtung",
    identity: "Benutzer",
    tasksTitle: "Meine beobachteten Aufgaben",
    tasksDetail: "Es werden nur Aufgaben angezeigt, deren Asana-Verantwortlicher dem ausdrücklich mit Ihrer Black-Swan-Identität verknüpften Asana-Konto entspricht.",
    noTasks: "Diesem Benutzer sind keine Asana-Aufgaben zugeordnet.",
    projectUnknown: "Ohne Projekt",
    exact: "Exakte GID",
    favorite: "Favoriten",
    api: "Asana API",
    browserOnly: "Historische Beobachtung",
    unknownSource: "Beobachtete Quelle",
    due: "Fällig",
    lastSeen: "Beobachtet",
    open: "Offen",
    loadError: "Asana-Evidenz konnte nicht geladen werden.",
    identityError: "Die Identität des aktuellen Benutzers konnte nicht ermittelt werden.",
  },
} as const

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase()
}

function safeDate(value: string | null) {
  return value ? new Date(`${value}T12:00:00`) : null
}

function observationClass(row: LiveObservation): Exclude<RecencyFilter, "all"> {
  if (row.recency_class === "current_2026") return "current_2026"
  if (row.recency_class === "legacy_open") return "legacy_open"
  if (row.recency_class === "browser_only") return "browser_only"
  return "unclassified"
}

function linkedAsanaEmail(identity: CurrentIdentity) {
  const mapped = ASANA_EMAIL_BY_EMPLOYEE[normalize(identity.employeeName)]
  if (mapped) return mapped

  const exactBlackSwanEmail = [identity.email, identity.employeeEmail]
    .map(normalize)
    .find((email) => email.endsWith("@blackswn.org"))

  return exactBlackSwanEmail || null
}

function belongsToIdentity(row: LiveObservation, identity: CurrentIdentity) {
  const asanaEmail = normalize(row.collaborator_label)
  const asanaName = normalize(row.assignee_label)
  const employeeName = normalize(identity.employeeName)
  const linkedEmail = linkedAsanaEmail(identity)

  if (linkedEmail && asanaEmail) return asanaEmail === linkedEmail
  if (linkedEmail && !asanaEmail && employeeName && asanaName) return asanaName === employeeName
  if (!linkedEmail && employeeName && asanaName) return asanaName === employeeName

  return false
}

export default function AsanaLivePage() {
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const locale = LOCALES[lang]
  const supabase = useMemo(() => createBrowserClient(), [])
  const [identity, setIdentity] = useState<CurrentIdentity | null>(null)
  const [observations, setObservations] = useState<LiveObservation[]>([])
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>("all")
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError(copy.identityError)
      setLoading(false)
      return
    }

    const [profileResult, taskResult] = await Promise.all([
      supabase
        .from("user_access_profiles")
        .select("email,employee_id,employees(name,email)")
        .eq("user_id", authData.user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("asana_live_observations")
        .select("id,task_title,task_status,project_name,project_url,due_on,start_on,assignee_label,assignee_external_id,collaborator_label,external_task_id,recency_class,source_surface,source_surface_url,last_seen_at")
        .eq("task_status", "open")
        .order("last_seen_at", { ascending: false }),
    ])

    if (profileResult.error || taskResult.error) {
      console.error("asana personal load failed", profileResult.error ?? taskResult.error)
      setError(copy.loadError)
      setLoading(false)
      return
    }

    const profile = profileResult.data as {
      email: string | null
      employees: { name: string | null; email: string | null } | Array<{ name: string | null; email: string | null }> | null
    } | null
    const employee = Array.isArray(profile?.employees) ? profile?.employees[0] ?? null : profile?.employees ?? null
    const resolvedIdentity: CurrentIdentity = {
      email: profile?.email || authData.user.email || "",
      employeeName: employee?.name ?? null,
      employeeEmail: employee?.email ?? null,
    }

    setIdentity(resolvedIdentity)
    setObservations(((taskResult.data ?? []) as LiveObservation[]).filter((row) => belongsToIdentity(row, resolvedIdentity)))
    setLoading(false)
  }, [copy.identityError, copy.loadError, supabase])

  const sync = useCallback(async () => {
    setSyncing(true)
    setSyncMessage(null)
    setSyncError(null)
    try {
      const response = await fetch("/api/asana-live/sync", { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSyncError(payload.status === "not_configured" ? copy.syncNotConfigured : payload.status === "forbidden" ? copy.syncForbidden : copy.syncFailed)
        return
      }
      setSyncMessage(`${copy.syncSuccess}: ${payload.synced ?? 0}/${payload.observed ?? 0}`)
      await load()
    } catch (syncFailure) {
      console.error("asana workspace sync failed", syncFailure)
      setSyncError(copy.syncFailed)
    } finally {
      setSyncing(false)
    }
  }, [copy.syncFailed, copy.syncForbidden, copy.syncNotConfigured, copy.syncSuccess, load])

  useEffect(() => {
    void load()
  }, [load])

  const projectNames = useMemo(
    () => [...new Set(observations.map((row) => row.project_name).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, locale)),
    [locale, observations],
  )

  const filtered = useMemo(() => {
    const needle = normalize(search)
    return observations
      .filter((row) => projectFilter === "all" || row.project_name === projectFilter)
      .filter((row) => recencyFilter === "all" || observationClass(row) === recencyFilter)
      .filter((row) => !needle || normalize(row.task_title).includes(needle) || normalize(row.project_name).includes(needle))
      .sort((a, b) => {
        const dueA = a.due_on ?? "9999-12-31"
        const dueB = b.due_on ?? "9999-12-31"
        if (dueA !== dueB) return dueA.localeCompare(dueB)
        return (a.project_name ?? "").localeCompare(b.project_name ?? "", locale) || a.task_title.localeCompare(b.task_title, locale)
      })
  }, [locale, observations, projectFilter, recencyFilter, search])

  const current2026Count = observations.filter((row) => observationClass(row) === "current_2026").length
  const legacyOpenCount = observations.filter((row) => observationClass(row) === "legacy_open").length
  const privateObservedCount = observations.filter((row) => observationClass(row) === "browser_only").length
  const unclassifiedCount = observations.filter((row) => observationClass(row) === "unclassified").length
  const freshest = observations.reduce<string | null>((latest, row) => (!latest || row.last_seen_at > latest ? row.last_seen_at : latest), null)
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Santiago" }), [locale])
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }), [locale])

  const recencyOptions: Array<{ value: RecencyFilter; label: string }> = [
    { value: "all", label: copy.allEvidence },
    { value: "current_2026", label: copy.current2026 },
    { value: "legacy_open", label: copy.legacyOpen },
    { value: "browser_only", label: copy.privateObserved },
    { value: "unclassified", label: copy.unclassified },
  ]

  const identityLabel = identity?.employeeName || identity?.email || "—"

  return (
    <AppLayout>
      <div className="space-y-6 p-4 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-medium text-accent sm:text-3xl">{copy.title}</h1>
              <Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5" />{copy.readOnly}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.description}</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{copy.identity}: {identityLabel}</span>
              {freshest && <span>{copy.freshest}: {dateTime.format(new Date(freshest))}</span>}
            </div>
          </div>
          <Button variant="outline" onClick={() => void sync()} disabled={syncing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? copy.syncing : copy.sync}
          </Button>
        </div>

        <div className="border-l-2 border-primary/60 bg-primary/5 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{copy.readOnly}</p>
          <p className="mt-1">{copy.readOnlyDetail}</p>
          <p className="mt-2 font-medium text-foreground">{copy.accountingNote}</p>
        </div>

        {error && <div className="flex gap-3 border-l-2 border-destructive bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {syncError && <div className="flex gap-3 border-l-2 border-destructive bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{syncError}</div>}
        {syncMessage && <div className="border-l-2 border-primary bg-primary/5 p-4 text-sm">{syncMessage}</div>}

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 lg:grid-cols-4">
          <Metric icon={CheckCircle2} label={copy.current2026} value={current2026Count} locale={locale} />
          <Metric icon={AlertCircle} label={copy.legacyOpen} value={legacyOpenCount} locale={locale} />
          <Metric icon={UserRound} label={copy.privateObserved} value={privateObservedCount} locale={locale} />
          <Metric icon={Calendar} label={copy.unclassified} value={unclassifiedCount} locale={locale} />
        </div>

        <section className="min-w-0">
          <div className="flex flex-col gap-3 border-b pb-4">
            <div>
              <h2 className="text-base font-medium">{copy.tasksTitle}</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.tasksDetail}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchPlaceholder} className="h-9 w-full border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
              </label>
              <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-9 border bg-background px-3 text-sm outline-none focus:border-primary">
                <option value="all">{copy.allProjects}</option>
                {projectNames.map((project) => <option key={project} value={project}>{project}</option>)}
              </select>
              <select value={recencyFilter} onChange={(event) => setRecencyFilter(event.target.value as RecencyFilter)} className="h-9 border bg-background px-3 text-sm outline-none focus:border-primary">
                {recencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{copy.noTasks}</div>
          ) : (
            <div className="divide-y">
              {filtered.map((row) => {
                const due = safeDate(row.due_on)
                const rowClass = observationClass(row)
                const recencyLabel = rowClass === "current_2026" ? copy.current2026 : rowClass === "legacy_open" ? copy.legacyOpen : rowClass === "browser_only" ? copy.privateObserved : copy.unclassified
                const sourceLabel = row.external_task_id ? copy.api : row.source_surface === "asana_favorites_project" ? copy.favorite : rowClass === "browser_only" ? copy.browserOnly : copy.unknownSource
                const href = row.source_surface_url || row.project_url
                return (
                  <article key={row.id} className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium leading-snug">{row.task_title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{row.project_name || copy.projectUnknown}</p>
                      </div>
                      <Badge variant="outline">{copy.open}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{recencyLabel}</Badge>
                      <Badge variant="outline">{sourceLabel}</Badge>
                      {row.external_task_id && <Badge variant="outline">{copy.exact}</Badge>}
                    </div>
                    <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                      {due && <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{copy.due}: {date.format(due)}</p>}
                      <p>{copy.lastSeen}: {dateTime.format(new Date(row.last_seen_at))}</p>
                      {row.external_task_id && <p className="font-mono">GID {row.external_task_id}</p>}
                    </div>
                    {href && <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Asana <ExternalLink className="h-3 w-3" /></a>}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

function Metric({ icon: Icon, label, value, locale }: { icon: typeof CheckCircle2; label: string; value: number; locale: string }) {
  return <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{new Intl.NumberFormat(locale).format(value)}</p></div><Icon className="mt-1 h-4 w-4 text-muted-foreground" /></div>
}

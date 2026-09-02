"use client"

import Link from "next/link"
import { Activity, Clock3, Database, RefreshCcw, ShieldCheck, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { useLanguage } from "@/lib/hooks/use-language"

export type ItJobHealth = {
  job_key: string
  active: boolean
  schedule: string
  last_run_at: string | null
  last_success_at: string | null
  running_count: number
  due_retry_count: number
  dead_letter_count: number
  health: "healthy" | "degraded" | "stuck" | "broken" | string
}

export type ItJobRun = {
  id: string
  job_key: string
  trigger_source: string
  status: string
  attempt: number
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  retry_after: string | null
  recovered_at: string | null
  dead_lettered_at: string | null
  error_code: string | null
  metrics: Record<string, unknown> | null
}

export type ItControlSnapshot = {
  observed_at: string
  viewer: { role: string; has_it_scope: boolean }
  jobs: ItJobHealth[]
  recent_runs: ItJobRun[]
  security: {
    public_tables: number
    rls_enabled: number
    rls_disabled: number
    tables_without_policies: number
    tables_without_policy_names: string[]
    broad_all_policy_tables: number
    public_role_policy_tables: number
    authenticated_role_policy_tables: number
  }
  access: {
    active_profiles: number
    disabled_profiles: number
    admin_users: number
    approver_users: number
    it_scoped_users: number
  }
}

const copy = {
  es: {
    title: "IT Control Center",
    description: "Salud operativa, jobs, acceso y controles de plataforma con datos leídos en vivo desde producción.",
    unavailable: "Telemetría no disponible",
    unavailableDescription: "El snapshot privilegiado no pudo cargarse. No se muestran valores aproximados ni datos cacheados.",
    overall: "Estado global",
    jobs: "Jobs activos",
    healthy: "Saludables",
    retries: "Retries vencidos",
    deadLetters: "Dead letters",
    registry: "Jobs y freshness",
    registryDescription: "Estado calculado desde el registry canónico y las ejecuciones reales.",
    job: "Job",
    schedule: "Schedule UTC",
    lastSuccess: "Último éxito",
    running: "Running",
    dueRetries: "Retry",
    dead: "Dead",
    recent: "Ejecuciones recientes",
    recentDescription: "Últimas 30 ejecuciones. El panel es sólo lectura.",
    status: "Estado",
    attempt: "Intento",
    source: "Origen",
    started: "Inicio",
    duration: "Duración",
    error: "Error",
    database: "Seguridad de base",
    databaseDescription: "Fotografía live del esquema público. RLS sin políticas directas es fail-closed, no acceso abierto.",
    publicTables: "tablas públicas",
    rlsEnabled: "RLS activo",
    rlsDisabled: "RLS desactivado",
    noPolicies: "sin políticas directas",
    broadPolicies: "ALL amplias",
    access: "Acceso interno",
    accessDescription: "Perfiles activos y scope IT desde las tablas canónicas de acceso.",
    activeProfiles: "Perfiles activos",
    admins: "Admins",
    approvers: "Approvers",
    itUsers: "Scope IT",
    observed: "Observado",
    back: "Volver a Administración",
  },
  en: {
    title: "IT Control Center",
    description: "Operational health, jobs, access and platform controls read live from production.",
    unavailable: "Telemetry unavailable",
    unavailableDescription: "The privileged snapshot could not be loaded. No approximate or cached values are shown.",
    overall: "Overall health",
    jobs: "Active jobs",
    healthy: "Healthy",
    retries: "Due retries",
    deadLetters: "Dead letters",
    registry: "Jobs and freshness",
    registryDescription: "Status calculated from the canonical registry and real executions.",
    job: "Job",
    schedule: "Schedule UTC",
    lastSuccess: "Last success",
    running: "Running",
    dueRetries: "Retry",
    dead: "Dead",
    recent: "Recent executions",
    recentDescription: "Latest 30 executions. This surface is read-only.",
    status: "Status",
    attempt: "Attempt",
    source: "Source",
    started: "Started",
    duration: "Duration",
    error: "Error",
    database: "Database security",
    databaseDescription: "Live public-schema snapshot. RLS without direct policies is fail-closed, not open access.",
    publicTables: "public tables",
    rlsEnabled: "RLS enabled",
    rlsDisabled: "RLS disabled",
    noPolicies: "without direct policies",
    broadPolicies: "broad ALL",
    access: "Internal access",
    accessDescription: "Active profiles and IT scope from canonical access tables.",
    activeProfiles: "Active profiles",
    admins: "Admins",
    approvers: "Approvers",
    itUsers: "IT scope",
    observed: "Observed",
    back: "Back to Administration",
  },
  de: {
    title: "IT-Kontrollzentrum",
    description: "Betriebszustand, Jobs, Zugriff und Plattformkontrollen live aus der Produktion.",
    unavailable: "Telemetrie nicht verfügbar",
    unavailableDescription: "Der privilegierte Snapshot konnte nicht geladen werden. Es werden keine geschätzten Werte angezeigt.",
    overall: "Gesamtzustand",
    jobs: "Aktive Jobs",
    healthy: "Gesund",
    retries: "Fällige Retries",
    deadLetters: "Dead Letters",
    registry: "Jobs und Aktualität",
    registryDescription: "Status aus kanonischem Registry und realen Ausführungen.",
    job: "Job",
    schedule: "Schedule UTC",
    lastSuccess: "Letzter Erfolg",
    running: "Running",
    dueRetries: "Retry",
    dead: "Dead",
    recent: "Letzte Ausführungen",
    recentDescription: "Letzte 30 Ausführungen. Diese Ansicht ist schreibgeschützt.",
    status: "Status",
    attempt: "Versuch",
    source: "Quelle",
    started: "Start",
    duration: "Dauer",
    error: "Fehler",
    database: "Datenbanksicherheit",
    databaseDescription: "Live-Snapshot des öffentlichen Schemas. RLS ohne direkte Policies ist fail-closed.",
    publicTables: "öffentliche Tabellen",
    rlsEnabled: "RLS aktiv",
    rlsDisabled: "RLS deaktiviert",
    noPolicies: "ohne direkte Policies",
    broadPolicies: "breite ALL",
    access: "Interner Zugriff",
    accessDescription: "Aktive Profile und IT-Scope aus kanonischen Zugriffstabellen.",
    activeProfiles: "Aktive Profile",
    admins: "Admins",
    approvers: "Approver",
    itUsers: "IT-Scope",
    observed: "Beobachtet",
    back: "Zurück zur Administration",
  },
} as const

const healthRank: Record<string, number> = { healthy: 0, degraded: 1, stuck: 2, broken: 3 }

function formatDate(value: string | null, locale: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" }).format(date)
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy" || status === "succeeded") return "secondary"
  if (status === "broken" || status === "failed" || status === "dead_letter") return "destructive"
  return "outline"
}

export function ItControlCenter({ snapshot, errorMessage }: { snapshot: ItControlSnapshot | null; errorMessage?: string | null }) {
  const { language } = useLanguage()
  const text = copy[language]
  const locale = language === "es" ? "es-CL" : language === "de" ? "de-DE" : "en-US"

  if (!snapshot) {
    return (
      <>
        <PageHeader title={text.title} description={text.description} />
        <div className="space-y-4 p-4 md:p-8">
          <Card className="border-destructive/50">
            <CardHeader><CardTitle>{text.unavailable}</CardTitle><CardDescription>{text.unavailableDescription}</CardDescription></CardHeader>
            {errorMessage && <CardContent><p className="text-sm text-muted-foreground">{errorMessage}</p></CardContent>}
          </Card>
          <Link href={`/${language}/admin`} className="text-sm font-medium underline-offset-4 hover:underline">← {text.back}</Link>
        </div>
      </>
    )
  }

  const activeJobs = snapshot.jobs.filter((job) => job.active)
  const healthyJobs = activeJobs.filter((job) => job.health === "healthy").length
  const dueRetries = activeJobs.reduce((sum, job) => sum + Number(job.due_retry_count || 0), 0)
  const deadLetters = activeJobs.reduce((sum, job) => sum + Number(job.dead_letter_count || 0), 0)
  const overall = activeJobs.reduce((worst, job) => (healthRank[job.health] ?? 1) > (healthRank[worst] ?? 0) ? job.health : worst, "healthy")

  return (
    <>
      <PageHeader title={text.title} description={text.description} />
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/${language}/admin`} className="text-sm text-muted-foreground hover:text-foreground">← {text.back}</Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{text.observed}: {formatDate(snapshot.observed_at, locale)}</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Activity} label={text.overall} value={overall.toUpperCase()} status={overall} />
          <MetricCard icon={RefreshCcw} label={text.jobs} value={activeJobs.length} />
          <MetricCard icon={ShieldCheck} label={text.healthy} value={healthyJobs} />
          <MetricCard icon={RefreshCcw} label={text.retries} value={dueRetries} status={dueRetries > 0 ? "degraded" : "healthy"} />
          <MetricCard icon={Activity} label={text.deadLetters} value={deadLetters} status={deadLetters > 0 ? "broken" : "healthy"} />
        </div>

        <Card>
          <CardHeader><CardTitle>{text.registry}</CardTitle><CardDescription>{text.registryDescription}</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-3">{text.job}</th><th className="p-3">{text.status}</th><th className="p-3">{text.schedule}</th><th className="p-3">{text.lastSuccess}</th><th className="p-3 text-right">{text.running}</th><th className="p-3 text-right">{text.dueRetries}</th><th className="p-3 text-right">{text.dead}</th></tr></thead>
              <tbody>{snapshot.jobs.map((job) => <tr key={job.job_key} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{job.job_key}</td><td className="p-3"><Badge variant={statusVariant(job.health)}>{job.health}</Badge></td><td className="p-3 font-mono text-xs">{job.schedule}</td><td className="p-3">{formatDate(job.last_success_at, locale)}</td><td className="p-3 text-right">{job.running_count}</td><td className="p-3 text-right">{job.due_retry_count}</td><td className="p-3 text-right">{job.dead_letter_count}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{text.database}</CardTitle><CardDescription>{text.databaseDescription}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniMetric label={text.publicTables} value={snapshot.security.public_tables} />
                <MiniMetric label={text.rlsEnabled} value={snapshot.security.rls_enabled} />
                <MiniMetric label={text.rlsDisabled} value={snapshot.security.rls_disabled} />
                <MiniMetric label={text.broadPolicies} value={snapshot.security.broad_all_policy_tables} />
              </div>
              <div className="rounded-md border p-3"><p className="text-sm font-medium">{snapshot.security.tables_without_policies} {text.noPolicies}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{snapshot.security.tables_without_policy_names.join(" · ") || "—"}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{text.access}</CardTitle><CardDescription>{text.accessDescription}</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniMetric label={text.activeProfiles} value={snapshot.access.active_profiles} />
              <MiniMetric label={text.admins} value={snapshot.access.admin_users} />
              <MiniMetric label={text.approvers} value={snapshot.access.approver_users} />
              <MiniMetric label={text.itUsers} value={snapshot.access.it_scoped_users} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{text.recent}</CardTitle><CardDescription>{text.recentDescription}</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-3">{text.job}</th><th className="p-3">{text.status}</th><th className="p-3">{text.attempt}</th><th className="p-3">{text.source}</th><th className="p-3">{text.started}</th><th className="p-3">{text.duration}</th><th className="p-3">{text.error}</th></tr></thead>
              <tbody>{snapshot.recent_runs.map((run) => <tr key={run.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{run.job_key}</td><td className="p-3"><Badge variant={statusVariant(run.status)}>{run.status}</Badge></td><td className="p-3">{run.attempt}</td><td className="p-3">{run.trigger_source}</td><td className="p-3">{formatDate(run.started_at, locale)}</td><td className="p-3">{formatDuration(run.duration_ms)}</td><td className="p-3 font-mono text-xs">{run.error_code || "—"}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function MetricCard({ icon: Icon, label, value, status }: { icon: typeof Activity; label: string; value: string | number; status?: string }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div>{status && <Badge className="mt-2" variant={statusVariant(status)}>{status}</Badge>}</CardContent></Card>
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border p-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
}

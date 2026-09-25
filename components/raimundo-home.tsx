"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Beef, CalendarDays, CheckSquare, Grape, HeartPulse, Hotel, Leaf, RefreshCw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { loadAuthorizedNavigation, type AuthorizedNavItem } from "@/lib/os/authorized-navigation-client"
import { RoleAgenticBrief } from "@/components/role-agentic-brief"

type Counts = {
  approvals: number
  escalated: number
  activeAnimals: number
  healthAlerts: number
  vineyardPlots: number
  vineyardCritical: number
  orchardOpenTasks: number
  arrivalsToday: number
  departuresToday: number
  openGuestRequests: number
}

const COPY = {
  es: {
    eyebrow: "RAIMUNDO · FOCO DE TRABAJO",
    title: "Aprobaciones, Booking y operación del campo",
    subtitle: "Como administrador del campo, Raimundo mantiene una vista amplia. Aprobaciones primero; luego Booking y Hospitality; después Ganadería, Viñedo y Huerto. Los demás módulos siguen disponibles.",
    approvalsTitle: "Aprobaciones",
    approvalsBody: "Revisa primero el centro de costo sugerido, acéptalo o cámbialo. Si no tienes certeza, escala el caso a Santiago.",
    pending: "Pendientes conmigo",
    escalated: "Escaladas a Santiago",
    openApprovals: "Abrir aprobaciones",
    bookingTitle: "Booking y Hospitality",
    bookingBody: "Calendario completo de reservas, llegadas, salidas y solicitudes de huéspedes.",
    arrivals: "Llegadas hoy",
    departures: "Salidas hoy",
    openGuestRequests: "Solicitudes abiertas",
    openCalendar: "Abrir calendario",
    openRequests: "Solicitudes de huéspedes",
    cattleTitle: "Ganadería",
    cattleBody: "Estado del ganado, alertas de salud y seguimiento operativo del Fundo Corcovado.",
    animals: "Animales activos",
    alerts: "Alertas de salud",
    openCattle: "Abrir ganadería",
    openHealth: "Salud ganadera",
    vineyardTitle: "Viñedo",
    vineyardBody: "Cuarteles, condición fitosanitaria y seguimiento técnico del viñedo.",
    plots: "Cuarteles registrados",
    critical: "Incidencias críticas",
    openVineyard: "Abrir viñedo",
    openPests: "Plagas y enfermedades",
    orchardTitle: "Huerto",
    orchardBody: "Operación semanal, planificación, camas, cultivos y seguimiento del huerto.",
    openOrchard: "Abrir huerto",
    openWeek: "Semana operativa",
    other: "Otros espacios",
    otherBody: "Módulos secundarios disponibles cuando los necesites.",
    refresh: "Actualizar",
  },
  en: {
    eyebrow: "RAIMUNDO · WORK FOCUS",
    title: "Approvals, Booking and field operations",
    subtitle: "As field administrator, Raimundo keeps a broad view. Approvals first; then Booking and Hospitality; then Cattle, Vineyard and Orchard. All other authorized modules remain available.",
    approvalsTitle: "Approvals",
    approvalsBody: "Review the suggested cost center first, accept it or change it. If you are unsure, escalate the case to Santiago.",
    pending: "Pending with me",
    escalated: "Escalated to Santiago",
    openApprovals: "Open approvals",
    bookingTitle: "Booking and Hospitality",
    bookingBody: "Full reservation calendar, arrivals, departures and guest requests.",
    arrivals: "Arrivals today",
    departures: "Departures today",
    openGuestRequests: "Open requests",
    openCalendar: "Open calendar",
    openRequests: "Guest requests",
    cattleTitle: "Cattle",
    cattleBody: "Herd status, health alerts and operational follow-up for Fundo Corcovado.",
    animals: "Active animals",
    alerts: "Health alerts",
    openCattle: "Open cattle",
    openHealth: "Cattle health",
    vineyardTitle: "Vineyard",
    vineyardBody: "Blocks, phytosanitary condition and technical vineyard follow-up.",
    plots: "Registered blocks",
    critical: "Critical incidents",
    openVineyard: "Open vineyard",
    openPests: "Pests and diseases",
    orchardTitle: "Orchard",
    orchardBody: "Weekly operation, planning, beds, crops and orchard follow-up.",
    openOrchard: "Open orchard",
    openWeek: "Weekly operation",
    other: "Other workspaces",
    otherBody: "Secondary modules remain available when needed.",
    refresh: "Refresh",
  },
  de: {
    eyebrow: "RAIMUNDO · ARBEITSFOKUS",
    title: "Freigaben, Buchungen und Feldbetrieb",
    subtitle: "Als Feldadministrator behält Raimundo eine breite Sicht. Zuerst Freigaben, dann Buchungen und Hospitality, danach Rinderhaltung, Weinberg und Obstgarten. Weitere berechtigte Module bleiben verfügbar.",
    approvalsTitle: "Freigaben",
    approvalsBody: "Vorgeschlagene Kostenstelle zuerst prüfen, bestätigen oder ändern. Bei Unsicherheit an Santiago eskalieren.",
    pending: "Bei mir offen",
    escalated: "An Santiago eskaliert",
    openApprovals: "Freigaben öffnen",
    bookingTitle: "Buchungen und Hospitality",
    bookingBody: "Vollständiger Reservierungskalender, Anreisen, Abreisen und Gästeanfragen.",
    arrivals: "Anreisen heute",
    departures: "Abreisen heute",
    openGuestRequests: "Offene Anfragen",
    openCalendar: "Kalender öffnen",
    openRequests: "Gästeanfragen",
    cattleTitle: "Rinderhaltung",
    cattleBody: "Bestandsstatus, Gesundheitswarnungen und operative Nachverfolgung für Fundo Corcovado.",
    animals: "Aktive Tiere",
    alerts: "Gesundheitswarnungen",
    openCattle: "Rinderhaltung öffnen",
    openHealth: "Tiergesundheit",
    vineyardTitle: "Weinberg",
    vineyardBody: "Blöcke, Pflanzengesundheit und technische Nachverfolgung des Weinbergs.",
    plots: "Registrierte Blöcke",
    critical: "Kritische Vorfälle",
    openVineyard: "Weinberg öffnen",
    openPests: "Schädlinge und Krankheiten",
    orchardTitle: "Obstgarten",
    orchardBody: "Wochenbetrieb, Planung, Beete, Kulturen und operative Nachverfolgung.",
    openOrchard: "Obstgarten öffnen",
    openWeek: "Wochenbetrieb",
    other: "Weitere Bereiche",
    otherBody: "Sekundäre Module bleiben bei Bedarf verfügbar.",
    refresh: "Aktualisieren",
  },
} as const

function localized(language: "es" | "en" | "de", path: string) {
  return `/${language}${path}`
}

export function RaimundoHome() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const locale = language === "en" || language === "de" ? language : "es"
  const copy = COPY[locale]
  const [counts, setCounts] = useState<Counts>({
    approvals: 0,
    escalated: 0,
    activeAnimals: 0,
    healthAlerts: 0,
    vineyardPlots: 0,
    vineyardCritical: 0,
    orchardOpenTasks: 0,
    arrivalsToday: 0,
    departuresToday: 0,
    openGuestRequests: 0,
  })
  const [otherItems, setOtherItems] = useState<AuthorizedNavItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())
    const through = new Date()
    through.setDate(through.getDate() + 7)
    const throughDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(through)
    const [approvalResult, escalatedResult, animalsResult, healthResult, plotsResult, pestResult, orchardTasksResult, arrivalsResult, departuresResult, guestRequestsResult, navigationResult] = await Promise.all([
      supabase
        .from("finance_documents")
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["ready", "pending_mapping"])
        .or("cost_center_escalation_status.neq.pending_santiago,cost_center_escalation_status.is.null"),
      supabase
        .from("finance_documents")
        .select("id", { count: "exact", head: true })
        .eq("cost_center_escalation_status", "pending_santiago"),
      supabase
        .from("cattle_animals")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("cattle_health_alerts")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false),
      supabase
        .from("vineyard_plots")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("vineyard_pest_logs")
        .select("id", { count: "exact", head: true })
        .in("severity_level", ["critical", "high"]),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("operational_area", ["orchard", "huerto_vinedo"])
        .gte("due_date", today)
        .lte("due_date", throughDate)
        .not("status", "in", "(completada,completado,completed,done,cancelada,cancelado,cancelled,canceled)"),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("check_in", today)
        .not("status", "in", "(cancelled,checked_out,checked-out)"),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("check_out", today)
        .not("status", "in", "(cancelled,checked_out,checked-out)"),
      supabase
        .from("hospitality_requests")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(completed,resolved,cancelled)"),
      loadAuthorizedNavigation().catch(() => ({ items: [] })),
    ])

    setCounts({
      approvals: approvalResult.count ?? 0,
      escalated: escalatedResult.count ?? 0,
      activeAnimals: animalsResult.count ?? 0,
      healthAlerts: healthResult.count ?? 0,
      vineyardPlots: plotsResult.count ?? 0,
      vineyardCritical: pestResult.count ?? 0,
      orchardOpenTasks: orchardTasksResult.count ?? 0,
      arrivalsToday: arrivalsResult.count ?? 0,
      departuresToday: departuresResult.count ?? 0,
      openGuestRequests: guestRequestsResult.count ?? 0,
    })

    const primaryKeys = new Set(["approvals", "bookings", "guest-requests", "cattle", "cattle-health", "vineyard", "orchard"])
    setOtherItems((navigationResult.items ?? []).filter((item) => !primaryKeys.has(item.key)).slice(0, 8))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("raimundo-home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_documents" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "cattle_animals" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "cattle_health_alerts" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "vineyard_plots" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "vineyard_pest_logs" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  return (
    <div>
      <section className="border-b border-border px-4 py-5 md:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{copy.eyebrow}</p>
            <h1 className="mt-1 text-2xl font-medium text-foreground">{copy.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />{copy.refresh}
          </Button>
        </div>
      </section>

      <RoleAgenticBrief
        persona="raimundo"
        signals={[
          {
            key: "finance-approvals",
            count: counts.approvals,
            title: copy.approvalsTitle,
            task: `revisar ${counts.approvals} gastos pendientes, validar primero su centro de costo y dejar lista la decisión de Raimundo`,
            operationalArea: "finance",
            severity: counts.approvals > 0 ? "attention" : "normal",
          },
          {
            key: "guest-requests",
            count: counts.openGuestRequests,
            title: copy.openGuestRequests,
            task: `coordinar ${counts.openGuestRequests} solicitudes abiertas de huéspedes y asignar seguimiento operativo`,
            operationalArea: "hospitality",
            severity: counts.openGuestRequests > 0 ? "attention" : "normal",
          },
          {
            key: "field-admin-round",
            count: counts.healthAlerts + counts.vineyardCritical + counts.orchardOpenTasks,
            title: "Ronda diaria del campo",
            task: `hacer la ronda diaria del campo: ${counts.healthAlerts} alertas ganaderas, ${counts.vineyardCritical} incidencias críticas/altas de viñedo y ${counts.orchardOpenTasks} tareas abiertas de huerto para los próximos 7 días; revisar, priorizar y dejar seguimiento operativo`,
            operationalArea: "field_admin",
            severity: counts.healthAlerts + counts.vineyardCritical > 0 ? "attention" : "normal",
            priority: 95,
          },
        ]}
      />

      <section className="px-4 py-5 md:px-6">
        <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-2 2xl:grid-cols-5">
          <div className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <CheckSquare className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">01 · PRIORIDAD</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{copy.approvalsTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.approvalsBody}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Metric label={copy.pending} value={counts.approvals} emphasis={counts.approvals > 0} />
              <Metric label={copy.escalated} value={counts.escalated} />
            </div>
            <Link href={localized(locale, "/budgets/approvals")} className="mt-3 flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
              <span className="flex items-center gap-2"><CheckSquare className="h-4 w-4 text-primary" />{copy.openApprovals}</span><ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Hotel className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">02 · PRIORIDAD</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{copy.bookingTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.bookingBody}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
              <Metric label={copy.arrivals} value={counts.arrivalsToday} />
              <Metric label={copy.departures} value={counts.departuresToday} />
              <Metric label={copy.openGuestRequests} value={counts.openGuestRequests} emphasis={counts.openGuestRequests > 0} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link href={localized(locale, "/bookings/calendar")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{copy.openCalendar}</span><ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={localized(locale, "/bookings/requests")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><Hotel className="h-4 w-4 text-primary" />{copy.openRequests}</span><ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Beef className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">03 · PRIORIDAD</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{copy.cattleTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.cattleBody}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Metric label={copy.animals} value={counts.activeAnimals} />
              <Metric label={copy.alerts} value={counts.healthAlerts} emphasis={counts.healthAlerts > 0} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link href={localized(locale, "/cattle")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><Beef className="h-4 w-4 text-primary" />{copy.openCattle}</span><ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={localized(locale, "/cattle-health")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-primary" />{copy.openHealth}</span><ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Grape className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">04 · PRIORIDAD</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{copy.vineyardTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.vineyardBody}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Metric label={copy.plots} value={counts.vineyardPlots} />
              <Metric label={copy.critical} value={counts.vineyardCritical} emphasis={counts.vineyardCritical > 0} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link href={localized(locale, "/vineyard")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><Grape className="h-4 w-4 text-primary" />{copy.openVineyard}</span><ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={localized(locale, "/vineyard/pests")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" />{copy.openPests}</span><ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Leaf className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">05 · PRIORIDAD</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{copy.orchardTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.orchardBody}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link href={localized(locale, "/orchard/dashboard")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><Leaf className="h-4 w-4 text-primary" />{copy.openOrchard}</span><ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={localized(locale, "/orchard/work/week-board")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><CheckSquare className="h-4 w-4 text-primary" />{copy.openWeek}</span><ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {otherItems.length > 0 && (
        <section className="px-4 pb-8 md:px-6">
          <div className="mx-auto max-w-[1600px]">
            <details className="border border-border bg-card">
              <summary className="cursor-pointer list-none p-5">
                <p className="text-sm font-medium text-foreground">{copy.other}</p>
                <p className="mt-1 text-xs text-muted-foreground">{copy.otherBody}</p>
              </summary>
              <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
                {otherItems.map((item) => (
                  <Link key={item.key} href={localized(locale, item.href)} className="flex items-center justify-between border border-border p-3 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
                    <span>{item.label}</span><ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </section>
      )}
    </div>
  )
}

function Metric({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`border p-4 ${emphasis ? "border-amber-400/40 bg-amber-400/5" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-medium ${emphasis ? "text-amber-500" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

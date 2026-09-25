"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, BedDouble, CalendarDays, CreditCard, FileCheck2, FolderOpen, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { loadAuthorizedNavigation, type AuthorizedNavItem } from "@/lib/os/authorized-navigation-client"
import { SantiagoTodayCommandCenter } from "@/components/santiago-today-command-center"
import { RoleAgenticBrief } from "@/components/role-agentic-brief"

type WorkspaceCounts = {
  escalatedCenters: number
  pendingPayments: number
  readyToPay: number
  openGuestRequests: number
  pendingHousekeeping: number
}

const COPY = {
  es: {
    eyebrow: "SANTIAGO · FOCO DE TRABAJO",
    title: "Booking y documentos primero",
    subtitle: "La vista diaria prioriza reservas, excepciones operativas y documentos que requieren tu intervención. El resto del sistema queda disponible sin competir por atención.",
    bookingTitle: "Booking",
    bookingBody: "Calendario, llegadas, salidas y solicitudes de huéspedes.",
    calendar: "Abrir calendario",
    requests: "Solicitudes",
    financeTitle: "Documentos y pagos",
    financeBody: "Primero resuelve centros escalados por Raimundo; después autoriza o registra pagos ya aprobados.",
    escalated: "Centros por resolver",
    pending: "Pagos por autorizar",
    ready: "Listos para pagar",
    openFinance: "Abrir bandeja financiera",
    other: "Otros espacios",
    otherBody: "Módulos secundarios disponibles para consulta cuando los necesites.",
    refresh: "Actualizar",
  },
  en: {
    eyebrow: "SANTIAGO · WORK FOCUS",
    title: "Booking and documents first",
    subtitle: "The daily view prioritizes reservations, operational exceptions and documents that need your intervention. Everything else stays available without competing for attention.",
    bookingTitle: "Booking",
    bookingBody: "Calendar, arrivals, departures and guest requests.",
    calendar: "Open calendar",
    requests: "Guest requests",
    financeTitle: "Documents and payments",
    financeBody: "Resolve cost-center exceptions escalated by Raimundo first; then authorize or record already-approved payments.",
    escalated: "Centers to resolve",
    pending: "Payments to authorize",
    ready: "Ready to pay",
    openFinance: "Open finance queue",
    other: "Other workspaces",
    otherBody: "Secondary modules remain available when needed.",
    refresh: "Refresh",
  },
  de: {
    eyebrow: "SANTIAGO · ARBEITSFOKUS",
    title: "Buchungen und Dokumente zuerst",
    subtitle: "Die Tagesansicht priorisiert Reservierungen, operative Ausnahmen und Dokumente, die deine Entscheidung brauchen. Andere Bereiche bleiben verfügbar, ohne abzulenken.",
    bookingTitle: "Buchungen",
    bookingBody: "Kalender, Anreisen, Abreisen und Gästeanfragen.",
    calendar: "Kalender öffnen",
    requests: "Gästeanfragen",
    financeTitle: "Dokumente und Zahlungen",
    financeBody: "Zuerst von Raimundo eskalierte Kostenstellen lösen; danach bereits genehmigte Zahlungen autorisieren oder erfassen.",
    escalated: "Kostenstellen zu lösen",
    pending: "Zahlungen zu autorisieren",
    ready: "Zahlbereit",
    openFinance: "Finanzwarteschlange öffnen",
    other: "Weitere Bereiche",
    otherBody: "Sekundäre Module bleiben bei Bedarf verfügbar.",
    refresh: "Aktualisieren",
  },
} as const

function localized(language: "es" | "en" | "de", path: string) {
  return `/${language}${path}`
}

export function SantiagoHome() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const locale = language === "en" || language === "de" ? language : "es"
  const copy = COPY[locale]
  const [counts, setCounts] = useState<WorkspaceCounts>({
    escalatedCenters: 0,
    pendingPayments: 0,
    readyToPay: 0,
    openGuestRequests: 0,
    pendingHousekeeping: 0,
  })
  const [otherItems, setOtherItems] = useState<AuthorizedNavItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())
    const [escalatedResult, pendingResult, readyResult, guestRequestsResult, housekeepingResult, navigationResult] = await Promise.all([
      supabase
        .from("finance_documents")
        .select("id", { count: "exact", head: true })
        .eq("cost_center_escalation_status", "pending_santiago"),
      supabase
        .from("finance_documents")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "pending_santiago"),
      supabase
        .from("finance_documents")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "authorized"),
      supabase
        .from("hospitality_requests")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(completed,resolved,cancelled)"),
      supabase
        .from("housekeeping_tasks")
        .select("id", { count: "exact", head: true })
        .eq("service_date", today)
        .not("status", "in", "(completed,cancelled)"),
      loadAuthorizedNavigation().catch(() => ({ items: [] })),
    ])

    setCounts({
      escalatedCenters: escalatedResult.count ?? 0,
      pendingPayments: pendingResult.count ?? 0,
      readyToPay: readyResult.count ?? 0,
      openGuestRequests: guestRequestsResult.count ?? 0,
      pendingHousekeeping: housekeepingResult.count ?? 0,
    })

    const secondaryKeys = new Set(["bookings", "guest-requests", "payments"])
    setOtherItems((navigationResult.items ?? []).filter((item) => !secondaryKeys.has(item.key)).slice(0, 8))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("santiago-home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_documents" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void load())
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

      <SantiagoTodayCommandCenter />

      <RoleAgenticBrief
        persona="santiago"
        signals={[
          {
            key: "guest-requests",
            count: counts.openGuestRequests,
            title: copy.requests,
            task: `coordinar ${counts.openGuestRequests} solicitudes abiertas de huéspedes y asegurar responsable y seguimiento`,
            operationalArea: "hospitality",
            severity: counts.openGuestRequests > 0 ? "attention" : "normal",
          },
          {
            key: "housekeeping-today",
            count: counts.pendingHousekeeping,
            title: "Housekeeping pendiente",
            task: `coordinar ${counts.pendingHousekeeping} tareas de housekeeping pendientes para hoy`,
            operationalArea: "hospitality",
            severity: counts.pendingHousekeeping > 0 ? "attention" : "normal",
          },
          {
            key: "cost-center-exceptions",
            count: counts.escalatedCenters,
            title: copy.escalated,
            task: `revisar y resolver ${counts.escalatedCenters} centros de costo escalados por Raimundo`,
            operationalArea: "finance",
            severity: counts.escalatedCenters > 0 ? "attention" : "normal",
          },
          {
            key: "payments-to-authorize",
            count: counts.pendingPayments,
            title: copy.pending,
            task: `revisar ${counts.pendingPayments} pagos pendientes de autorización, sin aprobarlos automáticamente`,
            operationalArea: "finance",
            severity: counts.pendingPayments > 0 ? "attention" : "normal",
          },
          {
            key: "payments-ready",
            count: counts.readyToPay,
            title: copy.ready,
            task: `preparar seguimiento de ${counts.readyToPay} pagos autorizados listos para ejecución`,
            operationalArea: "finance",
          },
        ]}
      />

      <section className="px-4 py-5 md:px-6">
        <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-2">
          <div className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <BedDouble className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">01 · PRIORIDAD</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{copy.bookingTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.bookingBody}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link href={localized(locale, "/bookings/calendar")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{copy.calendar}</span><ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={localized(locale, "/bookings/requests")} className="flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
                <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" />{copy.requests}</span><ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">02 · PRIORIDAD</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{copy.financeTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.financeBody}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <FinanceMetric label={copy.escalated} value={counts.escalatedCenters} emphasis={counts.escalatedCenters > 0} />
              <FinanceMetric label={copy.pending} value={counts.pendingPayments} emphasis={counts.pendingPayments > 0} />
              <FinanceMetric label={copy.ready} value={counts.readyToPay} />
            </div>

            <Link href={localized(locale, "/budgets/payments")} className="mt-3 flex items-center justify-between border border-border p-4 text-sm font-medium hover:bg-secondary/40">
              <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />{copy.openFinance}</span><ArrowRight className="h-4 w-4" />
            </Link>
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

function FinanceMetric({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`border p-4 ${emphasis ? "border-amber-400/40 bg-amber-400/5" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-medium ${emphasis ? "text-amber-500" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

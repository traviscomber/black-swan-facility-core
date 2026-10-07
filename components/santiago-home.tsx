"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CreditCard, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { loadAuthorizedNavigation, type AuthorizedNavItem, type AuthorizedNavigation } from "@/lib/os/authorized-navigation-client"
import { SantiagoTodayCommandCenter } from "@/components/santiago-today-command-center"
import { RoleAgenticBrief } from "@/components/role-agentic-brief"
import { SantiagoOperationsCockpit } from "@/components/santiago-operations-cockpit"

type WorkspaceCounts = {
  escalatedCenters: number
  pendingPayments: number
  readyToPay: number
  openGuestRequests: number
  pendingHousekeeping: number
  unassignedGuestRequests: number
}

const COPY = {
  es: {
    eyebrow: "SANTIAGO",
    title: "Operación",
    subtitle: "",
    bookingTitle: "Reservas",
    bookingBody: "",
    calendar: "Calendario",
    requests: "Solicitudes",
    financeTitle: "Finanzas",
    financeBody: "",
    escalated: "Centros por resolver",
    pending: "Pagos por autorizar",
    ready: "Listos para pagar",
    openFinance: "Ver pagos",
    other: "Ver más",
    otherBody: "",
    refresh: "Actualizar",
  },
  en: {
    eyebrow: "SANTIAGO",
    title: "Operations",
    subtitle: "",
    bookingTitle: "Bookings",
    bookingBody: "",
    calendar: "Calendar",
    requests: "Guest requests",
    financeTitle: "Finance",
    financeBody: "",
    escalated: "Centers to resolve",
    pending: "Payments to authorize",
    ready: "Ready to pay",
    openFinance: "View payments",
    other: "View more",
    otherBody: "",
    refresh: "Refresh",
  },
  de: {
    eyebrow: "SANTIAGO",
    title: "Betrieb",
    subtitle: "",
    bookingTitle: "Buchungen",
    bookingBody: "",
    calendar: "Kalender",
    requests: "Gästeanfragen",
    financeTitle: "Finanzen",
    financeBody: "",
    escalated: "Kostenstellen zu lösen",
    pending: "Zahlungen zu autorisieren",
    ready: "Zahlbereit",
    openFinance: "Zahlungen",
    other: "Mehr",
    otherBody: "",
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
    unassignedGuestRequests: 0,
  })
  const [nextUnassignedRequestId, setNextUnassignedRequestId] = useState<string | null>(null)
  const [otherItems, setOtherItems] = useState<AuthorizedNavItem[]>([])
  const [navigation, setNavigation] = useState<AuthorizedNavigation>({ items: [] })
  const [nextArrival, setNextArrival] = useState<{ id: string; guest_name: string; check_in: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())
    const [escalatedResult, pendingResult, readyResult, guestRequestsResult, unassignedGuestRequestsResult, nextUnassignedResult, housekeepingResult, nextArrivalResult, navigationResult] = await Promise.all([
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
        .from("hospitality_requests")
        .select("id", { count: "exact", head: true })
        .is("assigned_to", null)
        .not("status", "in", "(completed,resolved,cancelled)"),
      supabase
        .from("hospitality_requests")
        .select("id")
        .is("assigned_to", null)
        .not("status", "in", "(completed,resolved,cancelled)")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("housekeeping_tasks")
        .select("id", { count: "exact", head: true })
        .eq("service_date", today)
        .not("status", "in", "(completed,cancelled)"),
      supabase
        .from("reservations")
        .select("id,guest_name,check_in")
        .gte("check_in", today)
        .not("status", "in", "(cancelled,checked_out,checked-out)")
        .order("check_in", { ascending: true })
        .limit(1)
        .maybeSingle(),
      loadAuthorizedNavigation().catch(() => ({ items: [] })),
    ])

    setCounts({
      escalatedCenters: escalatedResult.count ?? 0,
      pendingPayments: pendingResult.count ?? 0,
      readyToPay: readyResult.count ?? 0,
      openGuestRequests: guestRequestsResult.count ?? 0,
      pendingHousekeeping: housekeepingResult.count ?? 0,
      unassignedGuestRequests: unassignedGuestRequestsResult.count ?? 0,
    })
    setNextUnassignedRequestId(nextUnassignedResult.data?.id ?? null)
    setNextArrival(
      nextArrivalResult.data
        ? {
            id: nextArrivalResult.data.id,
            guest_name: nextArrivalResult.data.guest_name,
            check_in: nextArrivalResult.data.check_in,
          }
        : null,
    )

    setNavigation(navigationResult)
    const secondaryKeys = new Set(["bookings", "guest-requests", "payments", "tasks"])
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
      <SantiagoTodayCommandCenter />

      <section className="px-4 py-4 md:px-6">
        <div className="mx-auto max-w-[1600px]">
          <SantiagoOperationsCockpit language={locale} navigation={navigation} />
        </div>
      </section>

      <section className="px-4 pb-8 md:px-6">
        <div className="mx-auto max-w-[1600px]">
          <details className="border border-border bg-card">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
              <span>{copy.other}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </summary>

            <div className="space-y-4 border-t border-border p-4">
              <RoleAgenticBrief
                persona="santiago"
                signals={[
                  {
                    key: "prepare-next-arrival",
                    count: nextArrival ? 1 : 0,
                    title: nextArrival ? `Preparar llegada · ${nextArrival.guest_name}` : "Preparar próxima llegada",
                    task: nextArrival
                      ? `preparar la llegada de ${nextArrival.guest_name} para ${nextArrival.check_in}`
                      : "preparar la próxima llegada",
                    operationalArea: "hospitality",
                    severity: nextArrival ? "attention" : "normal",
                    priority: 100,
                    capability: nextArrival ? "hospitality.prepare_arrival" : undefined,
                    reservationId: nextArrival?.id ?? null,
                  },
                  {
                    key: "guest-requests-unassigned",
                    count: counts.unassignedGuestRequests,
                    title: `${copy.requests} · sin responsable`,
                    task: `asignar seguimiento a ${counts.unassignedGuestRequests} solicitudes de huéspedes sin responsable`,
                    operationalArea: "hospitality",
                    severity: counts.unassignedGuestRequests > 0 ? "attention" : "normal",
                    priority: 90,
                    capability: nextUnassignedRequestId ? "hospitality.assign_request" : undefined,
                    requestId: nextUnassignedRequestId,
                  },
                  {
                    key: "housekeeping-today",
                    count: counts.pendingHousekeeping,
                    title: "Housekeeping pendiente",
                    task: `coordinar ${counts.pendingHousekeeping} tareas de housekeeping pendientes para hoy`,
                    operationalArea: "hospitality",
                    severity: counts.pendingHousekeeping > 0 ? "attention" : "normal",
                    priority: 80,
                  },
                  {
                    key: "cost-center-exceptions",
                    count: counts.escalatedCenters,
                    title: copy.escalated,
                    task: `revisar y resolver ${counts.escalatedCenters} centros de costo escalados por Raimundo`,
                    operationalArea: "finance",
                    severity: counts.escalatedCenters > 0 ? "attention" : "normal",
                    priority: 70,
                  },
                  {
                    key: "payments-to-authorize",
                    count: counts.pendingPayments,
                    title: copy.pending,
                    task: `revisar ${counts.pendingPayments} pagos pendientes de autorización, sin aprobarlos automáticamente`,
                    operationalArea: "finance",
                    severity: counts.pendingPayments > 0 ? "attention" : "normal",
                    priority: 60,
                  },
                ]}
              />

              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="grid grid-cols-3 gap-2">
                  <FinanceMetric label={copy.escalated} value={counts.escalatedCenters} emphasis={counts.escalatedCenters > 0} />
                  <FinanceMetric label={copy.pending} value={counts.pendingPayments} emphasis={counts.pendingPayments > 0} />
                  <FinanceMetric label={copy.ready} value={counts.readyToPay} />
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={localized(locale, "/budgets/payments")}><CreditCard className="mr-2 h-4 w-4" />{copy.openFinance}</Link>
                </Button>
              </div>

              {otherItems.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {otherItems.map((item) => (
                    <Link key={item.key} href={localized(locale, item.href)} className="flex min-h-11 items-center justify-between border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
                      <span>{item.label}</span><ArrowRight className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      </section>
    </div>
  )
}

}

function FinanceMetric({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`border p-4 ${emphasis ? "border-amber-400/40 bg-amber-400/5" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-medium ${emphasis ? "text-amber-500" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

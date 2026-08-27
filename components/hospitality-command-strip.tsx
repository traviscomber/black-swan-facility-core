"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronDown, ConciergeBell, DoorOpen, FileCheck2, LogIn, LogOut, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type HospitalityPulse = {
  arrivals: number
  departures: number
  arrivalsNotReady: number
  openRequests: number
  blockingExceptions: number
}

type ExceptionRow = {
  reservation_id: string
  title: string
  detail: string | null
  exception_state: string
  blocks_check_in: boolean
  blocks_check_out: boolean
}

const EMPTY_PULSE: HospitalityPulse = {
  arrivals: 0,
  departures: 0,
  arrivalsNotReady: 0,
  openRequests: 0,
  blockingExceptions: 0,
}

function chileOperatingDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function HospitalityCommandStrip() {
  const supabase = useMemo(() => createClient(), [])
  const [pulse, setPulse] = useState<HospitalityPulse>(EMPTY_PULSE)
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [canApproveFinance, setCanApproveFinance] = useState(false)
  const [financeApprovalCount, setFinanceApprovalCount] = useState<number | null>(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = chileOperatingDate()

    const financePermissionResult = await supabase.rpc("can_finance_approve")
    const financeAllowed = !financePermissionResult.error && Boolean(financePermissionResult.data)
    setCanApproveFinance(financeAllowed)
    if (!financeAllowed) setFinanceApprovalCount(0)

    const [arrivalsResult, departuresResult, requestsResult, exceptionsResult, financeResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("id", { count: "exact" })
        .eq("check_in", today)
        .not("status", "in", "(cancelled,canceled,void,voided)"),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("check_out", today)
        .not("status", "in", "(cancelled,canceled,void,voided)"),
      supabase
        .from("hospitality_requests")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(completed,resolved,cancelled,canceled)"),
      supabase
        .from("reservation_operational_exceptions")
        .select("reservation_id,title,detail,exception_state,blocks_check_in,blocks_check_out", { count: "exact" })
        .in("exception_state", ["open", "overdue"])
        .or("blocks_check_in.eq.true,blocks_check_out.eq.true")
        .limit(12),
      financeAllowed
        ? supabase.from("finance_approval_queue").select("id", { count: "exact", head: true }).eq("approval_status", "ready")
        : Promise.resolve({ count: 0, error: null }),
    ])

    const firstError = arrivalsResult.error || departuresResult.error || requestsResult.error || exceptionsResult.error
    if (firstError) {
      setPulse(EMPTY_PULSE)
      setExceptions([])
      setError(firstError.message)
      setLoading(false)
      return
    }

    const arrivalIds = (arrivalsResult.data ?? []).map((row) => row.id)
    let arrivalsNotReady = 0
    if (arrivalIds.length > 0) {
      const readinessResult = await supabase
        .from("reservation_room_readiness")
        .select("reservation_id", { count: "exact", head: true })
        .in("reservation_id", arrivalIds)
        .eq("is_ready_for_checkin", false)
      if (readinessResult.error) {
        setPulse(EMPTY_PULSE)
        setExceptions([])
        setError(readinessResult.error.message)
        setLoading(false)
        return
      }
      arrivalsNotReady = readinessResult.count ?? 0
    }

    const nextExceptions = (exceptionsResult.data ?? []) as ExceptionRow[]
    setPulse({
      arrivals: arrivalsResult.count ?? arrivalIds.length,
      departures: departuresResult.count ?? 0,
      arrivalsNotReady,
      openRequests: requestsResult.count ?? 0,
      blockingExceptions: exceptionsResult.count ?? nextExceptions.length,
    })
    setExceptions(nextExceptions)
    if (financeAllowed) setFinanceApprovalCount(financeResult.error ? null : financeResult.count ?? 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("hospitality-command-strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_tasks" }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const attentionCount = pulse.arrivalsNotReady + pulse.openRequests + pulse.blockingExceptions

  return (
    <section className="border-b border-border/50 bg-[var(--bs-bg-secondary)]">
      <div className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-2 md:px-4">
        <div className="mr-1 flex items-center gap-2">
          <ConciergeBell className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Hospitality hoy</span>
          {attentionCount > 0 && <Badge variant="destructive">{attentionCount} atención</Badge>}
        </div>

        <PulseLink href="/bookings" icon={<LogIn className="h-3.5 w-3.5" />} label="Llegadas" value={pulse.arrivals} />
        <PulseLink href="/bookings" icon={<DoorOpen className="h-3.5 w-3.5" />} label="No listas" value={pulse.arrivalsNotReady} warning={pulse.arrivalsNotReady > 0} />
        <PulseLink href="/bookings" icon={<LogOut className="h-3.5 w-3.5" />} label="Salidas" value={pulse.departures} />
        <PulseLink href="/bookings/requests" icon={<ConciergeBell className="h-3.5 w-3.5" />} label="Solicitudes" value={pulse.openRequests} warning={pulse.openRequests > 0} />
        {canApproveFinance && <PulseLink href="/budgets/approvals" icon={<FileCheck2 className="h-3.5 w-3.5" />} label="Aprobaciones" value={financeApprovalCount ?? "—"} warning={(financeApprovalCount ?? 0) > 0} />}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted ${pulse.blockingExceptions > 0 ? "border-amber-500/40 text-amber-700 dark:text-amber-300" : "border-border text-muted-foreground"}`}
          aria-expanded={open}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Bloqueos {pulse.blockingExceptions}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <Button type="button" variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={() => void load()} disabled={loading} aria-label="Actualizar pulso de Hospitality">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && <div className="border-t border-destructive/20 px-4 py-2 text-xs text-destructive">No fue posible actualizar el pulso de Hospitality: {error}</div>}

      {open && (
        <div className="border-t border-border/40 px-4 py-3">
          {exceptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay excepciones que bloqueen check-in o check-out.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {exceptions.map((item) => (
                <article key={`${item.reservation_id}-${item.title}`} className="border border-amber-500/25 bg-amber-500/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <Badge variant="outline">{item.exception_state}</Badge>
                  </div>
                  {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
                  <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {item.blocks_check_in ? "Bloquea check-in" : ""}{item.blocks_check_in && item.blocks_check_out ? " · " : ""}{item.blocks_check_out ? "Bloquea check-out" : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function PulseLink({ href, icon, label, value, warning = false }: { href: string; icon: React.ReactNode; label: string; value: number | string; warning?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted ${warning ? "border-amber-500/40 text-amber-700 dark:text-amber-300" : "border-border text-muted-foreground"}`}
    >
      {icon}
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </Link>
  )
}

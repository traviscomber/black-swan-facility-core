"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/hooks/use-language"
import { createClient } from "@/lib/supabase/client"

type ExceptionRow = {
  reservation_id: string
  domain: string
  source_id: string
  title: string
  status: string
  priority: string | null
  due_at: string | null
  exception_state: string
  blocks_check_in: boolean
  blocks_check_out: boolean
  room_id: string | null
  detail: string | null
}

const COPY = {
  en: {
    title: "Operational exceptions",
    subtitle: "Reservations with blockers, overdue lifecycle states, or conditions that require human review.",
    refresh: "Refresh",
    loading: "Checking operational exceptions…",
    empty: "No blocking exceptions are visible for your access.",
    partial: "The exceptions could not be refreshed. Try again.",
    total: "Open exceptions",
    critical: "Critical",
    overdue: "Overdue",
    blocksIn: "Blocks check-in",
    blocksOut: "Blocks check-out",
    review: "Review reservation",
    noDetail: "No additional detail",
  },
  es: {
    title: "Excepciones operacionales",
    subtitle: "Reservas con bloqueos, ciclos vencidos o condiciones que requieren revisión humana.",
    refresh: "Actualizar",
    loading: "Revisando excepciones operacionales…",
    empty: "No hay excepciones bloqueantes visibles para tu acceso.",
    partial: "No fue posible actualizar las excepciones. Intenta nuevamente.",
    total: "Excepciones abiertas",
    critical: "Críticas",
    overdue: "Vencidas",
    blocksIn: "Bloquea check-in",
    blocksOut: "Bloquea check-out",
    review: "Revisar reserva",
    noDetail: "Sin detalle adicional",
  },
  de: {
    title: "Betriebliche Ausnahmen",
    subtitle: "Reservierungen mit Blockern, überfälligen Lebenszykluszuständen oder Bedingungen, die eine menschliche Prüfung erfordern.",
    refresh: "Aktualisieren",
    loading: "Betriebliche Ausnahmen werden geprüft…",
    empty: "Für deinen Zugriff sind keine blockierenden Ausnahmen sichtbar.",
    partial: "Die Ausnahmen konnten nicht aktualisiert werden. Bitte erneut versuchen.",
    total: "Offene Ausnahmen",
    critical: "Kritisch",
    overdue: "Überfällig",
    blocksIn: "Blockiert Check-in",
    blocksOut: "Blockiert Check-out",
    review: "Reservierung prüfen",
    noDetail: "Keine zusätzlichen Details",
  },
} as const

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

function priorityRank(priority: string | null) {
  const value = priority?.trim().toLowerCase() ?? ""
  if (["critical", "critica", "crítica", "urgent", "urgente"].includes(value)) return 0
  if (["high", "alta"].includes(value)) return 1
  if (["medium", "normal", "media"].includes(value)) return 2
  return 3
}

export default function BookingExceptionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = COPY[language]
  const [rows, setRows] = useState<ExceptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const result = await supabase
      .from("reservation_operational_exceptions")
      .select("reservation_id,domain,source_id,title,status,priority,due_at,exception_state,blocks_check_in,blocks_check_out,room_id,detail")
      .in("exception_state", ["open", "overdue"])
      .or("blocks_check_in.eq.true,blocks_check_out.eq.true")
      .limit(100)

    if (result.error) {
      console.error("[booking-exceptions] load failed", result.error)
      setRows([])
      setError(true)
    } else {
      const next = (result.data ?? []) as ExceptionRow[]
      next.sort((a, b) => {
        const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority)
        if (priorityDelta !== 0) return priorityDelta
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER
        return aDue - bDue
      })
      setRows(next)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const criticalCount = rows.filter((row) => priorityRank(row.priority) === 0).length
  const overdueCount = rows.filter((row) => row.exception_state === "overdue").length
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(LOCALES[language], {
    dateStyle: "medium",
    timeZone: "America/Santiago",
  }), [language])

  return (
    <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
      <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#211e1a] px-4 py-2">
        <div>
          <h1 className="text-[15px] font-medium tracking-tight">{copy.title}</h1>
          <p className="text-[11px] text-[#8f867b]">{copy.subtitle}</p>
        </div>
        <Button variant="outline" className="h-8 rounded-none" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {copy.refresh}
        </Button>
      </div>

      <div className="grid grid-cols-3 border-b border-white/[0.07] bg-[#211e1a]">
        <div className="px-3 py-2"><p className="text-[10px] uppercase tracking-[0.06em] text-[#8f867b]">{copy.total}</p><p className="text-[17px] font-medium tabular-nums">{rows.length}</p></div>
        <div className="border-l border-white/[0.07] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.06em] text-[#8f867b]">{copy.critical}</p><p className="text-[17px] font-medium tabular-nums">{criticalCount}</p></div>
        <div className="border-l border-white/[0.07] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.06em] text-[#8f867b]">{copy.overdue}</p><p className="text-[17px] font-medium tabular-nums">{overdueCount}</p></div>
      </div>

      {error && <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{copy.partial}</div>}

      {loading ? (
        <div className="px-4 py-10 text-xs text-[#8f867b]">{copy.loading}</div>
      ) : rows.length === 0 && !error ? (
        <div className="m-3 flex items-start gap-3 border border-dashed border-white/[0.08] p-4 text-xs text-[#8f867b]">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{copy.empty}</span>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06] border-b border-white/[0.07]">
          {rows.map((row) => (
            <div key={`${row.domain}-${row.source_id}`} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center hover:bg-white/[0.02]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="font-medium">{row.title}</p>
                  <Badge variant={priorityRank(row.priority) === 0 ? "destructive" : "outline"}>{row.priority ?? row.exception_state}</Badge>
                  {row.exception_state === "overdue" && <Badge variant="destructive">{copy.overdue}</Badge>}
                </div>
                <p className="mt-1 text-xs text-[#8f867b]">
                  {row.detail || copy.noDetail}
                  {row.due_at ? ` · ${dateFormatter.format(new Date(row.due_at))}` : ""}
                </p>
                {(row.blocks_check_in || row.blocks_check_out) && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {row.blocks_check_in ? copy.blocksIn : ""}
                    {row.blocks_check_in && row.blocks_check_out ? " · " : ""}
                    {row.blocks_check_out ? copy.blocksOut : ""}
                  </p>
                )}
              </div>
              <Link href={`/${language}/bookings/reservations/${row.reservation_id}`} className="inline-flex h-8 w-fit items-center gap-2 bg-[#2b2722] px-3 text-xs font-medium text-[#d7d0c6] hover:bg-[#332e28]">
                {copy.review}<ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock3, ShieldAlert, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLanguage, type Language } from "@/lib/hooks/use-language"

type ApprovalRequest = {
  id: string
  action_key: string
  title: string
  summary: string | null
  source_type: string
  requested_by_name: string | null
  priority: "low" | "normal" | "high" | "critical"
  reason: string | null
  execution_error: string | null
  created_at: string
}

type ApprovalDecisionResult = {
  status?: string
  execution_error?: string | null
}

const copy = {
  en: {
    priority: { low: "Low", normal: "Normal", high: "High", critical: "Critical" },
    loadError: "Approvals could not be loaded",
    executionError: "The change could not be executed",
    approved: "Action approved and executed",
    rejected: "Action rejected",
    title: "Approvals · Santiago / Travis",
    subtitle: "Resolve routine operations first; review sensitive exceptions separately",
    quick: "Quick approval",
    exception: "Review exception",
    loading: "Loading decisions…",
    emptyTitle: "No pending decisions",
    emptyBody: "Normal Hospitality operations do not require additional approval. This queue appears only when Santiago or Travis needs to resolve an exception.",
    exceptionHint: "Exception · review before execution",
    routineHint: "Expected operation · quick approval",
    requestedBy: "Requested by",
    operation: "Operations",
    notExecuted: "Not executed",
    executing: "Executing…",
    reviewedApprove: "Reviewed · approve",
    approveExecute: "Approve and execute",
    reject: "Reject",
  },
  es: {
    priority: { low: "Baja", normal: "Normal", high: "Alta", critical: "Crítica" },
    loadError: "No fue posible cargar las aprobaciones",
    executionError: "No fue posible ejecutar el cambio",
    approved: "Acción aprobada y ejecutada",
    rejected: "Acción rechazada",
    title: "Aprobaciones · Santiago / Travis",
    subtitle: "Resolver primero lo operativo; revisar aparte las excepciones sensibles",
    quick: "Aprobación rápida",
    exception: "Revisar excepción",
    loading: "Cargando decisiones…",
    emptyTitle: "Sin decisiones pendientes",
    emptyBody: "La operación normal de Hospitality no necesita aprobación adicional. Esta bandeja aparecerá solo cuando exista una excepción que Santiago o Travis deban resolver.",
    exceptionHint: "Excepción · revisar antes de ejecutar",
    routineHint: "Operación esperada · aprobación rápida",
    requestedBy: "Solicita",
    operation: "Operación",
    notExecuted: "No se ejecutó",
    executing: "Ejecutando…",
    reviewedApprove: "Revisado · aprobar",
    approveExecute: "Aprobar y ejecutar",
    reject: "Rechazar",
  },
  de: {
    priority: { low: "Niedrig", normal: "Normal", high: "Hoch", critical: "Kritisch" },
    loadError: "Freigaben konnten nicht geladen werden",
    executionError: "Die Änderung konnte nicht ausgeführt werden",
    approved: "Aktion freigegeben und ausgeführt",
    rejected: "Aktion abgelehnt",
    title: "Freigaben · Santiago / Travis",
    subtitle: "Routine zuerst erledigen; sensible Ausnahmen getrennt prüfen",
    quick: "Schnellfreigabe",
    exception: "Ausnahme prüfen",
    loading: "Entscheidungen werden geladen…",
    emptyTitle: "Keine ausstehenden Entscheidungen",
    emptyBody: "Der normale Hospitality-Betrieb benötigt keine zusätzliche Freigabe. Diese Warteschlange erscheint nur, wenn Santiago oder Travis eine Ausnahme entscheiden muss.",
    exceptionHint: "Ausnahme · vor Ausführung prüfen",
    routineHint: "Regulärer Vorgang · Schnellfreigabe",
    requestedBy: "Angefordert von",
    operation: "Betrieb",
    notExecuted: "Nicht ausgeführt",
    executing: "Wird ausgeführt…",
    reviewedApprove: "Geprüft · freigeben",
    approveExecute: "Freigeben und ausführen",
    reject: "Ablehnen",
  },
} satisfies Record<Language, {
  priority: Record<ApprovalRequest["priority"], string>
  loadError: string
  executionError: string
  approved: string
  rejected: string
  title: string
  subtitle: string
  quick: string
  exception: string
  loading: string
  emptyTitle: string
  emptyBody: string
  exceptionHint: string
  routineHint: string
  requestedBy: string
  operation: string
  notExecuted: string
  executing: string
  reviewedApprove: string
  approveExecute: string
  reject: string
}>

const CRITICAL_ACTIONS = new Set([
  "booking.cancel",
  "booking.checkin_override",
  "booking.modify",
  "finance.adjust",
  "finance.close_folio",
  "finance.discount",
  "finance.record_payment",
  "finance.reverse_payment",
  "guest.sensitive_data",
  "room.out_of_service",
])

function requiresCarefulReview(item: ApprovalRequest) {
  return item.priority === "critical" || CRITICAL_ACTIONS.has(item.action_key)
}

export function OperationalApprovalQueue() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const c = copy[language]
  const [items, setItems] = useState<ApprovalRequest[]>([])
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("operational_approval_requests")
      .select("id, action_key, title, summary, source_type, requested_by_name, priority, reason, execution_error, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20)

    if (error) toast.error(c.loadError)
    else {
      const rows = (data ?? []) as ApprovalRequest[]
      rows.sort((a, b) => {
        const aCritical = requiresCarefulReview(a)
        const bCritical = requiresCarefulReview(b)
        if (aCritical !== bCritical) return aCritical ? 1 : -1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      setItems(rows)
    }
    setLoading(false)
  }, [c.loadError, supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = supabase
      .channel("operational-approval-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "operational_approval_requests" }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  async function decide(id: string, decision: "approved" | "rejected") {
    setSavingId(id)
    const { data, error } = await supabase.rpc("decide_operational_approval", {
      p_request_id: id,
      p_decision: decision,
      p_notes: null,
    })

    if (error) {
      toast.error(error.message)
    } else {
      const result = (Array.isArray(data) ? data[0] : data) as ApprovalDecisionResult | null
      if (result?.execution_error) {
        toast.error(`${c.executionError}: ${result.execution_error}`)
      } else {
        toast.success(decision === "approved" ? c.approved : c.rejected)
      }
    }

    setSavingId(null)
    await load()
  }

  const quickCount = items.filter((item) => !requiresCarefulReview(item)).length
  const exceptionCount = items.length - quickCount

  return (
    <section className="fixed right-4 top-20 z-40 w-[min(420px,calc(100vw-2rem))] bg-[var(--surface-2)] text-[var(--text-primary)] shadow-none">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Clock3 className="h-4 w-4 text-[var(--primary)]" />
          <div>
            <p className="text-sm font-medium">{c.title}</p>
            <p className="text-xs text-[var(--text-muted)]">{c.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{items.length}</Badge>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="max-h-[55vh] overflow-y-auto bg-[var(--surface-1)] p-3">
          {!loading && items.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{c.quick}</p>
                <p className="mt-1 text-lg font-medium">{quickCount}</p>
              </div>
              <div className="bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{c.exception}</p>
                <p className="mt-1 text-lg font-medium text-[var(--status-warning)]">{exceptionCount}</p>
              </div>
            </div>
          )}

          {loading ? (
            <p className="px-2 py-6 text-sm text-[var(--text-muted)]">{c.loading}</p>
          ) : items.length === 0 ? (
            <div className="px-2 py-6">
              <p className="text-sm font-medium">{c.emptyTitle}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{c.emptyBody}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const careful = requiresCarefulReview(item)
                return (
                  <article key={item.id} className="bg-[var(--surface-2)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {careful ? <ShieldAlert className="h-4 w-4 text-[var(--status-warning)]" /> : <Check className="h-4 w-4 text-[var(--primary)]" />}
                          <p className="text-sm font-medium">{item.title}</p>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {careful ? c.exceptionHint : c.routineHint}
                        </p>
                      </div>
                      <Badge variant="outline">{c.priority[item.priority]}</Badge>
                    </div>

                    {item.summary && <p className="mt-3 text-sm leading-5">{item.summary}</p>}
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{c.requestedBy}: {item.requested_by_name ?? c.operation}{item.reason ? ` · ${item.reason}` : ""}</p>

                    {item.execution_error && (
                      <div className="mt-3 flex gap-2 bg-[var(--surface-3)] p-3 text-xs text-[var(--text-secondary)]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                        <span>{c.notExecuted}: {item.execution_error}</span>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        onClick={() => void decide(item.id, "approved")}
                        disabled={savingId === item.id}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {savingId === item.id ? c.executing : careful ? c.reviewedApprove : c.approveExecute}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void decide(item.id, "rejected")}
                        disabled={savingId === item.id}
                      >
                        <X className="mr-1 h-4 w-4" /> {c.reject}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

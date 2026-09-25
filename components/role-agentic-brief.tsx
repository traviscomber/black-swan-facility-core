"use client"

import { useMemo, useState } from "react"
import { Bot, Check, Loader2, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/hooks/use-language"

type Persona = "santiago" | "raimundo"

export type AgenticSignal = {
  key: string
  count: number
  title: string
  task: string
  operationalArea: string
  severity?: "normal" | "attention"
  capability?: "hospitality.assign_request" | "hospitality.prepare_arrival"
  requestId?: string | null
  reservationId?: string | null
}

type ProposalState = {
  signalKey: string
  proposalId: string
  title: string
} | null

const COPY = {
  es: {
    eyebrow: "AGENTE OPERATIVO",
    title: "Siguiente mejor acción",
    body: "Prioriza señales reales del sistema y prepara acciones internas. Ninguna acción con efecto se ejecuta sin tu confirmación.",
    clear: "Sin acciones críticas sugeridas ahora.",
    prepare: "Preparar acción",
    confirm: "Confirmar y crear tarea",
    preparing: "Preparando…",
    executing: "Ejecutando…",
    done: "Tarea creada",
    failed: "No fue posible completar la acción.",
    guardrail: "Aprobaciones financieras y pagos permanecen fuera de ejecución automática.",
  },
  en: {
    eyebrow: "OPERATIONS AGENT",
    title: "Next best action",
    body: "Prioritizes real system signals and prepares internal actions. No effectful action runs without your confirmation.",
    clear: "No critical suggested actions right now.",
    prepare: "Prepare action",
    confirm: "Confirm and create task",
    preparing: "Preparing…",
    executing: "Executing…",
    done: "Task created",
    failed: "The action could not be completed.",
    guardrail: "Financial approvals and payments remain outside automatic execution.",
  },
  de: {
    eyebrow: "BETRIEBSAGENT",
    title: "Nächste beste Aktion",
    body: "Priorisiert reale Systemsignale und bereitet interne Aktionen vor. Keine wirksame Aktion wird ohne Bestätigung ausgeführt.",
    clear: "Aktuell keine kritischen vorgeschlagenen Aktionen.",
    prepare: "Aktion vorbereiten",
    confirm: "Bestätigen und Aufgabe erstellen",
    preparing: "Wird vorbereitet…",
    executing: "Wird ausgeführt…",
    done: "Aufgabe erstellt",
    failed: "Die Aktion konnte nicht abgeschlossen werden.",
    guardrail: "Finanzfreigaben und Zahlungen bleiben außerhalb der automatischen Ausführung.",
  },
} as const

export function RoleAgenticBrief({ persona, signals }: { persona: Persona; signals: AgenticSignal[] }) {
  const { language } = useLanguage()
  const locale = language === "en" || language === "de" ? language : "es"
  const copy = COPY[locale]
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [proposal, setProposal] = useState<ProposalState>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ranked = useMemo(() => {
    return [...signals]
      .filter((signal) => signal.count > 0)
      .sort((a, b) => {
        const severity = Number(b.severity === "attention") - Number(a.severity === "attention")
        return severity !== 0 ? severity : b.count - a.count
      })
      .slice(0, 3)
  }, [signals])

  async function prepare(signal: AgenticSignal) {
    setBusyKey(signal.key)
    setError(null)
    setCompletedKey(null)
    try {
      const response = await fetch("/api/ai/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          signal.capability === "hospitality.assign_request" && signal.requestId
            ? {
                capability: signal.capability,
                requestId: signal.requestId,
                context: { operationalArea: signal.operationalArea, persona, source: "role_agentic_brief" },
              }
            : signal.capability === "hospitality.prepare_arrival" && signal.reservationId
              ? {
                  capability: signal.capability,
                  reservationId: signal.reservationId,
                  context: { operationalArea: signal.operationalArea, persona, source: "role_agentic_brief" },
                }
              : {
                  message: `crea una tarea para ${signal.task}`,
                  context: { operationalArea: signal.operationalArea, persona, source: "role_agentic_brief" },
                },
        ),
      })
      const result = await response.json()
      if (!response.ok || result?.success !== true || typeof result?.proposalId !== "string") {
        throw new Error(typeof result?.error === "string" ? result.error : copy.failed)
      }
      const proposedName =
        typeof result?.proposedAction?.employeeName === "string" ? result.proposedAction.employeeName : null
      const proposedGuest =
        typeof result?.proposedAction?.guestName === "string" ? result.proposedAction.guestName : null
      setProposal({
        signalKey: signal.key,
        proposalId: result.proposalId,
        title: proposedName
          ? `${signal.title} → ${proposedName}`
          : proposedGuest
            ? `${signal.title} · ${proposedGuest}`
            : signal.title,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failed)
    } finally {
      setBusyKey(null)
    }
  }

  async function execute() {
    if (!proposal) return
    setBusyKey(proposal.signalKey)
    setError(null)
    try {
      const response = await fetch("/api/ai/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.proposalId, confirmed: true }),
      })
      const result = await response.json()
      if (!response.ok || result?.success !== true) {
        throw new Error(typeof result?.error === "string" ? result.error : copy.failed)
      }
      setCompletedKey(proposal.signalKey)
      setProposal(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failed)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1600px] border border-primary/25 bg-primary/5 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-3xl items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{copy.eyebrow}</p>
              <h2 className="mt-1 text-lg font-medium text-foreground">{copy.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />{copy.guardrail}
          </div>
        </div>

        {ranked.length === 0 ? (
          <div className="mt-4 border border-border bg-background/50 p-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{copy.clear}</span>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {ranked.map((signal, index) => {
              const isPrepared = proposal?.signalKey === signal.key
              const isBusy = busyKey === signal.key
              const isDone = completedKey === signal.key
              return (
                <div key={signal.key} className="border border-border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">#{index + 1}</p>
                      <h3 className="mt-1 text-sm font-medium text-foreground">{signal.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{signal.count} pendiente{signal.count === 1 ? "" : "s"}</p>
                    </div>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-4">
                    {isDone ? (
                      <div className="text-xs font-medium text-primary">{copy.done}</div>
                    ) : isPrepared ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{proposal?.title}</p>
                        <Button size="sm" className="w-full" disabled={isBusy} onClick={() => void execute()}>
                        {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        {isBusy ? copy.executing : copy.confirm}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full" disabled={isBusy || Boolean(proposal)} onClick={() => void prepare(signal)}>
                        {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isBusy ? copy.preparing : copy.prepare}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>
    </section>
  )
}

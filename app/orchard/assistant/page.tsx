"use client"

import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import { Bot, CheckCircle2, Database, Send, ShieldCheck, Sparkles, UserRound, XCircle } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: {
    title: "Orchard AI",
    description: "A conversational operations copilot grounded in the Orchard records you are authorized to access.",
    ask: "Ask Orchard",
    placeholder: "Ask about priorities, crops, nursery, harvests, workload, or request a controlled action…",
    send: "Send",
    propose: "Propose action",
    grounded: "Grounded in authorized Orchard data",
    approval: "Writes require your approval",
    safety: "Safety-sensitive treatment instructions stay out of scope",
    answer: "Orchard AI",
    sources: "Data used",
    error: "Orchard AI could not complete the request.",
    proposal: "Action proposal",
    noChanges: "Nothing has been changed yet. Review the proposal before executing it.",
    approve: "Approve & execute",
    reject: "Reject",
    executed: "Executed",
    rejected: "Rejected",
    exactPayload: "Exact proposed payload",
    rationale: "Rationale",
    actionType: "Action type",
    proposalNone: "No safe action was proposed.",
    suggestions: "Try asking",
    ready: "Ready to work with your Orchard data",
    readyHelp: "Ask a question or choose a prompt below. Answers stay grounded in the records available to you.",
    examples: ["What needs attention this week?", "Which crops have missing care records?", "What is ready or close to harvest?", "Create a task for tomorrow to review the nursery transplant queue."],
  },
  es: {
    title: "IA de Orchard",
    description: "Un copiloto operacional conversacional basado en los registros de Orchard que estás autorizado a consultar.",
    ask: "Preguntar a Orchard",
    placeholder: "Pregunta por prioridades, cultivos, vivero, cosechas, carga de trabajo o solicita una acción controlada…",
    send: "Enviar",
    propose: "Proponer acción",
    grounded: "Basado en datos autorizados de Orchard",
    approval: "Las escrituras requieren tu aprobación",
    safety: "Las instrucciones sensibles de tratamiento quedan fuera de alcance",
    answer: "IA de Orchard",
    sources: "Datos usados",
    error: "La IA de Orchard no pudo completar la solicitud.",
    proposal: "Propuesta de acción",
    noChanges: "Aún no se ha cambiado nada. Revisa la propuesta antes de ejecutarla.",
    approve: "Aprobar y ejecutar",
    reject: "Rechazar",
    executed: "Ejecutado",
    rejected: "Rechazado",
    exactPayload: "Payload exacto propuesto",
    rationale: "Razón",
    actionType: "Tipo de acción",
    proposalNone: "No se propuso una acción segura.",
    suggestions: "Prueba preguntando",
    ready: "Listo para trabajar con tus datos de Orchard",
    readyHelp: "Haz una pregunta o elige un prompt. Las respuestas se mantienen ancladas a los registros disponibles para ti.",
    examples: ["¿Qué requiere atención esta semana?", "¿Qué cultivos tienen registros de cuidado incompletos?", "¿Qué está listo o cerca de cosecha?", "Crea una tarea para mañana para revisar la cola de trasplantes."],
  },
} as const

type AssistantResponse = { answer?: string; error?: string; model?: string; sourceCounts?: Record<string, number> }
type Proposal = { id: string; action_type: string; summary: string; rationale: string | null; payload: Record<string, unknown>; status: string; created_at: string }
type ProposalResponse = { proposal?: Proposal | null; explanation?: string; error?: string; model?: string; sourceCounts?: Record<string, number> }
type ExecutionResponse = { proposal_id?: string; status?: string; action_type?: string; entity_id?: string; error?: string }
type ChatTurn = { id: string; question: string; answer: string; model: string; sourceCounts: Record<string, number> }

export default function OrchardAssistantPage() {
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({})
  const [model, setModel] = useState("")
  const [loading, setLoading] = useState(false)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [error, setError] = useState("")
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [proposalMessage, setProposalMessage] = useState("")
  const [execution, setExecution] = useState<ExecutionResponse | null>(null)

  async function ask(event: FormEvent) {
    event.preventDefault()
    const submittedQuestion = question.trim()
    if (!submittedQuestion || loading || proposalLoading) return
    setLoading(true)
    setError("")
    setSourceCounts({})
    try {
      const response = await fetch("/api/orchard/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: submittedQuestion }),
      })
      const payload = await response.json() as AssistantResponse
      if (!response.ok || !payload.answer) throw new Error(payload.error || text.error)
      const nextSources = payload.sourceCounts ?? {}
      const nextModel = payload.model ?? ""
      setTurns((current) => [...current, { id: `${Date.now()}-${current.length}`, question: submittedQuestion, answer: payload.answer as string, model: nextModel, sourceCounts: nextSources }])
      setSourceCounts(nextSources)
      setModel(nextModel)
      setQuestion("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.error)
    } finally {
      setLoading(false)
    }
  }

  async function proposeAction() {
    const submittedQuestion = question.trim()
    if (!submittedQuestion || loading || proposalLoading) return
    setProposalLoading(true)
    setError("")
    setProposal(null)
    setProposalMessage("")
    setExecution(null)
    try {
      const response = await fetch("/api/orchard/actions/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: submittedQuestion }),
      })
      const payload = await response.json() as ProposalResponse
      if (!response.ok) throw new Error(payload.error || text.error)
      setProposal(payload.proposal ?? null)
      setProposalMessage(payload.explanation ?? (payload.proposal ? "" : text.proposalNone))
      setSourceCounts(payload.sourceCounts ?? {})
      setModel(payload.model ?? "")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.error)
    } finally {
      setProposalLoading(false)
    }
  }

  async function decide(decision: "execute" | "reject") {
    if (!proposal || decisionLoading || proposal.status !== "pending") return
    setDecisionLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/orchard/actions/${proposal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const payload = await response.json() as ExecutionResponse
      if (!response.ok) throw new Error(payload.error || text.error)
      setExecution(payload)
      setProposal((current) => current ? { ...current, status: payload.status ?? (decision === "execute" ? "executed" : "rejected") } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.error)
    } finally {
      setDecisionLoading(false)
    }
  }

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <OrchardNavigation />
      <div className="mx-auto w-full max-w-[1500px] space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          <TrustItem icon={<Database className="h-3.5 w-3.5" />} label={text.grounded} />
          <TrustItem icon={<ShieldCheck className="h-3.5 w-3.5" />} label={text.approval} />
          <TrustItem icon={<Sparkles className="h-3.5 w-3.5" />} label={text.safety} />
          {model && <Badge variant="outline" className="ml-auto font-normal">{model}</Badge>}
        </div>

        <div className="grid min-h-[650px] gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="flex min-h-[650px] flex-col overflow-hidden">
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
                <div><CardTitle className="text-base">{text.answer}</CardTitle><CardDescription>{text.grounded}</CardDescription></div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col p-0">
              <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                {turns.length === 0 && !loading ? (
                  <div className="flex min-h-[350px] items-center justify-center">
                    <div className="max-w-xl text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted/20"><Bot className="h-7 w-7 text-primary" /></div>
                      <h2 className="mt-5 text-xl font-semibold">{text.ready}</h2>
                      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{text.readyHelp}</p>
                    </div>
                  </div>
                ) : turns.map((turn) => <ChatTurnView key={turn.id} turn={turn} sourcesLabel={text.sources} />)}

                {loading && <div className="flex gap-3"><Avatar role="assistant" /><div className="rounded-2xl rounded-tl-md border bg-muted/20 px-4 py-3"><div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50 [animation-delay:300ms]" /></div></div></div>}

                {error && <div className="ml-11 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
              </div>

              <div className="border-t bg-card/80 p-3 sm:p-4">
                <form onSubmit={ask} className="rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <Textarea rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text.placeholder} maxLength={2000} className="min-h-[76px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t px-1 pt-2">
                    <span className="px-2 text-[11px] text-muted-foreground">{question.length}/2000</span>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={loading || proposalLoading || !question.trim()} onClick={() => void proposeAction()}><Sparkles className="mr-2 h-4 w-4" />{proposalLoading ? "…" : text.propose}</Button>
                      <Button type="submit" size="sm" disabled={loading || proposalLoading || !question.trim()}><Send className="mr-2 h-4 w-4" />{loading ? "…" : text.send}</Button>
                    </div>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{text.suggestions}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {text.examples.map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} className="group flex w-full items-start gap-3 rounded-xl border bg-muted/10 p-3 text-left text-sm leading-5 transition-colors hover:bg-muted/30"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary/70 transition-transform group-hover:scale-110" /><span>{example}</span></button>)}
              </CardContent>
            </Card>

            {(proposal || proposalMessage) && <Card>
              <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{text.proposal}</CardTitle><CardDescription className="mt-1">{proposal ? text.noChanges : proposalMessage}</CardDescription></div>{proposal && <Badge variant={proposal.status === "pending" ? "secondary" : "outline"}>{proposal.status}</Badge>}</div></CardHeader>
              <CardContent>
                {proposal ? <div className="space-y-4">
                  <Info label={text.actionType} value={proposal.action_type.replaceAll("_", " ")} />
                  <Info label="Summary" value={proposal.summary} />
                  {proposal.rationale && <Info label={text.rationale} value={proposal.rationale} />}
                  <details className="rounded-lg border"><summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{text.exactPayload}</summary><pre className="overflow-x-auto border-t bg-muted/20 p-3 text-[11px] leading-5">{JSON.stringify(proposal.payload, null, 2)}</pre></details>
                  {proposal.status === "pending" ? <div className="grid gap-2"><Button disabled={decisionLoading} onClick={() => void decide("execute")}><CheckCircle2 className="mr-2 h-4 w-4" />{text.approve}</Button><Button variant="outline" disabled={decisionLoading} onClick={() => void decide("reject")}><XCircle className="mr-2 h-4 w-4" />{text.reject}</Button></div> : execution && <div className="rounded-lg border p-3 text-sm"><p className="font-medium">{execution.status === "executed" ? text.executed : text.rejected}</p>{execution.entity_id && <p className="mt-1 break-all text-xs text-muted-foreground">ID: {execution.entity_id}</p>}</div>}
                  {Object.keys(sourceCounts).length > 0 && <SourceCounts label={text.sources} counts={sourceCounts} />}
                </div> : <p className="text-sm text-muted-foreground">{proposalMessage}</p>}
              </CardContent>
            </Card>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function ChatTurnView({ turn, sourcesLabel }: { turn: ChatTurn; sourcesLabel: string }) {
  return <div className="space-y-5">
    <div className="flex justify-end gap-3"><div className="max-w-[82%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">{turn.question}</div><Avatar role="user" /></div>
    <div className="flex gap-3"><Avatar role="assistant" /><div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-md border bg-muted/15 px-4 py-4 sm:px-5"><div className="space-y-3 text-sm leading-6">{formatAnswer(turn.answer)}</div>{Object.keys(turn.sourceCounts).length > 0 && <SourceCounts label={sourcesLabel} counts={turn.sourceCounts} compact />}</div></div>
  </div>
}

function formatAnswer(answer: string) {
  const lines = answer.split("\n").map((line) => line.trim()).filter(Boolean)
  return lines.map((line, index) => {
    const bullet = /^[-•]\s+/.test(line)
    const content = bullet ? line.replace(/^[-•]\s+/, "") : line
    return bullet ? <div key={`${index}-${line}`} className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" /><p>{renderInline(content)}</p></div> : <p key={`${index}-${line}`}>{renderInline(content)}</p>
  })
}

function renderInline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={`${index}-${part}`} className="font-semibold text-foreground">{part.slice(2, -2)}</strong> : <span key={`${index}-${part}`}>{part}</span>)
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${role === "assistant" ? "bg-primary/10 text-primary" : "bg-muted/40"}`}>{role === "assistant" ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</div>
}

function TrustItem({ icon, label }: { icon: ReactNode; label: string }) { return <div className="flex items-center gap-2"><span className="text-primary">{icon}</span><span>{label}</span></div> }

function SourceCounts({ label, counts, compact = false }: { label: string; counts: Record<string, number>; compact?: boolean }) {
  return <div className={compact ? "mt-4 border-t pt-3" : "border-t pt-4"}><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p><div className="flex flex-wrap gap-1.5">{Object.entries(counts).filter(([, count]) => count > 0).map(([source, count]) => <Badge key={source} variant="secondary" className="font-normal">{source.replaceAll("_", " ")}: {count}</Badge>)}</div></div>
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-muted/10 p-3"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }

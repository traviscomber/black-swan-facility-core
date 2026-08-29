"use client"

import { FormEvent, useState } from "react"
import { Bot, CheckCircle2, Send, ShieldCheck, Sparkles, XCircle } from "lucide-react"
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
    description: "Ask operational questions or prepare a controlled action proposal grounded in the Orchard records you are authorized to access.",
    ask: "Ask Orchard",
    placeholder: "What needs attention this week? Or: create a task to inspect Bed 4 tomorrow.",
    send: "Ask",
    propose: "Propose action",
    grounded: "Authorized Orchard data only",
    approval: "Human approval required",
    approvalHelp: "AI never writes directly. A proposal is stored first, its exact payload is shown here, and only your explicit approval can execute it.",
    safety: "Health observations can be summarized, but chemical or dosage instructions are intentionally not generated.",
    answer: "Answer",
    sources: "Data rows considered",
    error: "Orchard AI could not complete the request.",
    proposal: "Action proposal",
    noChanges: "No changes have been made yet.",
    approve: "Approve & execute",
    reject: "Reject",
    executed: "Executed",
    rejected: "Rejected",
    exactPayload: "Exact proposed payload",
    rationale: "Rationale",
    actionType: "Action type",
    proposalNone: "No safe action was proposed.",
    examples: ["What needs attention this week?", "Create a task for tomorrow to review the nursery transplant queue.", "Create a draft game plan for the next spring season.", "Add a direct-sow crop cycle to an existing game plan."],
  },
  es: {
    title: "IA de Orchard",
    description: "Haz preguntas operativas o prepara una propuesta de acción controlada usando sólo los registros de Orchard que puedes ver.",
    ask: "Preguntar a Orchard",
    placeholder: "¿Qué requiere atención esta semana? O: crea una tarea para revisar la cama 4 mañana.",
    send: "Preguntar",
    propose: "Proponer acción",
    grounded: "Sólo datos autorizados de Orchard",
    approval: "Requiere aprobación humana",
    approvalHelp: "La IA nunca escribe directamente. Primero guarda una propuesta, muestra aquí el payload exacto y sólo tu aprobación explícita puede ejecutarla.",
    safety: "Puede resumir observaciones sanitarias, pero no genera instrucciones químicas ni dosificaciones.",
    answer: "Respuesta",
    sources: "Filas de datos consideradas",
    error: "La IA de Orchard no pudo completar la solicitud.",
    proposal: "Propuesta de acción",
    noChanges: "Aún no se ha realizado ningún cambio.",
    approve: "Aprobar y ejecutar",
    reject: "Rechazar",
    executed: "Ejecutado",
    rejected: "Rechazado",
    exactPayload: "Payload exacto propuesto",
    rationale: "Razón",
    actionType: "Tipo de acción",
    proposalNone: "No se propuso una acción segura.",
    examples: ["¿Qué requiere atención esta semana?", "Crea una tarea para mañana para revisar la cola de trasplantes.", "Crea un plan borrador para la próxima primavera.", "Agrega un ciclo de siembra directa a un plan existente."],
  },
} as const

type AssistantResponse = { answer?: string; error?: string; model?: string; sourceCounts?: Record<string, number> }
type Proposal = { id: string; action_type: string; summary: string; rationale: string | null; payload: Record<string, unknown>; status: string; created_at: string }
type ProposalResponse = { proposal?: Proposal | null; explanation?: string; error?: string; model?: string; sourceCounts?: Record<string, number> }
type ExecutionResponse = { proposal_id?: string; status?: string; action_type?: string; entity_id?: string; error?: string }

export default function OrchardAssistantPage() {
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
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
    if (!question.trim() || loading || proposalLoading) return
    setLoading(true)
    setError("")
    setAnswer("")
    setSourceCounts({})
    try {
      const response = await fetch("/api/orchard/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      })
      const payload = await response.json() as AssistantResponse
      if (!response.ok || !payload.answer) throw new Error(payload.error || text.error)
      setAnswer(payload.answer)
      setSourceCounts(payload.sourceCounts ?? {})
      setModel(payload.model ?? "")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.error)
    } finally {
      setLoading(false)
    }
  }

  async function proposeAction() {
    if (!question.trim() || loading || proposalLoading) return
    setProposalLoading(true)
    setError("")
    setProposal(null)
    setProposalMessage("")
    setExecution(null)
    try {
      const response = await fetch("/api/orchard/actions/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: question.trim() }),
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
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card><CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-medium">{text.grounded}</p><p className="mt-1 text-sm text-muted-foreground">{text.description}</p></div></CardContent></Card>
          <Card><CardContent className="flex gap-3 p-4"><Sparkles className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-medium">{text.approval}</p><p className="mt-1 text-sm text-muted-foreground">{text.approvalHelp}</p></div></CardContent></Card>
          <Card><CardContent className="p-4"><p className="font-medium">Operational safety</p><p className="mt-1 text-sm text-muted-foreground">{text.safety}</p></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card className="h-fit">
            <CardHeader><CardTitle>{text.ask}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={ask}>
                <Textarea rows={8} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text.placeholder} maxLength={2000} />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Button type="submit" disabled={loading || proposalLoading || !question.trim()}><Send className="mr-2 h-4 w-4" />{loading ? "…" : text.send}</Button>
                  <Button type="button" variant="outline" disabled={loading || proposalLoading || !question.trim()} onClick={() => void proposeAction()}><Sparkles className="mr-2 h-4 w-4" />{proposalLoading ? "…" : text.propose}</Button>
                </div>
              </form>
              <div className="mt-5 space-y-2">
                {text.examples.map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} className="block w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/30">{example}</button>)}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="min-h-[300px]">
              <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{text.answer}</CardTitle>{model && <Badge variant="outline">{model}</Badge>}</div></CardHeader>
              <CardContent>
                {error ? <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">{error}</div> : answer ? <div className="space-y-5"><div className="whitespace-pre-wrap text-sm leading-7">{answer}</div>{Object.keys(sourceCounts).length > 0 && <SourceCounts label={text.sources} counts={sourceCounts} />}</div> : <div className="flex min-h-[180px] items-center justify-center text-center text-sm text-muted-foreground"><div><Bot className="mx-auto mb-3 h-8 w-8" /><p>{text.placeholder}</p></div></div>}
              </CardContent>
            </Card>

            {(proposal || proposalMessage) && <Card>
              <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{text.proposal}</CardTitle><CardDescription>{proposal ? text.noChanges : proposalMessage}</CardDescription></div>{proposal && <Badge variant={proposal.status === "pending" ? "secondary" : "outline"}>{proposal.status}</Badge>}</div></CardHeader>
              <CardContent>
                {proposal ? <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2"><Info label={text.actionType} value={proposal.action_type.replaceAll("_", " ")} /><Info label="Summary" value={proposal.summary} /></div>
                  {proposal.rationale && <Info label={text.rationale} value={proposal.rationale} />}
                  <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{text.exactPayload}</p><pre className="overflow-x-auto rounded-lg border bg-muted/20 p-4 text-xs leading-6">{JSON.stringify(proposal.payload, null, 2)}</pre></div>
                  {proposal.status === "pending" ? <div className="flex flex-wrap gap-2"><Button disabled={decisionLoading} onClick={() => void decide("execute")}><CheckCircle2 className="mr-2 h-4 w-4" />{text.approve}</Button><Button variant="outline" disabled={decisionLoading} onClick={() => void decide("reject")}><XCircle className="mr-2 h-4 w-4" />{text.reject}</Button></div> : execution && <div className="rounded-lg border p-4 text-sm"><p className="font-medium">{execution.status === "executed" ? text.executed : text.rejected}</p>{execution.entity_id && <p className="mt-1 break-all text-muted-foreground">ID: {execution.entity_id}</p>}</div>}
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

function SourceCounts({ label, counts }: { label: string; counts: Record<string, number> }) {
  return <div className="border-t pt-4"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><div className="flex flex-wrap gap-2">{Object.entries(counts).filter(([, count]) => count > 0).map(([source, count]) => <Badge key={source} variant="secondary">{source}: {count}</Badge>)}</div></div>
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }

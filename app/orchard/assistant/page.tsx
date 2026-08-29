"use client"

import { FormEvent, useState } from "react"
import { Bot, Send, ShieldCheck } from "lucide-react"
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
    description: "Ask operational questions grounded in the Orchard records you are authorized to access.",
    ask: "Ask Orchard",
    placeholder: "What needs attention this week? Which crops are approaching harvest? Where are the traceability gaps?",
    send: "Ask",
    grounded: "Authorized Orchard data only",
    readOnly: "Read-only assistant",
    noActions: "The assistant summarizes, compares and explains. It does not execute field actions or database writes.",
    safety: "Health observations can be summarized, but chemical or dosage instructions are intentionally not generated.",
    answer: "Answer",
    sources: "Data rows considered",
    error: "Orchard AI could not answer the question.",
    examples: ["What needs attention this week?", "Show the planning-to-harvest traceability gaps.", "Which nursery batches are ready?", "Summarize open Orchard tasks and workload."],
  },
  es: {
    title: "IA de Orchard",
    description: "Haz preguntas operativas basadas únicamente en los registros de Orchard que tienes autorización para ver.",
    ask: "Preguntar a Orchard",
    placeholder: "¿Qué requiere atención esta semana? ¿Qué cultivos se acercan a cosecha? ¿Dónde faltan vínculos de trazabilidad?",
    send: "Preguntar",
    grounded: "Sólo datos autorizados de Orchard",
    readOnly: "Asistente de sólo lectura",
    noActions: "El asistente resume, compara y explica. No ejecuta acciones de terreno ni escrituras en la base de datos.",
    safety: "Puede resumir observaciones sanitarias, pero no genera instrucciones químicas ni dosificaciones.",
    answer: "Respuesta",
    sources: "Filas de datos consideradas",
    error: "La IA de Orchard no pudo responder la pregunta.",
    examples: ["¿Qué requiere atención esta semana?", "Muéstrame brechas de trazabilidad desde planificación a cosecha.", "¿Qué almácigos están listos?", "Resume tareas abiertas y carga de trabajo de Orchard."],
  },
} as const

type AssistantResponse = { answer?: string; error?: string; model?: string; sourceCounts?: Record<string, number> }

export default function OrchardAssistantPage() {
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({})
  const [model, setModel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function ask(event: FormEvent) {
    event.preventDefault()
    if (!question.trim() || loading) return
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

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <OrchardNavigation />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card><CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-medium">{text.grounded}</p><p className="mt-1 text-sm text-muted-foreground">{text.description}</p></div></CardContent></Card>
          <Card><CardContent className="flex gap-3 p-4"><Bot className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-medium">{text.readOnly}</p><p className="mt-1 text-sm text-muted-foreground">{text.noActions}</p></div></CardContent></Card>
          <Card><CardContent className="p-4"><p className="font-medium">Operational safety</p><p className="mt-1 text-sm text-muted-foreground">{text.safety}</p></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card className="h-fit">
            <CardHeader><CardTitle>{text.ask}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={ask}>
                <Textarea rows={8} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text.placeholder} maxLength={2000} />
                <Button type="submit" disabled={loading || !question.trim()} className="w-full"><Send className="mr-2 h-4 w-4" />{loading ? "…" : text.send}</Button>
              </form>
              <div className="mt-5 space-y-2">
                {text.examples.map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} className="block w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/30">{example}</button>)}
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[420px]">
            <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{text.answer}</CardTitle>{model && <Badge variant="outline">{model}</Badge>}</div></CardHeader>
            <CardContent>
              {error ? <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">{error}</div> : answer ? <div className="space-y-5"><div className="whitespace-pre-wrap text-sm leading-7">{answer}</div>{Object.keys(sourceCounts).length > 0 && <div className="border-t pt-4"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{text.sources}</p><div className="flex flex-wrap gap-2">{Object.entries(sourceCounts).filter(([, count]) => count > 0).map(([source, count]) => <Badge key={source} variant="secondary">{source}: {count}</Badge>)}</div></div>}</div> : <div className="flex min-h-[280px] items-center justify-center text-center text-sm text-muted-foreground"><div><Bot className="mx-auto mb-3 h-8 w-8" /><p>{text.placeholder}</p></div></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

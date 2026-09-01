"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FormEvent, useMemo, useRef, useState } from "react"
import { Bot, ExternalLink, Send, Trash2, X } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

type Locale = "en" | "es" | "de"
type Turn = { question: string; answer: string }
type StreamEvent = { type?: string; delta?: string; error?: string }

const copy = {
  en: {
    open: "AI Assistant",
    title: "Orchard AI Assistant",
    intro: "Ask about this app or the authorized Orchard data. General farming advice is outside this quick assistant.",
    placeholder: "Write a message…",
    send: "Send",
    clear: "Clear chat",
    close: "Close",
    full: "Open full Orchard AI",
    scope: "Game Plan scoped",
    error: "The assistant could not answer right now.",
  },
  es: {
    open: "Asistente IA",
    title: "Asistente IA de Orchard",
    intro: "Pregunta por esta app o por los datos autorizados de Orchard. La asesoría agrícola general queda fuera de este asistente rápido.",
    placeholder: "Escribe un mensaje…",
    send: "Enviar",
    clear: "Limpiar chat",
    close: "Cerrar",
    full: "Abrir IA Orchard completa",
    scope: "Scope del Plan activo",
    error: "El asistente no pudo responder en este momento.",
  },
  de: {
    open: "AI-Assistent",
    title: "Orchard AI-Assistent",
    intro: "Frage zur App oder zu autorisierten Orchard-Daten. Allgemeine landwirtschaftliche Beratung gehört nicht in diesen Schnellassistenten.",
    placeholder: "Nachricht schreiben…",
    send: "Senden",
    clear: "Chat leeren",
    close: "Schließen",
    full: "Vollständige Orchard AI öffnen",
    scope: "Game-Plan-Scope aktiv",
    error: "Der Assistent konnte gerade nicht antworten.",
  },
} as const

export function OrchardAiDock({ hidden = false }: { hidden?: boolean }) {
  const { language } = useLanguage()
  const locale: Locale = language
  const text = copy[locale]
  const searchParams = useSearchParams()
  const gamePlanId = searchParams.get("game_plan")
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fullHref = useMemo(() => {
    const base = `/${language}/orchard/assistant`
    return gamePlanId ? `${base}?game_plan=${encodeURIComponent(gamePlanId)}` : base
  }, [gamePlanId, language])

  if (hidden) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextQuestion = question.trim()
    if (!nextQuestion || loading) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setQuestion("")
    setAnswer("")
    setLoading(true)

    const history = turns.slice(-6)
    let streamed = ""
    try {
      const response = await fetch("/api/orchard/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion, history, game_plan_id: gamePlanId, locale }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) throw new Error("assistant request failed")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          const item = JSON.parse(line) as StreamEvent
          if (item.type === "delta" && item.delta) {
            streamed += item.delta
            setAnswer(streamed)
          }
          if (item.type === "error") throw new Error(item.error || text.error)
        }
      }
      if (!streamed.trim()) throw new Error(text.error)
      setTurns((current) => [...current, { question: nextQuestion, answer: streamed }].slice(-8))
      setAnswer("")
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error && error.message ? error.message : text.error
      setTurns((current) => [...current, { question: nextQuestion, answer: message }].slice(-8))
      setAnswer("")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }

  function clearChat() {
    abortRef.current?.abort()
    abortRef.current = null
    setTurns([])
    setAnswer("")
    setQuestion("")
    setLoading(false)
  }

  return <>
    <button
      type="button"
      aria-label={text.open}
      onClick={() => setOpen(true)}
      className="fixed bottom-5 right-5 z-[95] grid h-12 w-12 place-items-center rounded-full border border-[#d7dfd8] bg-[#1f624d] text-white shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bb4a3] sm:bottom-6 sm:right-6"
    >
      <Bot className="h-5 w-5" aria-hidden="true"/>
    </button>

    {open && <aside aria-label={text.title} className="fixed inset-x-3 bottom-3 z-[100] flex max-h-[min(78dvh,720px)] flex-col overflow-hidden rounded-2xl border border-[#d7dfd8] bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]">
      <header className="flex items-start justify-between gap-4 border-b border-[#e4e8e4] px-4 py-4">
        <div>
          <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#1f624d]"/><h2 className="text-base font-medium text-[#27342c]">{text.title}</h2></div>
          {gamePlanId && <p className="mt-1 text-[11px] font-medium uppercase tracking-[.12em] text-[#728078]">{text.scope}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={text.clear} onClick={clearChat} className="grid h-9 w-9 place-items-center rounded-lg text-[#657067] hover:bg-[#f1f4f1]"><Trash2 className="h-4 w-4"/></button>
          <button type="button" aria-label={text.close} onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-[#657067] hover:bg-[#f1f4f1]"><X className="h-4 w-4"/></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 && !answer ? <div className="grid min-h-48 place-items-center px-5 text-center"><div><Bot className="mx-auto h-9 w-9 text-[#1f624d]"/><p className="mt-4 text-sm leading-6 text-[#59635c]">{text.intro}</p></div></div> : <div className="space-y-4">
          {turns.map((turn, index) => <div key={`${index}-${turn.question.slice(0,16)}`} className="space-y-2">
            <div className="ml-auto max-w-[88%] rounded-xl bg-[#e8f0eb] px-3 py-2 text-sm leading-5 text-[#244438]">{turn.question}</div>
            <div className="max-w-[94%] whitespace-pre-wrap text-sm leading-6 text-[#39423c]">{turn.answer}</div>
          </div>)}
          {(loading || answer) && <div className={cn("max-w-[94%] whitespace-pre-wrap text-sm leading-6 text-[#39423c]", !answer && "animate-pulse text-[#7b837d]")}>{answer || "…"}</div>}
        </div>}
      </div>

      <footer className="border-t border-[#e4e8e4] p-3">
        <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border border-[#ccd5ce] bg-[#fafbf9] p-2 focus-within:border-[#8eaa9b]">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            rows={2}
            aria-label={text.placeholder}
            placeholder={text.placeholder}
            className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[#27342c] outline-none placeholder:text-[#929a94]"
          />
          <button type="submit" aria-label={text.send} disabled={!question.trim() || loading} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#1f624d] text-white disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4"/></button>
        </form>
        <Link href={fullHref} className="mt-2 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-[#1f624d] hover:bg-[#f1f4f1]">{text.full}<ExternalLink className="h-3.5 w-3.5"/></Link>
      </footer>
    </aside>}
  </>
}

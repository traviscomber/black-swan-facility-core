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
    open: "Orchard AI",
    title: "Orchard AI",
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
    open: "IA Orchard",
    title: "IA Orchard",
    intro: "Pregunta por esta app o por los datos autorizados de Orchard. La asesoría agrícola general queda fuera de este asistente rápido.",
    placeholder: "Escribe un mensaje…",
    send: "Enviar",
    clear: "Limpiar chat",
    close: "Cerrar",
    full: "Abrir IA Orchard completa",
    scope: "Plan activo",
    error: "El asistente no pudo responder en este momento.",
  },
  de: {
    open: "Orchard AI",
    title: "Orchard AI",
    intro: "Frage zur App oder zu autorisierten Orchard-Daten. Allgemeine landwirtschaftliche Beratung gehört nicht in diesen Schnellassistenten.",
    placeholder: "Nachricht schreiben…",
    send: "Senden",
    clear: "Chat leeren",
    close: "Schließen",
    full: "Vollständige Orchard AI öffnen",
    scope: "Game-Plan aktiv",
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
      className="fixed bottom-5 right-5 z-[95] grid h-12 w-12 place-items-center rounded-xl border border-[rgba(231,225,216,.18)] bg-[#1f624d] text-[#f5f7f5] shadow-[0_12px_32px_rgba(0,0,0,.35)] transition-transform hover:scale-[1.03] hover:bg-[#27765d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bcba8] sm:bottom-6 sm:right-6"
    >
      <Bot className="h-5 w-5" aria-hidden="true"/>
    </button>

    {open && <aside aria-label={text.title} className="fixed inset-x-3 bottom-3 z-[100] flex max-h-[min(78dvh,720px)] flex-col overflow-hidden rounded-xl border border-[rgba(231,225,216,.16)] bg-[#171512] text-[#e7e1d8] shadow-[0_24px_70px_rgba(0,0,0,.58)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]">
      <header className="flex items-start justify-between gap-4 border-b border-[rgba(231,225,216,.12)] bg-[#211e1a] px-4 py-4">
        <div>
          <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#8bcba8]"/><h2 className="text-base font-medium text-[#f0ebe4]">{text.title}</h2></div>
          {gamePlanId && <p className="mt-1 text-[11px] font-medium uppercase tracking-[.12em] text-[#8bcba8]">{text.scope}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={text.clear} onClick={clearChat} className="grid h-9 w-9 place-items-center rounded-lg border border-[rgba(231,225,216,.10)] bg-[#2b2722] text-[#c9c0b5] hover:bg-[#39342d] hover:text-[#f0ebe4]"><Trash2 className="h-4 w-4"/></button>
          <button type="button" aria-label={text.close} onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-[rgba(231,225,216,.10)] bg-[#2b2722] text-[#c9c0b5] hover:bg-[#39342d] hover:text-[#f0ebe4]"><X className="h-4 w-4"/></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#171512] px-4 py-4">
        {turns.length === 0 && !answer ? <div className="grid min-h-48 place-items-center px-5 text-center"><div><Bot className="mx-auto h-9 w-9 text-[#8bcba8]"/><p className="mt-4 text-sm leading-6 text-[#c9c0b5]">{text.intro}</p></div></div> : <div className="space-y-4">
          {turns.map((turn, index) => <div key={`${index}-${turn.question.slice(0,16)}`} className="space-y-2">
            <div className="ml-auto max-w-[88%] rounded-xl border border-[rgba(139,203,168,.24)] bg-[rgba(139,203,168,.14)] px-3 py-2 text-sm leading-5 text-[#eef6f1]">{turn.question}</div>
            <div className="max-w-[94%] whitespace-pre-wrap rounded-xl border border-[rgba(231,225,216,.10)] bg-[#211e1a] px-3 py-2.5 text-sm leading-6 text-[#e7e1d8]">{turn.answer}</div>
          </div>)}
          {(loading || answer) && <div className={cn("max-w-[94%] whitespace-pre-wrap rounded-xl border border-[rgba(231,225,216,.10)] bg-[#211e1a] px-3 py-2.5 text-sm leading-6 text-[#e7e1d8]", !answer && "animate-pulse text-[#a9a095]")}>{answer || "…"}</div>}
        </div>}
      </div>

      <footer className="border-t border-[rgba(231,225,216,.12)] bg-[#211e1a] p-3">
        <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border border-[rgba(231,225,216,.20)] bg-[#2b2722] p-2 focus-within:border-[#8bcba8] focus-within:ring-1 focus-within:ring-[rgba(139,203,168,.24)]">
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
            className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[#f0ebe4] outline-none placeholder:text-[#9f968b]"
          />
          <button type="submit" aria-label={text.send} disabled={!question.trim() || loading} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#8bcba8] text-[#102018] transition-colors hover:bg-[#a1d8b9] disabled:cursor-not-allowed disabled:opacity-35"><Send className="h-4 w-4"/></button>
        </form>
        <Link href={fullHref} className="mt-2 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-[#a9e3c2] hover:bg-[rgba(139,203,168,.10)] hover:text-[#c7efd8]">{text.full}<ExternalLink className="h-3.5 w-3.5"/></Link>
      </footer>
    </aside>}
  </>
}

"use client"

import type React from "react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Crown, Lightbulb, Loader2, Send } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type ChatMessage = { id: string; role: "user" | "assistant"; content: string }
type ChatApiResponse = { message?: { role?: "assistant"; content?: string }; error?: string }

const copy = {
  en: { title: "Sovereignty Coach", subtitle: "Use current operational data to identify dependencies and practical paths toward greater self-sufficiency.", header: "Operational coach", guidance: "Answers are grounded in authorized Sovereignty records. Missing evidence is reported explicitly.", prompt: "Ask about dependencies, targets or the next highest-impact action.", placeholder: "Ask about sovereignty improvements…", send: "Send question", error: "Unable to generate a response.", examples: "Example questions", exampleRows: [["What are my biggest dependencies limiting sovereignty?", "Identify limiting dependencies"], ["How can we improve energy sovereignty in the next 6 months?", "Energy improvement roadmap"], ["What quick wins can boost our food sovereignty?", "Food sovereignty quick wins"], ["How do we achieve 80% overall sovereignty within 2 years?", "2-year sovereignty roadmap"]], back: "Back to dashboard", plans: "View action plans" },
  es: { title: "Asistente de soberanía", subtitle: "Usa datos operativos actuales para identificar dependencias y caminos concretos hacia mayor autosuficiencia.", header: "Asistente operativo", guidance: "Las respuestas se fundamentan en registros autorizados de Soberanía. Si falta evidencia, se indica explícitamente.", prompt: "Pregunta por dependencias, metas o la siguiente acción de mayor impacto.", placeholder: "Pregunta cómo mejorar la soberanía operativa…", send: "Enviar pregunta", error: "No fue posible generar una respuesta.", examples: "Preguntas de ejemplo", exampleRows: [["¿Cuáles son mis mayores dependencias que limitan la soberanía?", "Identificar dependencias limitantes"], ["¿Cómo podemos mejorar la soberanía energética en los próximos 6 meses?", "Plan energético a 6 meses"], ["¿Qué acciones rápidas pueden mejorar nuestra soberanía alimentaria?", "Acciones rápidas en alimentos"], ["¿Cómo alcanzamos 80% de soberanía total en 2 años?", "Ruta de soberanía a 2 años"]], back: "Volver al panel", plans: "Ver planes de acción" },
  de: { title: "Souveränitäts-Coach", subtitle: "Aktuelle Betriebsdaten nutzen, um Abhängigkeiten und konkrete Wege zu mehr Eigenständigkeit zu erkennen.", header: "Operativer Coach", guidance: "Antworten basieren auf autorisierten Souveränitätsdaten. Fehlende Evidenz wird ausdrücklich benannt.", prompt: "Fragen Sie nach Abhängigkeiten, Zielen oder der nächsten wirkungsvollen Maßnahme.", placeholder: "Frage zur Verbesserung der operativen Souveränität…", send: "Frage senden", error: "Antwort konnte nicht erstellt werden.", examples: "Beispielfragen", exampleRows: [["Welche Abhängigkeiten begrenzen unsere Souveränität am stärksten?", "Begrenzende Abhängigkeiten erkennen"], ["Wie können wir die Energiesouveränität in den nächsten 6 Monaten verbessern?", "6-Monats-Energieplan"], ["Welche schnellen Maßnahmen stärken unsere Lebensmittelsouveränität?", "Schnelle Maßnahmen für Lebensmittel"], ["Wie erreichen wir innerhalb von 2 Jahren 80 % Gesamtsouveränität?", "2-Jahres-Roadmap"]], back: "Zurück zum Dashboard", plans: "Aktionspläne anzeigen" },
} as const

function newMessage(role: ChatMessage["role"], content: string): ChatMessage { return { id: crypto.randomUUID(), role, content } }

export default function SovereigntyCoach() {
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, isWorking])

  async function submitQuestion(question: string) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || isWorking) return
    const userMessage = newMessage("user", cleanQuestion)
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages); setInputValue(""); setError(null); setIsWorking(true)
    try {
      const response = await fetch("/api/sovereignty/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: lang, messages: nextMessages.map(({ role, content }) => ({ role, content })) }) })
      const payload = (await response.json().catch(() => ({}))) as ChatApiResponse
      if (!response.ok || !payload.message?.content) throw new Error(text.error)
      setMessages((current) => [...current, newMessage("assistant", payload.message!.content!)])
    } catch {
      setError(text.error)
    } finally { setIsWorking(false) }
  }

  function handleSubmit(event: React.FormEvent) { event.preventDefault(); void submitQuestion(inputValue) }

  return <AppLayout><div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <div className="space-y-2"><div className="flex items-center gap-2"><Crown className="h-6 w-6 text-primary" /><h1 className="text-3xl font-bold text-accent">{text.title}</h1></div><p className="text-muted-foreground">{text.subtitle}</p></div>
    <Card className="flex h-[600px] flex-col border-secondary"><CardHeader className="border-b border-secondary pb-3"><CardTitle className="text-lg">{text.header}</CardTitle><CardDescription>{text.guidance}</CardDescription></CardHeader><ScrollArea className="flex-1 p-4"><div className="space-y-4">{messages.length === 0 ? <div className="flex h-full flex-col items-center justify-center py-12 text-center"><Lightbulb className="mb-4 h-12 w-12 text-muted-foreground opacity-50" /><p className="text-muted-foreground">{text.prompt}</p></div> : messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}><p className="whitespace-pre-wrap text-sm">{message.content}</p></div></div>)}{isWorking ? <div className="flex justify-start"><div className="rounded-lg bg-secondary px-4 py-2 text-secondary-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div></div> : null}{error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}<div ref={scrollRef} /></div></ScrollArea><div className="border-t border-secondary p-4"><form onSubmit={handleSubmit} className="flex gap-2"><Input value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder={text.placeholder} disabled={isWorking} className="flex-1" /><Button type="submit" disabled={isWorking || !inputValue.trim()} size="icon" aria-label={text.send}>{isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></form></div></Card>
    <Card className="border-secondary/50 bg-secondary/20"><CardHeader><CardTitle className="text-base">{text.examples}</CardTitle></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{text.exampleRows.map(([question, label]) => <button key={question} type="button" disabled={isWorking} onClick={() => void submitQuestion(question)} className="rounded border border-secondary p-3 text-left text-sm transition-colors hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50">→ {label}</button>)}</div></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2"><Button asChild variant="outline" className="w-full gap-2 bg-transparent"><Link href={`/${lang}/sovereignty`}><Crown className="h-4 w-4" />{text.back}</Link></Button><Button asChild className="w-full gap-2"><Link href={`/${lang}/sovereignty/coach/action-plan`}><Lightbulb className="h-4 w-4" />{text.plans}</Link></Button></div>
  </div></AppLayout>
}

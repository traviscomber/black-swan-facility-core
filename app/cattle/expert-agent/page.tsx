"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowLeft, Loader2, MessageSquare, Send } from "lucide-react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

const quickQuestions = [
  "Resume el último control biométrico registrado.",
  "¿Qué alertas o tratamientos están abiertos?",
  "Resume la proyección económica de Crianza.",
  "¿Qué precios y costos registrados requieren validación?",
]

export default function CattleExpertAgent() {
  const [inputValue, setInputValue] = useState("")
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/cattle/expert-agent" }),
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const isWorking = status === "submitted" || status === "streaming" || status === "in_progress"

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function submitQuestion(question: string) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || isWorking) return
    sendMessage({ text: cleanQuestion })
    setInputValue("")
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    submitQuestion(inputValue)
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
        <div className="space-y-3">
          <Button asChild variant="ghost" className="-ml-3 w-fit"><Link href="/cattle"><ArrowLeft className="mr-2 h-4 w-4" />Volver a Ganadería</Link></Button>
          <div className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold text-accent sm:text-3xl">Asistente ganadero</h1></div>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">Consulta registros clínicos, costos, precios y proyecciones disponibles en el sistema. Las respuestas distinguen datos operativos de supuestos y no reemplazan evaluación veterinaria ni financiera.</p>
        </div>

        <Card className="flex min-h-[560px] flex-col overflow-hidden border-secondary">
          <CardHeader className="border-b border-secondary pb-3"><CardTitle className="text-base">Consulta interna</CardTitle><CardDescription>El asistente debe verificar los datos antes de responder con cifras.</CardDescription></CardHeader>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? <div className="flex min-h-[330px] flex-col items-center justify-center px-4 text-center"><MessageSquare className="mb-4 h-10 w-10 text-muted-foreground opacity-50" /><p className="max-w-md text-sm text-muted-foreground">Pregunta por registros existentes. Cuando falte información o los datos sean antiguos, el asistente debe indicarlo explícitamente.</p></div> : messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-lg px-4 py-3 text-sm sm:max-w-[75%] ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{message.parts.map((part, index) => part.type === "text" ? <p key={index} className="whitespace-pre-wrap">{part.text}</p> : null)}</div></div>)}
              {isWorking && <div className="flex justify-start"><div className="rounded-lg bg-secondary px-4 py-3"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <div className="border-t border-secondary p-4"><form onSubmit={handleSubmit} className="flex gap-2"><Input value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="Escribe una consulta sobre los registros ganaderos…" disabled={isWorking} className="flex-1" /><Button type="submit" disabled={isWorking || !inputValue.trim()} size="icon" aria-label="Enviar consulta">{isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></form></div>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">Consultas sugeridas</CardTitle><CardDescription>Estas preguntas usan datos registrados y evitan presentar proyecciones como hechos actuales.</CardDescription></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{quickQuestions.map((question) => <button key={question} type="button" onClick={() => submitQuestion(question)} disabled={isWorking} className="rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">{question}</button>)}</div></CardContent></Card>
      </div>
    </AppLayout>
  )
}

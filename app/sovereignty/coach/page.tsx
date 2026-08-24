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

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type ChatApiResponse = {
  message?: { role?: "assistant"; content?: string }
  error?: string
}

function newMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content }
}

export default function SovereigntyCoach() {
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isWorking])

  async function submitQuestion(question: string) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || isWorking) return

    const userMessage = newMessage("user", cleanQuestion)
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInputValue("")
    setError(null)
    setIsWorking(true)

    try {
      const response = await fetch("/api/sovereignty/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as ChatApiResponse
      if (!response.ok || !payload.message?.content) {
        throw new Error(payload.error || "Unable to generate a response")
      }
      setMessages((current) => [...current, newMessage("assistant", payload.message!.content!)])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to generate a response")
    } finally {
      setIsWorking(false)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    void submitQuestion(inputValue)
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-accent">{t("sovereignty.coach_title")}</h1>
          </div>
          <p className="text-muted-foreground">{t("sovereignty.coach_subtitle")}</p>
        </div>

        <Card className="flex h-[600px] flex-col border-secondary">
          <CardHeader className="border-b border-secondary pb-3">
            <CardTitle className="text-lg">{t("sovereignty.coach_header")}</CardTitle>
            <CardDescription>{t("sovereignty.coach_guidance")}</CardDescription>
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <Lightbulb className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">{t("sovereignty.coach_prompt")}</p>
                </div>
              ) : messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  </div>
                </div>
              ))}
              {isWorking && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-secondary px-4 py-2 text-secondary-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
                </div>
              )}
              {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-secondary p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="Ask about sovereignty improvements..." disabled={isWorking} className="flex-1" />
              <Button type="submit" disabled={isWorking || !inputValue.trim()} size="icon" aria-label="Send question">
                {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </Card>

        <Card className="border-secondary/50 bg-secondary/20">
          <CardHeader><CardTitle className="text-base">Example Questions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {[
                ["What are my biggest dependencies limiting sovereignty?", "Identify limiting dependencies"],
                ["How can we improve energy sovereignty in the next 6 months?", "Energy improvement roadmap"],
                ["What quick wins can boost our food sovereignty?", "Food sovereignty quick wins"],
                ["How do we achieve 80% overall sovereignty within 2 years?", "2-year sovereignty roadmap"],
              ].map(([question, label]) => (
                <button key={question} type="button" disabled={isWorking} onClick={() => void submitQuestion(question)} className="rounded border border-secondary p-3 text-left text-sm transition-colors hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50">→ {label}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Button asChild variant="outline" className="w-full gap-2 bg-transparent"><Link href="/sovereignty"><Crown className="h-4 w-4" /> Back to Dashboard</Link></Button>
          <Button asChild className="w-full gap-2"><Link href="/sovereignty/coach/action-plan"><Lightbulb className="h-4 w-4" /> View Action Plans</Link></Button>
        </div>
      </div>
    </AppLayout>
  )
}

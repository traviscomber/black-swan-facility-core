"use client"

import type React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Lightbulb, Crown } from "lucide-react"
import { useRef, useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { useLanguage } from "@/lib/language-context-client"
import Link from "next/link"

export default function SovereigntyCoach() {
  const [inputValue, setInputValue] = useState("")
  const { t } = useLanguage()

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/sovereignty/coach",
    }),
  })

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue && inputValue.trim()) {
      sendMessage({ text: inputValue })
      setInputValue("")
    }
  }

  const handleQuickQuestion = (question: string) => {
    setInputValue(question)
    setTimeout(() => {
      sendMessage({ text: question })
      setInputValue("")
    }, 100)
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-accent">{t("sovereignty.coach_title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("sovereignty.coach_subtitle")}
          </p>
        </div>

        <Card className="border-secondary h-[600px] flex flex-col">
          <CardHeader className="border-b border-secondary pb-3">
            <CardTitle className="text-lg">{t("sovereignty.coach_header")}</CardTitle>
            <CardDescription>{t("sovereignty.coach_guidance")}</CardDescription>
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {t("sovereignty.coach_prompt")}
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`rounded-lg px-4 py-2 max-w-xs lg:max-w-md ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {message.parts ? (
                        message.parts.map((part: any, partIndex: number) => (
                          <p key={partIndex} className="text-sm">
                            {typeof part === "string" ? part : part.text}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {status === "in_progress" && (
                <div className="flex gap-3 justify-start">
                  <div className="rounded-lg px-4 py-2 bg-secondary text-secondary-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-secondary p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about sovereignty improvements..."
                disabled={status === "in_progress"}
                className="flex-1"
              />
              <Button type="submit" disabled={status === "in_progress" || !inputValue.trim()} size="icon">
                {status === "in_progress" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </Card>

        <Card className="border-secondary/50 bg-secondary/20">
          <CardHeader>
            <CardTitle className="text-base">Example Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              <button
                onClick={() => handleQuickQuestion("What are my biggest dependencies limiting sovereignty?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → Identify limiting dependencies
              </button>
              <button
                onClick={() => handleQuickQuestion("How can we improve energy sovereignty in the next 6 months?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → Energy improvement roadmap
              </button>
              <button
                onClick={() => handleQuickQuestion("What quick wins can boost our food sovereignty?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → Food sovereignty quick wins
              </button>
              <button
                onClick={() => handleQuickQuestion("How do we achieve 80% overall sovereignty within 2 years?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → 2-year sovereignty roadmap
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/sovereignty" className="block">
            <Button variant="outline" className="w-full gap-2 bg-transparent">
              <Crown className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
          <Link href="/sovereignty/coach/action-plan" className="block">
            <Button variant="default" className="w-full gap-2">
              <Lightbulb className="h-4 w-4" /> View Action Plans
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}

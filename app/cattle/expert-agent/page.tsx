"use client"

import type React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, MessageSquare } from "lucide-react"
import { useRef, useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"

export default function CattleExpertAgent() {
  const [inputValue, setInputValue] = useState("")

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/cattle/expert-agent",
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
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-accent">Cattle Management Expert</h1>
          </div>
          <p className="text-muted-foreground">
            AI-powered advisor for your cattle business. Ask questions about profitability, animal management, breeding
            strategies, and cost optimization.
          </p>
        </div>

        <Card className="border-secondary h-[600px] flex flex-col">
          <CardHeader className="border-b border-secondary pb-3">
            <CardTitle className="text-lg">Expert Chat</CardTitle>
            <CardDescription>Conversation with your cattle management AI advisor</CardDescription>
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    Ask me anything about your cattle business plan, profitability, breeding strategies, or operational
                    costs.
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
                placeholder="Ask about your cattle business..."
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
                onClick={() => handleQuickQuestion("What is my current profitability margin for Crianza?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → Current profitability margins
              </button>
              <button
                onClick={() => handleQuickQuestion("When will I break even on my investment?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → Break-even timeline
              </button>
              <button
                onClick={() => handleQuickQuestion("How can I optimize my Engorda costs?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → Cost optimization strategies
              </button>
              <button
                onClick={() => handleQuickQuestion("What breeding recommendations do you have?")}
                className="text-left text-sm p-3 rounded border border-secondary hover:bg-secondary/50 transition-colors"
              >
                → Breeding recommendations
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

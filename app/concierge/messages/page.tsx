"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { MessageSquare, Phone, ArrowDown, ArrowUp, Search } from "lucide-react"
import { format } from "date-fns"

interface Message {
  id: string
  phone: string
  direction: "inbound" | "outbound"
  text: string
  ts: string
  intent: string | null
  sentiment: string | null
  needs_human_review: boolean
}

interface ConversationGroup {
  phone: string
  messages: Message[]
  lastMessage: string
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<ConversationGroup[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    groupConversations()
  }, [messages, searchQuery])

  async function loadMessages() {
    const supabase = createBrowserClient()
    const { data } = await supabase.from("messages").select("*").order("ts", { ascending: false }).limit(500)

    setMessages(data || [])
    setLoading(false)
  }

  function groupConversations() {
    const grouped: Record<string, Message[]> = {}

    messages
      .filter((msg) => {
        if (!searchQuery) return true
        return (
          msg.phone.includes(searchQuery) ||
          msg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.intent?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })
      .forEach((msg) => {
        if (!grouped[msg.phone]) {
          grouped[msg.phone] = []
        }
        grouped[msg.phone].push(msg)
      })

    const conversationArray = Object.keys(grouped).map((phone) => ({
      phone,
      messages: grouped[phone].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
      lastMessage: grouped[phone][0].ts,
    }))

    conversationArray.sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime())

    setConversations(conversationArray)
  }

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp Messages</h1>
        <p className="text-muted-foreground">Conversation history & agent interactions</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Conversation List */}
        <div className="lg:col-span-1 space-y-4">
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />

          {loading ? (
            <div className="text-muted-foreground">Loading messages...</div>
          ) : conversations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">No messages found</CardContent>
            </Card>
          ) : (
            conversations.map((conv) => (
              <Card
                key={conv.phone}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedPhone === conv.phone ? "border-primary" : ""
                }`}
                onClick={() => setSelectedPhone(conv.phone)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{conv.phone}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{conv.messages[0].text}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {conv.messages.length} messages
                        </Badge>
                        {conv.messages.some((m) => m.needs_human_review) && (
                          <Badge variant="destructive" className="text-xs">
                            Review Needed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(conv.lastMessage), "MMM d, h:mm a")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Message Thread */}
        <div className="lg:col-span-2">
          {selectedConversation ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    {selectedConversation.phone}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{selectedConversation.messages.length} messages</p>
                </div>
                <a
                  href={`https://wa.me/${selectedConversation.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Button size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Open WhatsApp
                  </Button>
                </a>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {selectedConversation.messages
                    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
                    .map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-1">
                            {msg.direction === "inbound" ? (
                              <ArrowDown className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowUp className="h-4 w-4" />
                            )}
                            <span className="text-xs opacity-70">{format(new Date(msg.ts), "MMM d, h:mm a")}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          {msg.intent && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              Intent: {msg.intent}
                            </Badge>
                          )}
                          {msg.needs_human_review && (
                            <Badge variant="destructive" className="mt-2 ml-2 text-xs">
                              Needs Review
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Select a conversation to view messages
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

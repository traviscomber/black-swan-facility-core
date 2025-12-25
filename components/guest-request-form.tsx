"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Mail, Send, CheckCircle } from "lucide-react"

// Pre-defined request categories
const REQUEST_CATEGORIES = [
  { id: "blankets", label: "Extra Blankets", icon: "🛏️" },
  { id: "towels", label: "Towels", icon: "🛁" },
  { id: "cleaning", label: "Room Cleaning", icon: "🧹" },
  { id: "maintenance", label: "Maintenance Issue", icon: "🔧" },
  { id: "amenities", label: "Amenities", icon: "✨" },
  { id: "activities", label: "Activities Info", icon: "🎯" },
  { id: "food", label: "Food/Beverage", icon: "🍽️" },
  { id: "other", label: "Other Request", icon: "📝" },
]

export function GuestRequestForm() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get("room_id")
  const locationId = searchParams.get("location_id")
  const roomNumber = searchParams.get("room_number")

  const [room, setRoom] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("normal")
  const [submitting, setSubmitting] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadRoomInfo()
  }, [roomId, locationId])

  async function loadRoomInfo() {
    try {
      if (roomId && locationId) {
        const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single()
        const { data: locationData } = await supabase.from("locations").select("*").eq("id", locationId).single()

        setRoom(roomData)
        setLocation(locationData)
      }
    } catch (error) {
      console.error("Error loading room info:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCategory || !guestName) {
      alert("Please select a category and enter your name")
      return
    }

    setSubmitting(true)

    try {
      // Insert the request into database
      const { error: insertError } = await supabase.from("hospitality_requests").insert({
        room_id: roomId,
        location_id: locationId,
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_email: guestEmail,
        request_type: selectedCategory,
        category: selectedCategory,
        description: description,
        priority: priority,
        status: "pending",
      })

      if (insertError) throw insertError

      const whatsappResponse = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "+56979752758", // Antonia Valencia's WhatsApp
          message: `🏨 *New Hospitality Request*\n\n👤 Guest: ${guestName}\n🛏️ Room: ${roomNumber || room?.room_number}\n📍 Location: ${location?.name}\n📋 Request: ${selectedCategory}\n⚡ Priority: ${priority.toUpperCase()}\n\n${description ? `📝 Details: ${description}` : ""}\n\nPlease confirm when handled.`,
        }),
      })

      if (!whatsappResponse.ok) {
        console.error("WhatsApp notification failed, but request saved to database")
      }

      setSubmitted(true)

      // Reset form after 3 seconds
      setTimeout(() => {
        setSubmitted(false)
        setSelectedCategory("")
        setGuestName("")
        setGuestPhone("")
        setGuestEmail("")
        setDescription("")
        setPriority("normal")
      }, 3000)
    } catch (error) {
      console.error("Error submitting request:", error)
      alert("Error submitting request. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md text-center bg-card border-accent/20">
          <CardContent className="pt-12 pb-12">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-accent" />
            <h2 className="text-2xl font-bold mb-2 text-white">Request Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you! Your request has been sent to our hospitality team. We'll get to you shortly.
            </p>
            <p className="text-sm text-muted-foreground">Redirecting in a few seconds...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Hospitality Requests</h1>
          <p className="text-muted-foreground text-lg">How can we help make your stay more comfortable?</p>
        </div>

        {/* Room Information */}
        {room && location && (
          <Card className="mb-6 bg-card border-accent/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">You're in</p>
                  <p className="text-lg font-semibold text-white">
                    {room.room_number} • {location.name}
                  </p>
                </div>
                <Badge variant="outline" className="text-accent border-accent">
                  Online
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Request Form */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Submit Your Request</CardTitle>
            <CardDescription>Select a category below or describe what you need</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">What do you need?</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {REQUEST_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategory(category.id)}
                      className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        selectedCategory === category.id
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      <span className="text-2xl">{category.icon}</span>
                      <span className="text-sm font-medium text-center text-white line-clamp-2">{category.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Guest Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="bg-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Your phone number"
                    className="bg-input"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="Your email"
                    className="bg-input"
                  />
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority Level</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Can wait</SelectItem>
                    <SelectItem value="normal">Normal - Standard</SelectItem>
                    <SelectItem value="high">High - Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Additional Details (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide any additional details or special requests..."
                  rows={4}
                  className="bg-input resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting || !selectedCategory || !guestName}
                className="w-full h-12 text-base font-semibold gap-2 bg-primary hover:bg-primary/90"
              >
                <Send className="h-5 w-5" />
                {submitting ? "Sending..." : "Submit Request"}
              </Button>

              {/* Contact Info */}
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2 text-sm">
                <p className="text-muted-foreground">Need immediate assistance? Contact hospitality directly:</p>
                <div className="flex items-center gap-2 text-white">
                  <Phone className="h-4 w-4 text-accent" />
                  <span>+57 1 234 5678</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Mail className="h-4 w-4 text-accent" />
                  <span>hospitality@example.com</span>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

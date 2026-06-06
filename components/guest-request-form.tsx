"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Mail, Send, CheckCircle, Lock, LogOut } from "lucide-react"

// Translations
const translations = {
  en: {
    blankets: "Extra Blankets",
    towels: "Towels",
    cleaning: "Room Cleaning",
    maintenance: "Maintenance Issue",
    amenities: "Amenities",
    activities: "Activities Info",
    food: "Food/Beverage",
    other: "Other Request",
  },
  es: {
    blankets: "Mantas Adicionales",
    towels: "Toallas",
    cleaning: "Limpieza de Habitación",
    maintenance: "Problema de Mantenimiento",
    amenities: "Servicios",
    activities: "Información de Actividades",
    food: "Comida/Bebida",
    other: "Otra Solicitud",
  },
}

interface Location {
  id: string
  name: string
  is_active: boolean
}

interface Room {
  id: string
  room_number: string
}

const REQUEST_CATEGORIES = [
  { id: "blankets", labelKey: "blankets", icon: "🛏️" },
  { id: "towels", labelKey: "towels", icon: "🛁" },
  { id: "cleaning", labelKey: "cleaning", icon: "🧹" },
  { id: "maintenance", labelKey: "maintenance", icon: "🔧" },
  { id: "amenities", labelKey: "amenities", icon: "✨" },
  { id: "activities", labelKey: "activities", icon: "🎯" },
  { id: "food", labelKey: "food", icon: "🍽️" },
  { id: "other", labelKey: "other", icon: "📝" },
]

const ADMIN_PASSWORD = "Globaln2025"

const generateDeviceId = () => {
  let deviceId = localStorage.getItem("tablet_device_id")
  if (!deviceId) {
    deviceId = `TABLET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem("tablet_device_id", deviceId)
  }
  return deviceId
}

export function GuestRequestForm() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get("room_id")
  const locationId = searchParams.get("location_id")
  const roomNumber = searchParams.get("room_number")

  const [language, setLanguage] = useState<"en" | "es">("es")
  const t = translations[language]

  const [assignedLocation, setAssignedLocation] = useState<Location | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminError, setAdminError] = useState("")

  const [room, setRoom] = useState<Room | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [guestName, setGuestName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deviceId] = useState(() => generateDeviceId())

  const supabase = createBrowserClient()

  useEffect(() => {
    loadInitialData()
    // Get language from localStorage or document lang attribute
    const savedLanguage = localStorage.getItem("language") as "en" | "es" | null
    if (savedLanguage) {
      setLanguage(savedLanguage)
    }
  }, [])

  async function loadInitialData() {
    try {
      // Load all locations
      const { data: locationsData } = await supabase.from("locations").select("*").eq("is_active", true)

      setLocations(locationsData || [])

      // Check localStorage for assigned location, default to "Prairie House 2"
      const savedLocationId = localStorage.getItem("tablet_assigned_location_id")
      if (savedLocationId && locationsData) {
        const saved = locationsData.find((l: Location) => l.id === savedLocationId)
        if (saved) {
          setAssignedLocation(saved)
        } else {
          // Default to Prairie House 2
          const defaultLocation = locationsData.find((l: Location) => l.name === "Prairie House 2")
          setAssignedLocation(defaultLocation || locationsData[0])
        }
      } else {
        // Default to Prairie House 2
        const defaultLocation = locationsData?.find((l: Location) => l.name === "Prairie House 2")
        setAssignedLocation(defaultLocation || locationsData?.[0])
      }

      // If specific room/location provided via URL params, use those
      if (roomId && locationId) {
        const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single()
        const { data: locationData } = await supabase.from("locations").select("*").eq("id", locationId).single()

        setRoom(roomData)
        setLocation(locationData)
      }
    } catch (error) {
      console.error("Error loading initial data:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleAdminLogin() {
    setAdminError("")
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdminMode(true)
      setShowAdminPanel(false)
      setAdminPassword("")
    } else {
      setAdminError("Incorrect password")
      setAdminPassword("")
    }
  }

  function handleLocationChange(locationId: string) {
    const selected = locations.find((l) => l.id === locationId)
    if (selected) {
      setAssignedLocation(selected)
      localStorage.setItem("tablet_assigned_location_id", locationId)
    }
  }

  function handleAdminLogout() {
    setIsAdminMode(false)
    setShowAdminPanel(false)
    setAdminPassword("")
    setAdminError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCategory || !guestName) {
      alert("Please select a category and enter your name")
      return
    }

    setSubmitting(true)

    try {
      const locationForRequest = location || assignedLocation

      const categoryLabel = REQUEST_CATEGORIES.find((c) => c.id === selectedCategory)?.labelKey 
        ? t[REQUEST_CATEGORIES.find((c) => c.id === selectedCategory)!.labelKey as keyof typeof t]
        : selectedCategory

      const { error: insertError } = await supabase.from("issues").insert({
        title: categoryLabel, // Save category label as title
        asset_id: null,
        reported_by: null,
        description: `[HOSPITALITY REQUEST]\n\n👤 Guest: ${guestName}\n🛏️ Room: ${roomNumber || room?.room_number}\n📍 Location: ${locationForRequest?.name}\n📋 Request Type: ${categoryLabel}\n📱 Tablet ID: ${deviceId}`,
        status: "open",
        photo_url: null,
      })

      if (insertError) throw insertError

      try {
        await supabase
          .from("tablet_devices")
          .upsert({
            device_id: deviceId,
            device_name: `${locationForRequest?.name} Tablet`,
            location_id: locationForRequest?.id,
            last_active_at: new Date().toISOString(),
            is_active: true,
          })
          .eq("device_id", deviceId)
      } catch (error) {
        console.error("Error updating tablet registry:", error)
      }

      const whatsappResponse = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "+56979752758",
          message: `🏨 *New Hospitality Request*\n\n👤 Guest: ${guestName}\n🛏️ Room: ${roomNumber || room?.room_number}\n📍 Location: ${locationForRequest?.name}\n📋 Request: ${categoryLabel}\n📱 Tablet: ${deviceId}\n\nPlease confirm when handled.`,
        }),
      })

      if (!whatsappResponse.ok) {
        console.error("WhatsApp notification failed, but request saved to database")
      }

      setSubmitted(true)

      setTimeout(() => {
        setSubmitted(false)
        setSelectedCategory("")
        setGuestName("")
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

  if (showAdminPanel && !isAdminMode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md bg-card border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-accent" />
              Admin Access
            </CardTitle>
            <CardDescription>Enter password to configure tablet assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Admin Password</Label>
              <Input
                id="password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAdminLogin()}
                placeholder="Enter password"
                className="bg-input"
              />
              {adminError && <p className="text-sm text-red-500">{adminError}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdminLogin} className="flex-1 bg-primary hover:bg-primary/90 text-white">
                Unlock
              </Button>
              <Button
                onClick={() => {
                  setShowAdminPanel(false)
                  setAdminPassword("")
                  setAdminError("")
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Admin Controls */}
        {isAdminMode && (
          <div className="mb-6 bg-accent/10 border border-accent rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" />
                Admin Mode: Tablet Configuration
              </h3>
              <Button onClick={handleAdminLogout} variant="outline" size="sm" className="gap-2 bg-transparent">
                <LogOut className="h-4 w-4" />
                Exit Admin
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-select" className="text-white">
                Assign This Tablet To:
              </Label>
              <Select value={assignedLocation?.id || ""} onValueChange={handleLocationChange}>
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder="Select facility..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-semibold text-accent">{assignedLocation?.name}</span>
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Hospitality Requests</h1>
            <p className="text-muted-foreground text-lg">What do you need today?</p>
          </div>
          <button
            onClick={() => setShowAdminPanel(true)}
            className="text-xs text-muted-foreground hover:text-accent transition-colors opacity-50 hover:opacity-100"
            title="Admin settings"
          >
            ⚙️
          </button>
        </div>

        {/* Room Information */}
        {(location || assignedLocation) && (
          <Card className="mb-6 bg-card border-accent/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">You're in</p>
                  <p className="text-lg font-semibold text-white">
                    {roomNumber || room?.room_number || "Room TBD"} • {(location || assignedLocation)?.name}
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
            <CardDescription>Select a category and your name</CardDescription>
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
                      <span className="text-sm font-medium text-center text-white line-clamp-2">{t[category.labelKey as keyof typeof t]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  className="bg-input text-white placeholder:text-muted-foreground"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting || !selectedCategory || !guestName}
                className="w-full h-12 text-base font-semibold gap-2 bg-primary hover:bg-primary/90 text-white"
              >
                <Send className="h-5 w-5" />
                {submitting ? "Sending..." : "Submit Request"}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  window.open(
                    `https://wa.me/56979752758?text=Hello,%20I%20need%20hospitality%20assistance%20from%20${roomNumber || "my room"}`,
                    "_blank",
                  )
                }}
                className="w-full h-12 text-base font-semibold gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Phone className="h-5 w-5" />
                Contact Hospitality on WhatsApp
              </Button>

              {/* Contact Info */}
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2 text-sm border border-border">
                <p className="text-muted-foreground font-semibold">Need immediate assistance?</p>
                <div className="flex items-center gap-2 text-white">
                  <Phone className="h-4 w-4 text-accent" />
                  <span>+56 9 7975 2758 (WhatsApp)</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Mail className="h-4 w-4 text-accent" />
                  <span>antonia@blackswn.org</span>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { CheckCircle, Lock, LogOut, Mail, Phone, Send } from "lucide-react"

const translations = {
  en: {
    title: "Hospitality Requests",
    subtitle: "What do you need today?",
    submitTitle: "Submit Your Request",
    submitDescription: "Select a category and enter your name",
    question: "What do you need?",
    name: "Your name",
    namePlaceholder: "Enter your name",
    send: "Submit request",
    sending: "Sending...",
    submitted: "Request submitted",
    submittedDetail: "Your request was registered for the hospitality team.",
    location: "You're in",
    roomPending: "Location request",
    immediate: "Need immediate assistance?",
    whatsapp: "Contact Hospitality on WhatsApp",
    configTitle: "Tablet configuration",
    configDescription: "An authorized internal session is required to change the assigned location.",
    signInRequired: "Sign in through the internal system and return to this tablet to configure it.",
    close: "Close",
    exitAdmin: "Exit configuration",
    assignTo: "Assign this tablet to",
    current: "Current",
    invalid: "Select a category and enter your name.",
    failed: "The request could not be registered. Please try again.",
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
    title: "Solicitudes de hospitalidad",
    subtitle: "¿Qué necesitas hoy?",
    submitTitle: "Enviar solicitud",
    submitDescription: "Selecciona una categoría e ingresa tu nombre",
    question: "¿Qué necesitas?",
    name: "Tu nombre",
    namePlaceholder: "Ingresa tu nombre",
    send: "Enviar solicitud",
    sending: "Enviando...",
    submitted: "Solicitud registrada",
    submittedDetail: "La solicitud fue enviada al equipo de hospitalidad.",
    location: "Estás en",
    roomPending: "Solicitud general de la propiedad",
    immediate: "¿Necesitas asistencia inmediata?",
    whatsapp: "Contactar a Hospitalidad por WhatsApp",
    configTitle: "Configuración de tablet",
    configDescription: "Se requiere una sesión interna autorizada para cambiar la ubicación asignada.",
    signInRequired: "Inicia sesión en el sistema interno y vuelve a esta tablet para configurarla.",
    close: "Cerrar",
    exitAdmin: "Salir de configuración",
    assignTo: "Asignar esta tablet a",
    current: "Actual",
    invalid: "Selecciona una categoría e ingresa tu nombre.",
    failed: "No fue posible registrar la solicitud. Intenta nuevamente.",
    blankets: "Mantas adicionales",
    towels: "Toallas",
    cleaning: "Limpieza de habitación",
    maintenance: "Problema de mantenimiento",
    amenities: "Amenities",
    activities: "Información de actividades",
    food: "Comida o bebida",
    other: "Otra solicitud",
  },
} as const

type Language = keyof typeof translations
type Location = { id: string; name: string; is_active: boolean }
type Room = { id: string; room_number: string; location_id?: string }

const REQUEST_CATEGORIES = [
  { id: "blankets", labelKey: "blankets", icon: "🛏️" },
  { id: "towels", labelKey: "towels", icon: "🛁" },
  { id: "cleaning", labelKey: "cleaning", icon: "🧹" },
  { id: "maintenance", labelKey: "maintenance", icon: "🔧" },
  { id: "amenities", labelKey: "amenities", icon: "✨" },
  { id: "activities", labelKey: "activities", icon: "🎯" },
  { id: "food", labelKey: "food", icon: "🍽️" },
  { id: "other", labelKey: "other", icon: "📝" },
] as const

function getDeviceId() {
  const existing = localStorage.getItem("tablet_device_id")
  if (existing) return existing
  const created = `TABLET-${Date.now()}-${crypto.randomUUID()}`
  localStorage.setItem("tablet_device_id", created)
  return created
}

export function GuestRequestForm() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get("room_id")
  const locationId = searchParams.get("location_id")
  const roomNumber = searchParams.get("room_number")
  const reservationId = searchParams.get("reservation_id")
  const supabase = useMemo(() => createBrowserClient(), [])

  const [language, setLanguage] = useState<Language>("es")
  const [locations, setLocations] = useState<Location[]>([])
  const [assignedLocation, setAssignedLocation] = useState<Location | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [deviceId, setDeviceId] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<(typeof REQUEST_CATEGORIES)[number]["id"] | "">("")
  const [guestName, setGuestName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [hasInternalSession, setHasInternalSession] = useState(false)
  const t = translations[language]

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language | null
    if (savedLanguage === "es" || savedLanguage === "en") setLanguage(savedLanguage)
    setDeviceId(getDeviceId())

    async function load() {
      try {
        const params = new URLSearchParams()
        if (roomId) params.set("room_id", roomId)
        if (locationId) params.set("location_id", locationId)
        const response = await fetch(`/api/guest-requests?${params.toString()}`, { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Configuration error")

        const loadedLocations = (payload.locations ?? []) as Location[]
        setLocations(loadedLocations)
        setRoom((payload.room ?? null) as Room | null)

        const selectedId = locationId || localStorage.getItem("tablet_assigned_location_id")
        const selected = loadedLocations.find((item) => item.id === selectedId) ?? loadedLocations[0] ?? null
        setAssignedLocation(selected)

        const { data } = await supabase.auth.getUser()
        setHasInternalSession(Boolean(data.user))
      } catch (loadError) {
        console.error(loadError)
        setError(language === "es" ? "No fue posible cargar la configuración de la tablet." : "Tablet configuration could not be loaded.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [language, locationId, roomId, supabase])

  function changeLanguage(next: Language) {
    setLanguage(next)
    localStorage.setItem("language", next)
  }

  function openConfiguration() {
    setShowAdminPanel(true)
    setIsAdminMode(hasInternalSession)
  }

  function handleLocationChange(nextLocationId: string) {
    const selected = locations.find((item) => item.id === nextLocationId)
    if (!selected || !hasInternalSession) return
    setAssignedLocation(selected)
    localStorage.setItem("tablet_assigned_location_id", selected.id)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedCategory || guestName.trim().length < 2 || !assignedLocation || !deviceId) {
      setError(t.invalid)
      return
    }

    setSubmitting(true)
    setError(null)
    const category = REQUEST_CATEGORIES.find((item) => item.id === selectedCategory)
    const requestLabel = category ? t[category.labelKey] : selectedCategory

    try {
      const response = await fetch("/api/guest-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: guestName.trim(),
          category: selectedCategory,
          requestLabel,
          locationId: assignedLocation.id,
          roomId: room?.id ?? roomId ?? null,
          reservationId,
          roomNumber: roomNumber ?? room?.room_number ?? null,
          deviceId,
          language,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || t.failed)

      void fetch("/api/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "+56979752758",
          message: `Nueva solicitud de hospitalidad: ${requestLabel}. Huésped: ${guestName.trim()}. Ubicación: ${assignedLocation.name}. Habitación: ${roomNumber || room?.room_number || "sin habitación"}. Solicitud: ${payload.requestId}.`,
        }),
      })

      setSubmitted(true)
      window.setTimeout(() => {
        setSubmitted(false)
        setSelectedCategory("")
        setGuestName("")
      }, 3500)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.failed)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <ScreenMessage text={language === "es" ? "Cargando…" : "Loading…"} />

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md border-accent/20 bg-card text-center">
          <CardContent className="py-12">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-accent" />
            <h2 className="text-2xl font-bold text-white">{t.submitted}</h2>
            <p className="mt-2 text-muted-foreground">{t.submittedDetail}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showAdminPanel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md border-accent/20 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-accent" />{t.configTitle}</CardTitle>
            <CardDescription>{t.configDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAdminMode ? <p className="text-sm text-muted-foreground">{t.signInRequired}</p> : <div className="space-y-2"><Label>{t.assignTo}</Label><Select value={assignedLocation?.id ?? ""} onValueChange={handleLocationChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{t.current}: <span className="font-medium text-accent">{assignedLocation?.name}</span></p></div>}
            <Button variant="outline" className="w-full" onClick={() => { setShowAdminPanel(false); setIsAdminMode(false) }}>{isAdminMode ? t.exitAdmin : t.close}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white md:text-4xl">{t.title}</h1><p className="mt-2 text-lg text-muted-foreground">{t.subtitle}</p></div>
          <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => changeLanguage(language === "es" ? "en" : "es")}>{language === "es" ? "EN" : "ES"}</Button><button onClick={openConfiguration} className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100" title={t.configTitle}>⚙️</button></div>
        </div>

        {(assignedLocation || room) && <Card className="mb-6 border-accent/20 bg-card"><CardContent className="flex items-center justify-between pt-4"><div><p className="text-sm text-muted-foreground">{t.location}</p><p className="text-lg font-semibold text-white">{roomNumber || room?.room_number || t.roomPending} · {assignedLocation?.name}</p></div><Badge variant="outline" className="border-accent text-accent">Online</Badge></CardContent></Card>}

        <Card className="border-border bg-card">
          <CardHeader><CardTitle>{t.submitTitle}</CardTitle><CardDescription>{t.submitDescription}</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <div className="space-y-3"><Label className="text-base font-semibold">{t.question}</Label><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{REQUEST_CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${selectedCategory === category.id ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}`}><span className="text-2xl">{category.icon}</span><span className="line-clamp-2 text-center text-sm font-medium text-white">{t[category.labelKey]}</span></button>)}</div></div>
              <div className="space-y-2"><Label htmlFor="guest-name">{t.name} *</Label><Input id="guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder={t.namePlaceholder} required className="bg-input text-white" /></div>
              <Button type="submit" disabled={submitting || !selectedCategory || guestName.trim().length < 2 || !assignedLocation} className="h-12 w-full gap-2 text-base font-semibold"><Send className="h-5 w-5" />{submitting ? t.sending : t.send}</Button>
              <Button type="button" onClick={() => window.open(`https://wa.me/56979752758?text=${encodeURIComponent(`Hola, necesito asistencia de hospitalidad desde ${roomNumber || room?.room_number || assignedLocation?.name || "mi ubicación"}`)}`, "_blank")} className="h-12 w-full gap-2 bg-green-600 text-base font-semibold text-white hover:bg-green-700"><Phone className="h-5 w-5" />{t.whatsapp}</Button>
              <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4 text-sm"><p className="font-semibold text-muted-foreground">{t.immediate}</p><div className="flex items-center gap-2 text-white"><Phone className="h-4 w-4 text-accent" /><span>+56 9 7975 2758</span></div><div className="flex items-center gap-2 text-white"><Mail className="h-4 w-4 text-accent" /><span>antonia@blackswn.org</span></div></div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ScreenMessage({ text }: { text: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-lg text-white">{text}</div>
}

"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Bath,
  BedDouble,
  CheckCircle2,
  ClipboardPenLine,
  Compass,
  Lock,
  MapPin,
  Phone,
  Send,
  Settings2,
  Sparkles,
  Utensils,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"

const translations = {
  en: {
    eyebrow: "BLACK SWAN · HOSPITALITY",
    title: "How can we help?",
    subtitle: "Send a request directly to the hospitality team.",
    submitTitle: "Your request",
    submitDescription: "Choose what you need and tell us your name.",
    question: "What do you need?",
    name: "Your name",
    namePlaceholder: "Enter your name",
    send: "Send request",
    sending: "Sending…",
    submitted: "Request received",
    submittedDetail: "The hospitality team has received your request.",
    location: "Your location",
    roomPending: "General property request",
    immediate: "Need immediate assistance?",
    whatsapp: "WhatsApp Hospitality",
    configTitle: "Tablet configuration",
    configDescription: "An authorized internal session is required to change the assigned location.",
    signInRequired: "Sign in through the internal system and return to this tablet to configure it.",
    close: "Close",
    exitAdmin: "Exit configuration",
    assignTo: "Assign this tablet to",
    current: "Current",
    invalid: "Select a category and enter your name.",
    failed: "The request could not be registered. Please try again.",
    online: "Connected",
    blankets: "Extra blankets",
    towels: "Towels",
    cleaning: "Room cleaning",
    maintenance: "Maintenance",
    amenities: "Room amenities",
    activities: "Activities",
    food: "Food & beverage",
    other: "Other request",
  },
  es: {
    eyebrow: "BLACK SWAN · HOSPITALIDAD",
    title: "¿Cómo podemos ayudarte?",
    subtitle: "Envía una solicitud directamente al equipo de hospitalidad.",
    submitTitle: "Tu solicitud",
    submitDescription: "Elige lo que necesitas e indícanos tu nombre.",
    question: "¿Qué necesitas?",
    name: "Tu nombre",
    namePlaceholder: "Ingresa tu nombre",
    send: "Enviar solicitud",
    sending: "Enviando…",
    submitted: "Solicitud recibida",
    submittedDetail: "El equipo de hospitalidad recibió tu solicitud.",
    location: "Tu ubicación",
    roomPending: "Solicitud general de la propiedad",
    immediate: "¿Necesitas asistencia inmediata?",
    whatsapp: "WhatsApp de Hospitalidad",
    configTitle: "Configuración de tablet",
    configDescription: "Se requiere una sesión interna autorizada para cambiar la ubicación asignada.",
    signInRequired: "Inicia sesión en el sistema interno y vuelve a esta tablet para configurarla.",
    close: "Cerrar",
    exitAdmin: "Salir de configuración",
    assignTo: "Asignar esta tablet a",
    current: "Actual",
    invalid: "Selecciona una categoría e ingresa tu nombre.",
    failed: "No fue posible registrar la solicitud. Intenta nuevamente.",
    online: "Conectado",
    blankets: "Mantas adicionales",
    towels: "Toallas",
    cleaning: "Limpieza de habitación",
    maintenance: "Mantenimiento",
    amenities: "Comodidades de habitación",
    activities: "Actividades",
    food: "Comida y bebida",
    other: "Otra solicitud",
  },
  de: {
    eyebrow: "BLACK SWAN · GASTBETREUUNG",
    title: "Wie können wir helfen?",
    subtitle: "Senden Sie Ihre Anfrage direkt an unser Hospitality-Team.",
    submitTitle: "Ihre Anfrage",
    submitDescription: "Wählen Sie aus, was Sie benötigen, und geben Sie Ihren Namen ein.",
    question: "Was benötigen Sie?",
    name: "Ihr Name",
    namePlaceholder: "Namen eingeben",
    send: "Anfrage senden",
    sending: "Wird gesendet…",
    submitted: "Anfrage erhalten",
    submittedDetail: "Unser Hospitality-Team hat Ihre Anfrage erhalten.",
    location: "Ihr Standort",
    roomPending: "Allgemeine Anfrage zur Unterkunft",
    immediate: "Benötigen Sie sofortige Hilfe?",
    whatsapp: "Hospitality über WhatsApp",
    configTitle: "Tablet-Konfiguration",
    configDescription: "Zum Ändern des zugewiesenen Standorts ist eine autorisierte interne Sitzung erforderlich.",
    signInRequired: "Melden Sie sich im internen System an und kehren Sie anschließend zu diesem Tablet zurück.",
    close: "Schließen",
    exitAdmin: "Konfiguration verlassen",
    assignTo: "Tablet zuweisen zu",
    current: "Aktuell",
    invalid: "Wählen Sie eine Kategorie und geben Sie Ihren Namen ein.",
    failed: "Die Anfrage konnte nicht registriert werden. Bitte versuchen Sie es erneut.",
    online: "Verbunden",
    blankets: "Zusätzliche Decken",
    towels: "Handtücher",
    cleaning: "Zimmerreinigung",
    maintenance: "Technisches Problem",
    amenities: "Zimmerausstattung",
    activities: "Aktivitäten",
    food: "Speisen & Getränke",
    other: "Andere Anfrage",
  },
} as const

type Language = keyof typeof translations
type Location = { id: string; name: string; is_active: boolean }
type Room = { id: string; room_number: string; location_id?: string }
type CategoryKey = "blankets" | "towels" | "cleaning" | "maintenance" | "amenities" | "activities" | "food" | "other"

type RequestCategory = {
  id: CategoryKey
  labelKey: CategoryKey
  icon: LucideIcon
}

const REQUEST_CATEGORIES: RequestCategory[] = [
  { id: "blankets", labelKey: "blankets", icon: BedDouble },
  { id: "towels", labelKey: "towels", icon: Bath },
  { id: "cleaning", labelKey: "cleaning", icon: Sparkles },
  { id: "maintenance", labelKey: "maintenance", icon: Wrench },
  { id: "amenities", labelKey: "amenities", icon: CheckCircle2 },
  { id: "activities", labelKey: "activities", icon: Compass },
  { id: "food", labelKey: "food", icon: Utensils },
  { id: "other", labelKey: "other", icon: ClipboardPenLine },
]

const HOSPITALITY_CONTACT_NAME = "Travis · Hospitality"
const HOSPITALITY_WHATSAPP = "+56993826127"
const HOSPITALITY_WHATSAPP_DISPLAY = "+56 9 9382 6127"

function getDeviceId() {
  const existing = localStorage.getItem("tablet_device_id")
  if (existing) return existing
  const created = `TABLET-${Date.now()}-${crypto.randomUUID()}`
  localStorage.setItem("tablet_device_id", created)
  return created
}

function languageFromPath(pathname: string): Language | null {
  const locale = pathname.split("/")[1]
  return locale === "es" || locale === "en" || locale === "de" ? locale : null
}

export function GuestRequestForm() {
  const pathname = usePathname()
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | "">("")
  const [guestName, setGuestName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [hasInternalSession, setHasInternalSession] = useState(false)
  const t = translations[language]

  useEffect(() => {
    const routeLanguage = languageFromPath(pathname)
    const savedLanguage = localStorage.getItem("language") as Language | null
    const nextLanguage = routeLanguage ?? (savedLanguage && translations[savedLanguage] ? savedLanguage : "es")
    setLanguage(nextLanguage)
    localStorage.setItem("language", nextLanguage)
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
        setAssignedLocation(loadedLocations.find((item) => item.id === selectedId) ?? loadedLocations[0] ?? null)

        const { data } = await supabase.auth.getUser()
        setHasInternalSession(Boolean(data.user))
      } catch (loadError) {
        console.error(loadError)
        setError(translations[nextLanguage].failed)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [locationId, pathname, roomId, supabase])

  function changeLanguage(next: Language) {
    setLanguage(next)
    localStorage.setItem("language", next)
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
          to: HOSPITALITY_WHATSAPP,
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

  const locationLabel = `${roomNumber || room?.room_number || t.roomPending}${assignedLocation?.name ? ` · ${assignedLocation.name}` : ""}`

  if (loading) return <ScreenMessage text={language === "de" ? "Wird geladen…" : language === "en" ? "Loading…" : "Cargando…"} />

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-5">
        <Card className="w-full max-w-md border border-border bg-card text-center">
          <CardContent className="py-12">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="bs-heading text-2xl text-foreground">{t.submitted}</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{t.submittedDetail}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (showAdminPanel) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-5">
        <Card className="w-full max-w-md border border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />{t.configTitle}</CardTitle>
            <CardDescription>{t.configDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAdminMode ? (
              <p className="text-sm leading-6 text-muted-foreground">{t.signInRequired}</p>
            ) : (
              <div className="space-y-2">
                <Label>{t.assignTo}</Label>
                <Select value={assignedLocation?.id ?? ""} onValueChange={handleLocationChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t.current}: <span className="font-medium text-primary">{assignedLocation?.name}</span></p>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => { setShowAdminPanel(false); setIsAdminMode(false) }}>{isAdminMode ? t.exitAdmin : t.close}</Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-6 md:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-7 flex items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{t.eyebrow}</p>
            <h1 className="bs-heading text-3xl leading-tight md:text-4xl">{t.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">{t.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {(["es", "en", "de"] as Language[]).map((locale) => (
              <Button key={locale} type="button" size="sm" variant={language === locale ? "secondary" : "ghost"} onClick={() => changeLanguage(locale)} className="px-2.5 uppercase">
                {locale}
              </Button>
            ))}
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => { setShowAdminPanel(true); setIsAdminMode(hasInternalSession) }} title={t.configTitle} aria-label={t.configTitle}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {(assignedLocation || room) && (
          <section className="mb-5 border border-border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t.location}</p>
                  <p className="mt-1 text-base font-medium text-foreground">{locationLabel}</p>
                </div>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">{t.online}</Badge>
            </div>
          </section>
        )}

        <Card className="border border-border bg-card py-0">
          <CardHeader className="border-b border-border py-5">
            <CardTitle className="text-lg">{t.submitTitle}</CardTitle>
            <CardDescription>{t.submitDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <div className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">{t.question}</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {REQUEST_CATEGORIES.map((category) => {
                    const Icon = category.icon
                    const active = selectedCategory === category.id
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategory(category.id)}
                        aria-pressed={active}
                        className={`group min-h-28 border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${active ? "border-primary bg-primary/10" : "border-border bg-secondary/35 hover:border-primary/40 hover:bg-secondary"}`}
                      >
                        <Icon className={`mb-5 h-5 w-5 ${active ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                        <span className="block text-sm font-medium leading-5 text-foreground">{t[category.labelKey]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest-name" className="text-sm text-foreground">{t.name} *</Label>
                <Input id="guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder={t.namePlaceholder} required className="h-12 border border-border bg-secondary text-foreground placeholder:text-muted-foreground" />
              </div>

              <Button type="submit" disabled={submitting || !selectedCategory || guestName.trim().length < 2 || !assignedLocation} className="h-12 w-full text-sm font-semibold">
                <Send className="h-4 w-4" />{submitting ? t.sending : t.send}
              </Button>

              <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.immediate}</p>
                  <p className="mt-1 text-xs font-medium text-primary">{HOSPITALITY_CONTACT_NAME}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" />{HOSPITALITY_WHATSAPP_DISPLAY}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(`https://wa.me/${HOSPITALITY_WHATSAPP.replace("+", "")}?text=${encodeURIComponent(`Hola, necesito asistencia de hospitalidad desde ${roomNumber || room?.room_number || assignedLocation?.name || "mi ubicación"}`)}`, "_blank")}
                  className="h-11 border border-primary/30 bg-transparent text-primary hover:bg-primary/10"
                >
                  <Phone className="h-4 w-4" />{t.whatsapp}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function ScreenMessage({ text }: { text: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{text}</div>
}

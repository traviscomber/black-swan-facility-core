"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Bath, BedDouble, CheckCircle2, ClipboardPenLine, Compass, Sparkles, Utensils, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Language = "es" | "en" | "de"
type GuestOption = { reservationId: string; displayName: string }
type Category = { id: string; icon: LucideIcon; es: string; en: string; de: string }

const COPY = {
  es: {
    eyebrow: "BLACK SWAN · HOSPITALIDAD",
    title: "Selecciona tu nombre",
    subtitle: "Solo aparecen huéspedes con una estadía activa hoy.",
    choose: "¿Quién eres?",
    noGuests: "No hay huéspedes con una estadía activa en este momento.",
    requestTitle: "¿Qué necesitas?",
    requestSubtitle: "Tu solicitud quedará vinculada automáticamente a tu estadía.",
    back: "Cambiar huésped",
    sending: "Enviando…",
    sent: "Solicitud enviada",
    sentDetail: "Hospitalidad ya recibió tu solicitud.",
  },
  en: {
    eyebrow: "BLACK SWAN · HOSPITALITY",
    title: "Select your name",
    subtitle: "Only guests with an active stay today are shown.",
    choose: "Who are you?",
    noGuests: "There are no guests with an active stay right now.",
    requestTitle: "What do you need?",
    requestSubtitle: "Your request will be linked automatically to your stay.",
    back: "Change guest",
    sending: "Sending…",
    sent: "Request sent",
    sentDetail: "Hospitality has received your request.",
  },
  de: {
    eyebrow: "BLACK SWAN · GASTBETREUUNG",
    title: "Wählen Sie Ihren Namen",
    subtitle: "Es werden nur Gäste mit einem heute aktiven Aufenthalt angezeigt.",
    choose: "Wer sind Sie?",
    noGuests: "Derzeit gibt es keine Gäste mit aktivem Aufenthalt.",
    requestTitle: "Was benötigen Sie?",
    requestSubtitle: "Ihre Anfrage wird automatisch Ihrem Aufenthalt zugeordnet.",
    back: "Gast wechseln",
    sending: "Wird gesendet…",
    sent: "Anfrage gesendet",
    sentDetail: "Das Hospitality-Team hat Ihre Anfrage erhalten.",
  },
} as const

const CATEGORIES: Category[] = [
  { id: "blankets", icon: BedDouble, es: "Mantas adicionales", en: "Extra blankets", de: "Zusätzliche Decken" },
  { id: "towels", icon: Bath, es: "Toallas", en: "Towels", de: "Handtücher" },
  { id: "cleaning", icon: Sparkles, es: "Limpieza", en: "Room cleaning", de: "Zimmerreinigung" },
  { id: "maintenance", icon: Wrench, es: "Mantenimiento", en: "Maintenance", de: "Technisches Problem" },
  { id: "amenities", icon: CheckCircle2, es: "Comodidades", en: "Amenities", de: "Zimmerausstattung" },
  { id: "activities", icon: Compass, es: "Actividades", en: "Activities", de: "Aktivitäten" },
  { id: "food", icon: Utensils, es: "Comida y bebida", en: "Food & beverage", de: "Speisen & Getränke" },
  { id: "other", icon: ClipboardPenLine, es: "Otra solicitud", en: "Other request", de: "Andere Anfrage" },
]

function localeFromPath(pathname: string): Language {
  const locale = pathname.split("/")[1]
  return locale === "en" || locale === "de" ? locale : "es"
}

export function GuestStayPortal() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const language = localeFromPath(pathname)
  const copy = COPY[language]
  const access = searchParams.get("access") ?? ""
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guests, setGuests] = useState<GuestOption[]>([])
  const [selected, setSelected] = useState<GuestOption | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const languageKey = useMemo(() => language, [language])

  useEffect(() => {
    async function load() {
      if (!access) {
        setError("Escanea el QR de Black Swan para continuar.")
        setLoading(false)
        return
      }
      try {
        const response = await fetch(`/api/guest-access?access=${encodeURIComponent(access)}`, { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "No fue posible cargar los huéspedes activos.")
        setGuests(payload.guests ?? [])
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los huéspedes activos.")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [access])

  async function send(category: Category) {
    if (!selected) return
    setSending(category.id)
    setError(null)
    try {
      const response = await fetch("/api/guest-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access,
          reservationId: selected.reservationId,
          category: category.id,
          requestLabel: category[languageKey],
          language,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "No fue posible enviar la solicitud.")
      setSent(true)
      window.setTimeout(() => setSent(false), 3000)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "No fue posible enviar la solicitud.")
    } finally {
      setSending(null)
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 border-b border-border pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
          <h1 className="bs-heading mt-2 text-3xl">{selected ? selected.displayName : copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{selected ? copy.requestSubtitle : copy.subtitle}</p>
        </header>

        {error && <div className="mb-4 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {sent && (
          <div className="mb-4 border border-primary/30 bg-primary/10 p-4">
            <p className="font-medium text-foreground">{copy.sent}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.sentDetail}</p>
          </div>
        )}

        {!selected ? (
          <Card className="border border-border bg-card py-0">
            <CardHeader className="border-b border-border py-5">
              <CardTitle className="text-lg">{copy.choose}</CardTitle>
              <CardDescription>{copy.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 py-5">
              {guests.length === 0 && <p className="py-6 text-sm text-muted-foreground">{copy.noGuests}</p>}
              {guests.map((guest) => (
                <button
                  key={guest.reservationId}
                  type="button"
                  onClick={() => setSelected(guest)}
                  className="flex w-full items-center justify-between border border-border bg-secondary/30 px-4 py-4 text-left transition hover:border-primary/40 hover:bg-secondary"
                >
                  <span className="font-medium text-foreground">{guest.displayName}</span>
                  <span className="text-primary">→</span>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border bg-card py-0">
            <CardHeader className="border-b border-border py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{copy.requestTitle}</CardTitle>
                  <CardDescription>{copy.requestSubtitle}</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(null)}>{copy.back}</Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 py-5 sm:grid-cols-4">
              {CATEGORIES.map((category) => {
                const Icon = category.icon
                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled={Boolean(sending)}
                    onClick={() => void send(category)}
                    className="min-h-28 border border-border bg-secondary/30 p-4 text-left transition hover:border-primary/40 hover:bg-secondary disabled:opacity-50"
                  >
                    <Icon className="mb-5 h-5 w-5 text-primary" />
                    <span className="block text-sm font-medium leading-5">{category[languageKey]}</span>
                    {sending === category.id && <span className="mt-2 block text-xs text-muted-foreground">{copy.sending}</span>}
                  </button>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  DollarSign,
  Calendar,
  Zap,
} from "lucide-react"
import { differenceInDays, format, addDays, parseISO, isWithinInterval } from "date-fns"
import { es } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"

// ── Types ──────────────────────────────────────────────────────────────────

interface PricingRule {
  id: string
  room_id: string | null
  season_name: string | null
  start_date: string
  end_date: string
  rate_multiplier: number
  min_stay: number
}

interface Room {
  id: string
  room_number: string
  room_type: string
  rate_per_night: number
  location: string | null
  capacity: number
  status: string
}

interface Reservation {
  id: string
  room_id: string | null
  bed_id: string | null
  check_in: string
  check_out: string
  status: string
  total_amount: number
  guest_name: string
}

interface RoomBlock {
  id: string
  room_id: string
  start_date: string
  end_date: string
  status: string
}

interface Gap {
  room_id: string
  room_number: string
  location: string
  gap_start: string
  gap_end: string
  gap_nights: number
  rate_per_night: number
  potential_revenue: number
  prev_guest: string | null
  next_guest: string | null
  is_orphan: boolean
}

interface Suggestion {
  gap: Gap
  recommended_rate: number
  discount_pct: number
  reason: string
  urgency: "low" | "medium" | "high"
}

// ── C2 — Pricing Overlay ───────────────────────────────────────────────────

function PricingOverlay({
  rooms,
  pricingRules,
}: {
  rooms: Room[]
  pricingRules: PricingRule[]
}) {
  const today = new Date()

  const enriched = useMemo(() => {
    return rooms.map((room) => {
      // Find active rules for this room (global or room-specific)
      const applicableRules = pricingRules.filter(
        (r) =>
          (r.room_id === null || r.room_id === room.id) &&
          isWithinInterval(today, {
            start: parseISO(r.start_date),
            end: parseISO(r.end_date),
          }),
      )

      const activeRule = applicableRules[0] ?? null
      const baseRate = Number(room.rate_per_night) || 0
      const effectiveRate = activeRule ? baseRate * Number(activeRule.rate_multiplier) : baseRate
      const delta = effectiveRate - baseRate

      // Upcoming rules (next 90 days)
      const upcoming = pricingRules
        .filter(
          (r) =>
            (r.room_id === null || r.room_id === room.id) &&
            parseISO(r.start_date) > today &&
            parseISO(r.start_date) <= addDays(today, 90),
        )
        .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())
        .slice(0, 2)

      return { room, activeRule, effectiveRate, delta, upcoming }
    })
  }, [rooms, pricingRules, today])

  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? enriched : enriched.slice(0, 4)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(({ room, activeRule, effectiveRate, delta, upcoming }) => (
          <div key={room.id} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{room.room_number}</p>
                <p className="text-xs text-muted-foreground">{room.location ?? "Sin ubicacion"}</p>
              </div>
              {activeRule ? (
                <Badge
                  variant={Number(activeRule.rate_multiplier) > 1 ? "default" : "secondary"}
                  className="shrink-0 text-xs"
                >
                  {activeRule.season_name ?? "Regla activa"}
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                  Tarifa base
                </Badge>
              )}
            </div>

            <div className="mt-3 flex items-end gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Tarifa efectiva</p>
                <p className="text-lg font-bold tabular-nums">
                  ${effectiveRate.toLocaleString("es-CL")}
                </p>
              </div>
              {activeRule && delta !== 0 && (
                <div className={`flex items-center gap-0.5 text-xs ${delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{delta > 0 ? "+" : ""}{delta.toLocaleString("es-CL")}</span>
                </div>
              )}
            </div>

            {activeRule && (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                ×{Number(activeRule.rate_multiplier).toFixed(2)} hasta{" "}
                {format(parseISO(activeRule.end_date), "d MMM", { locale: es })}
              </p>
            )}

            {upcoming.length > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {upcoming.map((u) => (
                  <p key={u.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {format(parseISO(u.start_date), "d MMM", { locale: es })}
                    </span>{" "}
                    → ×{Number(u.rate_multiplier).toFixed(2)}{" "}
                    {u.season_name ? `(${u.season_name})` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {enriched.length > 4 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
              Ver {enriched.length - 4} habitaciones mas
            </>
          )}
        </Button>
      )}

      {pricingRules.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No hay reglas de precios configuradas. Crea reglas en{" "}
          <span className="font-medium text-foreground">Configuracion → Tarifas</span> para
          activar este panel.
        </p>
      )}
    </div>
  )
}

// ── C3 — Gap Detector ──────────────────────────────────────────────────────

function computeGaps(
  rooms: Room[],
  reservations: Reservation[],
  blocks: RoomBlock[],
  windowDays = 90,
): Gap[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = addDays(today, windowDays)
  const gaps: Gap[] = []

  for (const room of rooms) {
    if (!room.rate_per_night) continue

    // Build sorted occupancy intervals for this room
    const roomRes = reservations
      .filter((r) => r.room_id === room.id && !["cancelled", "void", "no_show"].includes(r.status))
      .map((r) => ({
        start: parseISO(r.check_in),
        end: parseISO(r.check_out),
        guest: r.guest_name,
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())

    const roomBlocks = blocks
      .filter((b) => b.room_id === room.id && b.status === "active")
      .map((b) => ({ start: parseISO(b.start_date), end: parseISO(b.end_date), guest: null }))

    const occupied = [...roomRes, ...roomBlocks].sort((a, b) => a.start.getTime() - b.start.getTime())

    // Scan for gaps between consecutive reservations within the window
    const windowStart = today
    const windowEnd = horizon

    // Synthetic boundaries
    const segments = [
      { start: new Date(0), end: windowStart, guest: null as string | null },
      ...occupied,
      { start: windowEnd, end: new Date(8.64e15), guest: null as string | null },
    ]

    for (let i = 0; i < segments.length - 1; i++) {
      const gapStart = segments[i].end
      const gapEnd = segments[i + 1].start

      if (gapStart < windowStart || gapEnd > windowEnd) continue
      if (gapStart >= gapEnd) continue

      const nights = differenceInDays(gapEnd, gapStart)
      if (nights < 1) continue

      const rate = Number(room.rate_per_night) || 0

      gaps.push({
        room_id: room.id,
        room_number: room.room_number,
        location: room.location ?? "",
        gap_start: format(gapStart, "yyyy-MM-dd"),
        gap_end: format(gapEnd, "yyyy-MM-dd"),
        gap_nights: nights,
        rate_per_night: rate,
        potential_revenue: rate * nights,
        prev_guest: segments[i].guest,
        next_guest: segments[i + 1].guest,
        is_orphan: nights <= 2,
      })
    }
  }

  return gaps.sort((a, b) => parseISO(a.gap_start).getTime() - parseISO(b.gap_start).getTime())
}

function GapDetector({
  gaps,
  loading,
}: {
  gaps: Gap[]
  loading: boolean
}) {
  const [showAll, setShowAll] = useState(false)

  const orphans = gaps.filter((g) => g.is_orphan)
  const totalPotential = gaps.reduce((s, g) => s + g.potential_revenue, 0)

  const visible = showAll ? gaps : gaps.slice(0, 6)

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Calculando gaps...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{gaps.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gaps detectados</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-amber-500">{orphans.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Huerfanos (≤2 noches)</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-emerald-500">
            ${totalPotential.toLocaleString("es-CL")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue potencial</p>
        </div>
      </div>

      {gaps.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin gaps detectados en los proximos 90 dias. El calendario esta cubierto.
        </p>
      )}

      {/* Gap list */}
      <div className="space-y-2">
        {visible.map((gap, i) => {
          const daysUntil = differenceInDays(parseISO(gap.gap_start), new Date())
          const urgency = daysUntil < 7 ? "high" : daysUntil < 30 ? "medium" : "low"

          return (
            <div
              key={`${gap.room_id}-${gap.gap_start}`}
              className={`flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/30 ${
                gap.is_orphan ? "border-amber-500/30 bg-amber-500/5" : ""
              }`}
            >
              <div className="shrink-0 text-center">
                <div
                  className={`h-2 w-2 mx-auto rounded-full ${
                    urgency === "high"
                      ? "bg-rose-500"
                      : urgency === "medium"
                        ? "bg-amber-500"
                        : "bg-muted-foreground"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                <div>
                  <p className="font-medium truncate">{gap.room_number}</p>
                  <p className="text-xs text-muted-foreground">{gap.location}</p>
                </div>
                <div>
                  <p className="tabular-nums">
                    {format(parseISO(gap.gap_start), "d MMM", { locale: es })}
                    <ArrowRight className="inline h-3 w-3 mx-0.5" />
                    {format(parseISO(gap.gap_end), "d MMM", { locale: es })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gap.gap_nights} {gap.gap_nights === 1 ? "noche" : "noches"}
                    {gap.is_orphan && (
                      <span className="ml-1 text-amber-500">huerfano</span>
                    )}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs text-muted-foreground">
                    {gap.prev_guest ? `← ${gap.prev_guest.split(" ")[0]}` : "inicio periodo"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gap.next_guest ? `→ ${gap.next_guest.split(" ")[0]}` : "sin reserva"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums text-emerald-500">
                    ${gap.potential_revenue.toLocaleString("es-CL")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${gap.rate_per_night.toLocaleString("es-CL")}/noche
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {gaps.length > 6 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
              Ver {gaps.length - 6} gaps mas
            </>
          )}
        </Button>
      )}
    </div>
  )
}

// ── C4 — Smart Suggestions ─────────────────────────────────────────────────

function computeSuggestions(gaps: Gap[], pricingRules: PricingRule[]): Suggestion[] {
  return gaps
    .filter((g) => g.gap_nights >= 1)
    .map((gap) => {
      const today = new Date()
      const gapDate = parseISO(gap.gap_start)
      const daysUntil = differenceInDays(gapDate, today)

      // Check if there's an active pricing rule for this period
      const rule = pricingRules.find(
        (r) =>
          (r.room_id === null || r.room_id === gap.room_id) &&
          isWithinInterval(gapDate, {
            start: parseISO(r.start_date),
            end: parseISO(r.end_date),
          }),
      )

      const multiplier = rule ? Number(rule.rate_multiplier) : 1
      const baseRate = gap.rate_per_night

      // Discount logic
      let discountPct = 0
      let reason = ""
      let urgency: "low" | "medium" | "high" = "low"

      if (gap.is_orphan) {
        discountPct = daysUntil < 3 ? 30 : 20
        reason = `Gap huerfano de ${gap.gap_nights} noche${gap.gap_nights > 1 ? "s" : ""} — precio agresivo mejora la ocupacion`
        urgency = daysUntil < 7 ? "high" : "medium"
      } else if (daysUntil < 7) {
        discountPct = 15
        reason = "Ventana de corto plazo — descuento moderado para acelerar conversion"
        urgency = "high"
      } else if (daysUntil < 30) {
        discountPct = 10
        reason = "Ventana media — leve descuento para destacar en busquedas"
        urgency = "medium"
      } else {
        discountPct = 5
        reason = "Ventana larga — promocion anticipada para mejorar proyeccion"
        urgency = "low"
      }

      if (rule && multiplier > 1) {
        discountPct = Math.max(0, discountPct - 5)
        reason += `. Tarifa de temporada activa (×${multiplier.toFixed(2)}).`
      }

      const recommendedRate = Math.round(baseRate * multiplier * (1 - discountPct / 100))

      return {
        gap,
        recommended_rate: recommendedRate,
        discount_pct: discountPct,
        reason,
        urgency,
      }
    })
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.urgency] - order[b.urgency]
    })
    .slice(0, 8)
}

function SmartSuggestions({
  suggestions,
  loading,
  onApplyAutoFill,
}: {
  suggestions: Suggestion[]
  loading: boolean
  onApplyAutoFill: (gap: Gap, rate: number) => void
}) {
  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Generando sugerencias...
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin sugerencias disponibles. No se detectaron gaps accionables en el periodo.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s, i) => (
        <div
          key={`${s.gap.room_id}-${s.gap.gap_start}`}
          className={`rounded-lg border p-4 ${
            s.urgency === "high"
              ? "border-rose-500/30 bg-rose-500/5"
              : s.urgency === "medium"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border bg-card"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`mt-0.5 rounded-full p-1.5 ${
                  s.urgency === "high"
                    ? "bg-rose-500/15 text-rose-500"
                    : s.urgency === "medium"
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s.urgency === "high" ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <Lightbulb className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm">{s.gap.room_number}</p>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(s.gap.gap_start), "d MMM", { locale: es })}
                    <ArrowRight className="inline h-3 w-3 mx-0.5" />
                    {format(parseISO(s.gap.gap_end), "d MMM", { locale: es })}
                    {" · "}{s.gap.gap_nights} noches
                  </span>
                  <Badge
                    variant={
                      s.urgency === "high"
                        ? "destructive"
                        : s.urgency === "medium"
                          ? "outline"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {s.urgency === "high" ? "Urgente" : s.urgency === "medium" ? "Pronto" : "Normal"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.reason}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-xs text-muted-foreground line-through tabular-nums">
                  ${s.gap.rate_per_night.toLocaleString("es-CL")}
                </p>
                <p className="font-bold tabular-nums text-emerald-500">
                  ${s.recommended_rate.toLocaleString("es-CL")}
                </p>
                <p className="text-xs text-muted-foreground">−{s.discount_pct}%</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs"
                onClick={() => onApplyAutoFill(s.gap, s.recommended_rate)}
              >
                <Zap className="mr-1.5 h-3 w-3" />
                Auto-fill
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── C5 — Auto-Fill Dialog ──────────────────────────────────────────────────

function AutoFillDialog({
  gap,
  rate,
  onClose,
  onSuccess,
}: {
  gap: Gap
  rate: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nights = gap.gap_nights
  const total = rate * nights

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!guestName.trim()) { setError("El nombre del huesped es obligatorio"); return }
    setSubmitting(true)
    setError(null)

    const res = await fetch("/api/bookings/revenue/auto-fill-gap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: gap.room_id,
        gap_start: gap.gap_start,
        gap_end: gap.gap_end,
        rate_per_night: rate,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim() || null,
        num_guests: 1,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Error al crear la reserva")
      setSubmitting(false)
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Auto-fill gap"
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <h3 className="font-semibold text-base mb-1">Completar gap automaticamente</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {gap.room_number} &middot;{" "}
          {format(parseISO(gap.gap_start), "d MMM", { locale: es })} -{" "}
          {format(parseISO(gap.gap_end), "d MMM", { locale: es })} &middot;{" "}
          {nights} {nights === 1 ? "noche" : "noches"} &middot;{" "}
          <span className="font-semibold text-foreground">${total.toLocaleString("es-CL")}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="af-guest-name" className="text-xs font-medium">
              Nombre del huesped <span className="text-rose-500">*</span>
            </label>
            <input
              id="af-guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Nombre completo"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="af-guest-email" className="text-xs font-medium">
              Email (opcional)
            </label>
            <input
              id="af-guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-500">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Creando..." : "Crear reserva"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export function RevenueIntelligence({
  locations,
}: {
  locations: { id: string; name: string }[]
}) {
  const [activeTab, setActiveTab] = useState<"pricing" | "gaps" | "suggestions">("gaps")
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [autoFillTarget, setAutoFillTarget] = useState<{ gap: Gap; rate: number } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [roomsRes, resRes, blocksRes, prRes] = await Promise.all([
        supabase.from("rooms").select("id,room_number,room_type,rate_per_night,location,capacity,status"),
        supabase
          .from("reservations")
          .select("id,room_id,bed_id,check_in,check_out,status,total_amount,guest_name")
          .gte("check_out", new Date().toISOString().substring(0, 10))
          .lte("check_in", format(addDays(new Date(), 90), "yyyy-MM-dd")),
        supabase
          .from("room_blocks")
          .select("id,room_id,start_date,end_date,status")
          .eq("status", "active"),
        supabase.from("pricing_rules").select("*"),
      ])
      if (cancelled) return
      setRooms((roomsRes.data ?? []) as Room[])
      setReservations((resRes.data ?? []) as Reservation[])
      setBlocks((blocksRes.data ?? []) as RoomBlock[])
      setPricingRules((prRes.data ?? []) as PricingRule[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  const gaps = useMemo(() => computeGaps(rooms, reservations, blocks), [rooms, reservations, blocks])
  const suggestions = useMemo(() => computeSuggestions(gaps, pricingRules), [gaps, pricingRules])

  const tabs = [
    { id: "gaps" as const, label: "Detector de Gaps", count: gaps.length, icon: Calendar },
    { id: "suggestions" as const, label: "Sugerencias IA", count: suggestions.length, icon: Lightbulb },
    { id: "pricing" as const, label: "Pricing Overlay", count: rooms.length, icon: DollarSign },
  ]

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  activeTab === tab.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4">
        {activeTab === "pricing" && (
          <PricingOverlay rooms={rooms} pricingRules={pricingRules} />
        )}
        {activeTab === "gaps" && (
          <GapDetector gaps={gaps} loading={loading} />
        )}
        {activeTab === "suggestions" && (
          <SmartSuggestions
            suggestions={suggestions}
            loading={loading}
            onApplyAutoFill={(gap, rate) => setAutoFillTarget({ gap, rate })}
          />
        )}
      </div>

      {/* Auto-fill dialog */}
      {autoFillTarget && (
        <AutoFillDialog
          gap={autoFillTarget.gap}
          rate={autoFillTarget.rate}
          onClose={() => setAutoFillTarget(null)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ConciergeBell, Flame, Phone, Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { BOOKING_COMMAND_SELECTION_EVENT } from "@/components/booking-calendar-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/hooks/use-language"
import { createClient } from "@/lib/supabase/client"

type ReservationContext = {
  id: string
  guest_name: string
  guest_phone: string | null
  guest_email: string | null
  room_id: string | null
  location_id: string | null
  check_in?: string | null
  check_out?: string | null
  status?: string | null
  room: { room_number: string; location: { name: string } | null } | null
}

type ReservationOption = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  room: { room_number: string; location: { name: string } | null } | null
}

type QuickActionKey = "towels" | "cleaning" | "heating" | "request" | "call_guest"
type Language = "en" | "es" | "de"

type Copy = {
  title: string
  selectReservation: string
  reservation: string
  loadingReservations: string
  oneClick: string
  noHouse: string
  noRoom: string
  loadingError: string
  selectFirst: string
  createError: string
  created: string
  creating: string
  duplicate: string
  actions: Record<QuickActionKey, string>
}

const COPY: Record<Language, Copy> = {
  en: {
    title: "Quick actions",
    selectReservation: "Select a reservation",
    reservation: "Reservation",
    loadingReservations: "Loading reservations…",
    oneClick: "1 click = 1 task",
    noHouse: "No property",
    noRoom: "No room",
    loadingError: "Could not load the reservation for quick actions",
    selectFirst: "Select a reservation first",
    createError: "Could not create the task",
    created: "created",
    creating: "Creating…",
    duplicate: "An active task of this type already exists for this reservation",
    actions: {
      towels: "Towels",
      cleaning: "Cleaning",
      heating: "Check heating",
      request: "Create request",
      call_guest: "Call guest",
    },
  },
  es: {
    title: "Acciones rápidas",
    selectReservation: "Selecciona una reserva",
    reservation: "Reserva",
    loadingReservations: "Cargando reservas…",
    oneClick: "1 click = 1 tarea",
    noHouse: "Sin casa",
    noRoom: "Sin habitación",
    loadingError: "No fue posible cargar la reserva para acciones rápidas",
    selectFirst: "Selecciona primero una reserva",
    createError: "No fue posible crear la tarea",
    created: "creada",
    creating: "Creando…",
    duplicate: "Ya existe una tarea activa de este tipo para esta reserva",
    actions: {
      towels: "Toallas",
      cleaning: "Limpieza",
      heating: "Revisar calefacción",
      request: "Registrar solicitud",
      call_guest: "Llamar huésped",
    },
  },
  de: {
    title: "Schnellaktionen",
    selectReservation: "Reservierung auswählen",
    reservation: "Reservierung",
    loadingReservations: "Reservierungen werden geladen…",
    oneClick: "1 Klick = 1 Aufgabe",
    noHouse: "Keine Unterkunft",
    noRoom: "Kein Zimmer",
    loadingError: "Reservierung für Schnellaktionen konnte nicht geladen werden",
    selectFirst: "Zuerst eine Reservierung auswählen",
    createError: "Aufgabe konnte nicht erstellt werden",
    created: "erstellt",
    creating: "Wird erstellt…",
    duplicate: "Für diese Reservierung gibt es bereits eine aktive Aufgabe dieses Typs",
    actions: {
      towels: "Handtücher",
      cleaning: "Reinigung",
      heating: "Heizung prüfen",
      request: "Anfrage erstellen",
      call_guest: "Gast anrufen",
    },
  },
}

const ACTION_ICONS: Record<QuickActionKey, typeof ConciergeBell> = {
  towels: Sparkles,
  cleaning: Sparkles,
  heating: Flame,
  request: Plus,
  call_guest: Phone,
}

const ACTION_KEYS: QuickActionKey[] = ["towels", "cleaning", "heating", "request", "call_guest"]

function chileOperatingDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

function reservationLabel(reservation: ReservationOption, copy: Copy) {
  const location = reservation.room?.location?.name ?? copy.noHouse
  const room = reservation.room?.room_number ?? copy.noRoom
  return `${reservation.guest_name} · ${location} · ${room} · ${reservation.check_in} → ${reservation.check_out}`
}

export function CompactBookingQuickActions() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = COPY[(language in COPY ? language : "en") as Language]
  const [open, setOpen] = useState(false)
  const [reservation, setReservation] = useState<ReservationContext | null>(null)
  const [reservationOptions, setReservationOptions] = useState<ReservationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [saving, setSaving] = useState<QuickActionKey | null>(null)

  const loadReservation = useCallback(async (reservationId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from("reservations")
      .select("id, guest_name, guest_phone, guest_email, room_id, location_id, check_in, check_out, status, room:rooms(room_number, location:locations(name))")
      .eq("id", reservationId)
      .single()

    if (error) {
      setReservation(null)
      toast.error(copy.loadingError)
    } else {
      setReservation(data as unknown as ReservationContext)
    }
    setLoading(false)
  }, [copy.loadingError, supabase])

  const loadReservationOptions = useCallback(async () => {
    setOptionsLoading(true)
    const { data, error } = await supabase
      .from("reservations")
      .select("id, guest_name, check_in, check_out, status, room:rooms(room_number, location:locations(name))")
      .not("status", "in", "(cancelled,canceled,checked_out,checked-out)")
      .order("check_in", { ascending: true })
      .limit(100)

    if (error) {
      setReservationOptions([])
    } else {
      setReservationOptions((data ?? []) as unknown as ReservationOption[])
    }
    setOptionsLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadReservationOptions()
  }, [loadReservationOptions])

  useEffect(() => {
    const onSelection = (event: Event) => {
      const reservationId = (event as CustomEvent<{ reservationId?: string | null }>).detail?.reservationId
      if (!reservationId) return
      void loadReservation(reservationId)
    }

    window.addEventListener(BOOKING_COMMAND_SELECTION_EVENT, onSelection)
    return () => window.removeEventListener(BOOKING_COMMAND_SELECTION_EVENT, onSelection)
  }, [loadReservation])

  const hasActiveHospitalityRequest = useCallback(async (requestType: string) => {
    if (!reservation) return false
    const { data, error } = await supabase
      .from("hospitality_requests")
      .select("id")
      .eq("reservation_id", reservation.id)
      .eq("request_type", requestType)
      .not("status", "in", "(completed,resolved,cancelled,canceled)")
      .limit(1)
    if (error) throw error
    return (data?.length ?? 0) > 0
  }, [reservation, supabase])

  const createHospitalityRequest = useCallback(async (
    requestType: string,
    category: string,
    description: string,
  ) => {
    if (!reservation) return { error: new Error(copy.selectFirst), duplicate: false }
    if (await hasActiveHospitalityRequest(requestType)) return { error: null, duplicate: true }

    const result = await supabase.from("hospitality_requests").insert({
      reservation_id: reservation.id,
      room_id: reservation.room_id,
      location_id: reservation.location_id,
      guest_name: reservation.guest_name,
      guest_phone: reservation.guest_phone,
      guest_email: reservation.guest_email,
      request_type: requestType,
      category,
      description,
      priority: "normal",
      status: "pending",
    })
    return { error: result.error, duplicate: false }
  }, [copy.selectFirst, hasActiveHospitalityRequest, reservation, supabase])

  const runAction = useCallback(async (key: QuickActionKey) => {
    if (!reservation || saving !== null) {
      if (!reservation) toast.error(copy.selectFirst)
      return
    }

    setSaving(key)
    try {
      let error: { message: string } | null = null
      let duplicate = false

      if (key === "cleaning") {
        const today = chileOperatingDate()
        const existing = await supabase
          .from("housekeeping_tasks")
          .select("id")
          .eq("reservation_id", reservation.id)
          .eq("task_type", "stayover_cleaning")
          .eq("service_date", today)
          .not("status", "in", "(completed,cancelled,canceled)")
          .limit(1)

        if (existing.error) {
          error = existing.error
        } else if ((existing.data?.length ?? 0) > 0) {
          duplicate = true
        } else {
          const result = await supabase.from("housekeeping_tasks").insert({
            reservation_id: reservation.id,
            room_id: reservation.room_id,
            task_type: "stayover_cleaning",
            service_date: today,
            status: "pending",
            priority: "normal",
            notes: `Cleaning requested for ${reservation.guest_name}.`,
          })
          error = result.error
        }
      } else if (key === "towels") {
        const result = await createHospitalityRequest("Towels", "towels", `Prepare or replenish towels for ${reservation.guest_name}.`)
        error = result.error
        duplicate = result.duplicate
      } else if (key === "heating") {
        const result = await createHospitalityRequest("heating_check", "stay_detail", `Check heating for ${reservation.guest_name}.`)
        error = result.error
        duplicate = result.duplicate
      } else if (key === "call_guest") {
        const result = await createHospitalityRequest("guest_call", "stay_detail", `Call ${reservation.guest_name}${reservation.guest_phone ? ` at ${reservation.guest_phone}` : ""}.`)
        error = result.error
        duplicate = result.duplicate
      } else {
        const result = await createHospitalityRequest("guest_request", "hospitality", `Operational request for ${reservation.guest_name}.`)
        error = result.error
        duplicate = result.duplicate
      }

      if (error) toast.error(`${copy.createError}: ${error.message}`)
      else if (duplicate) toast.info(copy.duplicate)
      else toast.success(`${copy.actions[key]} ${copy.created}`)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      toast.error(`${copy.createError}: ${message}`)
    } finally {
      setSaving(null)
    }
  }, [copy, createHospitalityRequest, reservation, saving, supabase])

  const context = reservation
    ? `${reservation.guest_name} · ${reservation.room?.location?.name ?? copy.noHouse} · ${reservation.room?.room_number ?? copy.noRoom}`
    : copy.selectReservation

  return (
    <section className="mx-3 mt-3 overflow-hidden border border-border/50 bg-[var(--bs-bg-secondary)] md:mx-4">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <ConciergeBell className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{copy.title}</p>
            <p className="truncate text-xs text-muted-foreground">{context}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reservation && <Badge variant="secondary">{copy.oneClick}</Badge>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/30 px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label htmlFor="quick-actions-reservation" className="shrink-0 text-xs font-medium text-muted-foreground">
              {copy.reservation}
            </label>
            <select
              id="quick-actions-reservation"
              value={reservation?.id ?? ""}
              onChange={(event) => {
                const reservationId = event.target.value
                if (!reservationId) {
                  setReservation(null)
                  return
                }
                void loadReservation(reservationId)
              }}
              disabled={optionsLoading || loading || saving !== null}
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{optionsLoading ? copy.loadingReservations : copy.selectReservation}</option>
              {reservationOptions.map((option) => (
                <option key={option.id} value={option.id}>{reservationLabel(option, copy)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {ACTION_KEYS.map((key) => {
              const Icon = ACTION_ICONS[key]
              return (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!reservation || loading || saving !== null}
                  onClick={() => void runAction(key)}
                >
                  <Icon className="mr-2 h-3.5 w-3.5" />
                  {saving === key ? copy.creating : copy.actions[key]}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BedDouble, CheckCircle2, DoorOpen, LogOut } from "lucide-react"
import { BOOKING_COMMAND_SELECTION_EVENT } from "@/components/booking-calendar-timeline"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Reservation = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  room: { room_number: string | null; operational_status: string | null } | null
  bed: { bed_number: string | null } | null
}

type StayState = "arrives_today" | "not_ready" | "checked_in" | "leaves_today" | "checked_out" | "upcoming"

const COPY = {
  es: {
    arrives_today: "LLEGA HOY",
    not_ready: "HABITACIÓN NO LISTA",
    checked_in: "ALOJADO",
    leaves_today: "SALE HOY",
    checked_out: "SALIDA COMPLETADA",
    upcoming: "PRÓXIMA ESTADÍA",
    next: "Próxima acción",
    prepare: "Preparar habitación antes de registrar la entrada.",
    checkin: "Habitación lista. Registrar entrada cuando llegue el huésped.",
    stay: "Atender solicitudes y operación de la estadía.",
    checkout: "Verificar salida y usar Preparar salida antes de cerrar la estadía.",
    done: "Estadía cerrada. Verificar tareas posteriores a la salida.",
    upcomingDetail: "Revisar preparación antes del día de llegada.",
    bed: "Cama",
  },
  en: {
    arrives_today: "ARRIVES TODAY",
    not_ready: "ROOM NOT READY",
    checked_in: "IN HOUSE",
    leaves_today: "LEAVES TODAY",
    checked_out: "CHECKOUT COMPLETE",
    upcoming: "UPCOMING STAY",
    next: "Next action",
    prepare: "Prepare the room before checking the guest in.",
    checkin: "Room ready. Check the guest in when they arrive.",
    stay: "Handle requests and the active stay operation.",
    checkout: "Verify departure and use Prepare checkout before closing the stay.",
    done: "Stay closed. Verify post-checkout tasks.",
    upcomingDetail: "Review room preparation before arrival day.",
    bed: "Bed",
  },
  de: {
    arrives_today: "ANKUNFT HEUTE",
    not_ready: "ZIMMER NICHT BEREIT",
    checked_in: "EINGECHECKT",
    leaves_today: "ABREISE HEUTE",
    checked_out: "ABREISE ABGESCHLOSSEN",
    upcoming: "BEVORSTEHENDER AUFENTHALT",
    next: "Nächste Aktion",
    prepare: "Zimmer vor dem Check-in vorbereiten.",
    checkin: "Zimmer bereit. Gast bei Ankunft einchecken.",
    stay: "Anfragen und laufenden Aufenthalt betreuen.",
    checkout: "Abreise prüfen und vor dem Abschluss ‚Abreise vorbereiten‘ verwenden.",
    done: "Aufenthalt abgeschlossen. Aufgaben nach der Abreise prüfen.",
    upcomingDetail: "Zimmerbereitschaft vor dem Anreisetag prüfen.",
    bed: "Bett",
  },
} as const

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

function chileDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

function getStayState(reservation: Reservation): StayState {
  const today = chileDate()
  if (["checked_out", "checked-out"].includes(reservation.status)) return "checked_out"
  if (["checked_in", "checked-in"].includes(reservation.status)) return reservation.check_out === today ? "leaves_today" : "checked_in"
  if (reservation.check_in === today) {
    const roomStatus = reservation.room?.operational_status
    if (roomStatus !== "ready" && roomStatus !== "inspected" && roomStatus !== "occupied") return "not_ready"
    return "arrives_today"
  }
  return "upcoming"
}

export function GuestStayStatusStrip() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = COPY[language]
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(LOCALES[language], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Santiago",
  }), [language])
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [reservation, setReservation] = useState<Reservation | null>(null)

  const load = useCallback(async () => {
    if (!reservationId) {
      setReservation(null)
      return
    }
    const { data, error } = await supabase
      .from("reservations")
      .select("id,guest_name,check_in,check_out,status,room:rooms(room_number,operational_status),bed:beds(bed_number)")
      .eq("id", reservationId)
      .maybeSingle()
    if (!error) setReservation((data ?? null) as unknown as Reservation | null)
  }, [reservationId, supabase])

  useEffect(() => {
    const onSelection = (event: Event) => {
      const id = (event as CustomEvent<{ reservationId?: string }>).detail?.reservationId
      if (id) setReservationId(id)
    }
    window.addEventListener(BOOKING_COMMAND_SELECTION_EVENT, onSelection)
    return () => window.removeEventListener(BOOKING_COMMAND_SELECTION_EVENT, onSelection)
  }, [])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("guest-stay-status-strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  if (!reservation) return null

  const state = getStayState(reservation)
  const detail = state === "not_ready" ? copy.prepare
    : state === "arrives_today" ? copy.checkin
      : state === "checked_in" ? copy.stay
        : state === "leaves_today" ? copy.checkout
          : state === "checked_out" ? copy.done
            : copy.upcomingDetail
  const Icon = state === "not_ready" ? AlertTriangle : state === "checked_out" ? CheckCircle2 : state === "leaves_today" ? LogOut : state === "arrives_today" ? DoorOpen : BedDouble
  const warning = state === "not_ready" || state === "leaves_today"
  const checkIn = dateFormatter.format(new Date(`${reservation.check_in}T12:00:00`))
  const checkOut = dateFormatter.format(new Date(`${reservation.check_out}T12:00:00`))

  return (
    <section className="border-b border-border bg-card px-4 py-3 md:px-6">
      <div className={`mx-auto flex max-w-[1600px] flex-col gap-3 border px-4 py-3 md:flex-row md:items-center md:justify-between ${warning ? "border-amber-400/35 bg-amber-400/8" : "border-primary/25 bg-primary/5"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center border ${warning ? "border-amber-400/35 text-amber-500" : "border-primary/30 text-primary"}`}><Icon className="h-4 w-4" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold tracking-[0.14em] ${warning ? "text-amber-500" : "text-primary"}`}>{copy[state]}</span>
              <span className="text-sm font-medium text-foreground">{reservation.guest_name}</span>
              <span className="text-xs text-muted-foreground">{reservation.room?.room_number ?? "—"}{reservation.bed?.bed_number ? ` · ${copy.bed} ${reservation.bed.bed_number}` : ""}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">{copy.next}:</span> {detail}</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{checkIn} → {checkOut}</div>
      </div>
    </section>
  )
}

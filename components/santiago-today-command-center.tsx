"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, BedDouble, ClipboardList, DoorOpen, LogOut, RefreshCw, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Arrival = {
  id: string
  guest_name: string
  room_id: string | null
  rooms: { room_number: string | null; operational_status: string | null } | null
}

type Copy = {
  eyebrow: string
  title: string
  subtitle: string
  arrivals: string
  departures: string
  notReady: string
  requests: string
  housekeeping: string
  attention: string
  allGood: string
  roomNotReady: string
  unassignedRequests: string
  openCalendar: string
  openRequests: string
  openHousekeeping: string
  refresh: string
}

const COPY: Record<"es" | "en" | "de", Copy> = {
  es: {
    eyebrow: "CENTRO OPERATIVO · HOY",
    title: "Lo que Santiago necesita resolver ahora",
    subtitle: "Llegadas, salidas, preparación y solicitudes del día en una sola vista.",
    arrivals: "Llegadas hoy",
    departures: "Salidas hoy",
    notReady: "Llegadas no listas",
    requests: "Solicitudes abiertas",
    housekeeping: "Limpieza pendiente",
    attention: "Requiere atención",
    allGood: "Sin bloqueos críticos para las llegadas de hoy.",
    roomNotReady: "habitación por preparar",
    unassignedRequests: "solicitud sin responsable",
    openCalendar: "Abrir calendario",
    openRequests: "Ver solicitudes",
    openHousekeeping: "Ver limpieza",
    refresh: "Actualizar",
  },
  en: {
    eyebrow: "OPERATIONS CENTER · TODAY",
    title: "What Santiago needs to resolve now",
    subtitle: "Today’s arrivals, departures, readiness and guest requests in one view.",
    arrivals: "Today’s arrivals",
    departures: "Today’s departures",
    notReady: "Arrivals not ready",
    requests: "Open requests",
    housekeeping: "Pending housekeeping",
    attention: "Needs attention",
    allGood: "No critical blockers for today’s arrivals.",
    roomNotReady: "room to prepare",
    unassignedRequests: "request without owner",
    openCalendar: "Open calendar",
    openRequests: "View requests",
    openHousekeeping: "View housekeeping",
    refresh: "Refresh",
  },
  de: {
    eyebrow: "BETRIEBSZENTRALE · HEUTE",
    title: "Was Santiago jetzt erledigen muss",
    subtitle: "Heutige Anreisen, Abreisen, Zimmerbereitschaft und Gästeanfragen auf einen Blick.",
    arrivals: "Anreisen heute",
    departures: "Abreisen heute",
    notReady: "Anreisen nicht bereit",
    requests: "Offene Anfragen",
    housekeeping: "Offene Reinigung",
    attention: "Handlungsbedarf",
    allGood: "Keine kritischen Blockaden für heutige Anreisen.",
    roomNotReady: "Zimmer vorzubereiten",
    unassignedRequests: "Anfrage ohne Verantwortlichen",
    openCalendar: "Kalender öffnen",
    openRequests: "Anfragen anzeigen",
    openHousekeeping: "Reinigung anzeigen",
    refresh: "Aktualisieren",
  },
}

function chileDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

function localized(language: "es" | "en" | "de", path: string) {
  return `/${language}${path}`
}

export function SantiagoTodayCommandCenter() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const locale = language === "en" || language === "de" ? language : "es"
  const copy = COPY[locale]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [departures, setDepartures] = useState(0)
  const [openRequests, setOpenRequests] = useState(0)
  const [unassignedRequests, setUnassignedRequests] = useState(0)
  const [pendingHousekeeping, setPendingHousekeeping] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = chileDate()

    const [arrivalsResult, departuresResult, requestsResult, housekeepingResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("id,guest_name,room_id,rooms(room_number,operational_status)")
        .eq("check_in", today)
        .not("status", "in", "(cancelled,checked_out,checked-out)"),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("check_out", today)
        .in("status", ["checked_in", "checked-in"]),
      supabase
        .from("hospitality_requests")
        .select("id,assigned_to,status")
        .not("status", "in", "(completed,resolved,cancelled)"),
      supabase
        .from("housekeeping_tasks")
        .select("id", { count: "exact", head: true })
        .eq("service_date", today)
        .not("status", "in", "(completed,cancelled)"),
    ])

    const firstError = arrivalsResult.error || departuresResult.error || requestsResult.error || housekeepingResult.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setArrivals((arrivalsResult.data ?? []) as unknown as Arrival[])
    setDepartures(departuresResult.count ?? 0)
    const requests = requestsResult.data ?? []
    setOpenRequests(requests.length)
    setUnassignedRequests(requests.filter((request) => !request.assigned_to).length)
    setPendingHousekeeping(housekeepingResult.count ?? 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("santiago-today-command-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void load())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load, supabase])

  const notReady = arrivals.filter((arrival) => {
    const status = arrival.rooms?.operational_status
    return status !== "ready" && status !== "inspected" && status !== "occupied"
  })

  const attentionCount = notReady.length + unassignedRequests

  return (
    <section className="border-b border-border bg-background px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{copy.eyebrow}</p>
            <h1 className="mt-1 text-xl font-medium text-foreground md:text-2xl">{copy.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />{copy.refresh}
          </Button>
        </div>

        {error && <div className="mt-4 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={DoorOpen} label={copy.arrivals} value={arrivals.length} />
          <Metric icon={LogOut} label={copy.departures} value={departures} />
          <Metric icon={AlertTriangle} label={copy.notReady} value={notReady.length} warning={notReady.length > 0} />
          <Metric icon={ClipboardList} label={copy.requests} value={openRequests} warning={unassignedRequests > 0} />
          <Metric icon={Sparkles} label={copy.housekeeping} value={pendingHousekeeping} />
        </div>

        <div className={`mt-3 flex flex-col gap-3 border p-4 md:flex-row md:items-center md:justify-between ${attentionCount > 0 ? "border-amber-400/35 bg-amber-400/8" : "border-primary/25 bg-primary/5"}`}>
          <div className="flex items-start gap-3">
            {attentionCount > 0 ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /> : <BedDouble className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
            <div>
              <p className="text-sm font-medium text-foreground">{attentionCount > 0 ? copy.attention : copy.allGood}</p>
              {attentionCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {notReady.length > 0 && `${notReady.length} ${copy.roomNotReady}`}
                  {notReady.length > 0 && unassignedRequests > 0 ? " · " : ""}
                  {unassignedRequests > 0 && `${unassignedRequests} ${copy.unassignedRequests}`}
                </p>
              )}
              {notReady.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {notReady.slice(0, 3).map((arrival) => (
                    <Badge key={arrival.id} variant="outline" className="border-amber-400/30 text-foreground">
                      {arrival.guest_name}{arrival.rooms?.room_number ? ` · ${arrival.rooms.room_number}` : ""}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><Link href={localized(locale, "/bookings/calendar")}>{copy.openCalendar}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="sm" variant="outline"><Link href={localized(locale, "/bookings/requests")}>{copy.openRequests}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="sm"><Link href={localized(locale, "/bookings/housekeeping")}>{copy.openHousekeeping}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ icon: Icon, label, value, warning = false }: { icon: typeof DoorOpen; label: string; value: number; warning?: boolean }) {
  return (
    <div className={`border bg-card p-4 ${warning ? "border-amber-400/35" : "border-border"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${warning ? "text-amber-500" : "text-primary"}`} />
      </div>
      <p className="mt-2 text-2xl font-medium text-foreground">{value}</p>
    </div>
  )
}

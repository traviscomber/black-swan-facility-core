"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ClipboardList, ConciergeBell, MapPin, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/hooks/use-language"
import { dailyOperationsCopy } from "@/lib/translations/daily-operations"

export const DAILY_OPERATIONS_REFRESH_EVENT = "booking-daily-operations-refresh"

type DailyItem = {
  id: string
  category: "housekeeping" | "hospitality" | "operations"
  title: string
  status: string
  priority: string | null
  context: string | null
  guestName?: string | null
  roomName?: string | null
  locationName?: string | null
  createdAt?: string | null
}

function chileOperatingDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

function relationLabel(value: unknown, key: string) {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | undefined
    return typeof first?.[key] === "string" ? String(first[key]) : null
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    return typeof record[key] === "string" ? String(record[key]) : null
  }
  return null
}

function requestTime(value: string | null | undefined, language: string) {
  if (!value) return null
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : language === "en" ? "en-US" : "es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function DailyOperationsPanel() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = dailyOperationsCopy[language]
  const categoryLabels = { housekeeping: "Housekeeping", hospitality: "Hospitality", operations: copy.operations }
  const detailCopy = language === "en"
    ? { guest: "Guest", location: "Location", room: "Room", received: "Received", priority: "Priority" }
    : language === "de"
      ? { guest: "Gast", location: "Ort", room: "Zimmer", received: "Empfangen", priority: "Priorität" }
      : { guest: "Huésped", location: "Casa", room: "Habitación", received: "Recibida", priority: "Prioridad" }
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DailyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = chileOperatingDate()
    const [year, month, day] = today.split("-").map(Number)
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
    const nextDay = nextDate.toISOString().slice(0, 10)
    const chileOffset = "-04:00"
    const hospitalityStart = `${today}T00:00:00${chileOffset}`
    const hospitalityEnd = `${nextDay}T00:00:00${chileOffset}`

    const [housekeepingResult, hospitalityResult, tasksResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("id, task_type, status, priority, notes, service_date").not("status", "in", "(completed,cancelled)").eq("service_date", today).limit(20),
      supabase
        .from("hospitality_requests")
        .select("id, request_type, status, priority, description, guest_name, created_at, room:rooms(room_number), location:locations(name)")
        .not("status", "in", "(completed,resolved,cancelled)")
        .gte("created_at", hospitalityStart)
        .lt("created_at", hospitalityEnd)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("tasks").select("id, title, status, priority, location_name, due_date").not("status", "in", "(completed,cancelled)").eq("due_date", today).limit(20),
    ])

    const firstError = housekeepingResult.error || hospitalityResult.error || tasksResult.error
    if (firstError) {
      setError(firstError.message)
      setItems([])
      setLoading(false)
      return
    }

    const nextItems: DailyItem[] = [
      ...(hospitalityResult.data ?? []).map((item) => ({
        id: item.id,
        category: "hospitality" as const,
        title: item.request_type || copy.hospitalityFallback,
        status: item.status,
        priority: item.priority,
        context: item.description,
        guestName: item.guest_name,
        roomName: relationLabel(item.room, "room_number"),
        locationName: relationLabel(item.location, "name"),
        createdAt: item.created_at,
      })),
      ...(housekeepingResult.data ?? []).map((item) => ({ id: item.id, category: "housekeeping" as const, title: item.task_type || copy.housekeepingFallback, status: item.status, priority: item.priority, context: item.notes })),
      ...(tasksResult.data ?? []).map((item) => ({ id: item.id, category: "operations" as const, title: item.title || copy.operationsFallback, status: item.status, priority: item.priority, context: item.location_name })),
    ]

    setItems(nextItems)
    setLoading(false)
  }, [copy.housekeepingFallback, copy.hospitalityFallback, copy.operationsFallback, supabase])

  useEffect(() => {
    void loadItems()

    const onLocalRefresh = () => void loadItems()
    window.addEventListener(DAILY_OPERATIONS_REFRESH_EVENT, onLocalRefresh)

    const channel = supabase
      .channel("bookings-daily-operations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void loadItems())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadItems())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => void loadItems())
      .subscribe()

    return () => {
      window.removeEventListener(DAILY_OPERATIONS_REFRESH_EVENT, onLocalRefresh)
      void supabase.removeChannel(channel)
    }
  }, [loadItems, supabase])

  const counts = useMemo(() => ({
    housekeeping: items.filter((item) => item.category === "housekeeping").length,
    hospitality: items.filter((item) => item.category === "hospitality").length,
    operations: items.filter((item) => item.category === "operations").length,
  }), [items])

  return (
    <section className="mx-3 mt-3 border border-border/50 bg-[var(--bs-bg-secondary)] md:mx-4">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{copy.title}</p>
            <p className="text-xs text-muted-foreground">{items.length} {copy.scheduled}</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />{counts.housekeeping}</Badge>
            <Badge variant={counts.hospitality > 0 ? "default" : "secondary"} className="gap-1"><ConciergeBell className="h-3 w-3" />{counts.hospitality}</Badge>
            <Badge variant="secondary">{counts.operations} {copy.operation}</Badge>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          {open ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronUp className="mr-2 h-4 w-4" />}
          {open ? copy.hide : copy.viewTasks}
        </Button>
      </div>

      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-border/30 px-4 py-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{copy.loading}</p>
          ) : error ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-destructive">{copy.loadFailed}: {error}</p>
              <Button size="sm" variant="outline" onClick={() => void loadItems()}>{copy.retry}</Button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {items.map((item) => {
                const isHospitality = item.category === "hospitality"
                const receivedAt = requestTime(item.createdAt, language)
                return (
                  <article
                    key={`${item.category}-${item.id}`}
                    className={isHospitality
                      ? "border border-primary/40 bg-[var(--bs-surface-primary)] p-3"
                      : "border border-border/30 bg-[var(--bs-surface-primary)] p-3"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isHospitality && <ConciergeBell className="h-4 w-4 shrink-0 text-primary" />}
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        </div>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{categoryLabels[item.category]}</p>
                      </div>
                      <Badge variant={isHospitality ? "default" : "outline"}>{item.status}</Badge>
                    </div>

                    {isHospitality ? (
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="border border-border/30 bg-background/20 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{detailCopy.guest}</p>
                          <p className="mt-1 font-medium text-foreground">{item.guestName || "—"}</p>
                        </div>
                        <div className="border border-border/30 bg-background/20 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{detailCopy.location}</p>
                          <p className="mt-1 flex items-center gap-1.5 font-medium text-foreground"><MapPin className="h-3 w-3 text-primary" />{item.locationName || "—"}</p>
                        </div>
                        <div className="border border-border/30 bg-background/20 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{detailCopy.room}</p>
                          <p className="mt-1 font-medium text-foreground">{item.roomName || "—"}</p>
                        </div>
                        <div className="border border-border/30 bg-background/20 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{detailCopy.received}</p>
                          <p className="mt-1 font-medium text-foreground">{receivedAt || "—"}</p>
                        </div>
                      </div>
                    ) : item.context ? (
                      <p className="mt-2 text-xs text-muted-foreground">{item.context}</p>
                    ) : null}

                    {item.priority && (
                      <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{detailCopy.priority}: {item.priority}</p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

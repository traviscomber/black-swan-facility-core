"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, isSameDay, parseISO } from "date-fns"
import { BedDouble, ConciergeBell, LogIn, LogOut, TriangleAlert, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { DAY_WIDTH, LABEL_WIDTH, type CalendarEvent } from "@/components/calendar/timeline-row"
import { useLanguage } from "@/lib/hooks/use-language"

type DailyCounts = {
  occupied: number
  arrivals: number
  departures: number
  housekeeping: number
  hospitality: number
  issues: number
}

const EMPTY: DailyCounts = { occupied: 0, arrivals: 0, departures: 0, housekeeping: 0, hospitality: 0, issues: 0 }

const copy = {
  en: { summary: "Daily summary", occupied: "Occupied", arrivals: "Arrivals", departures: "Departures", issues: "Issues" },
  es: { summary: "Resumen diario", occupied: "Ocupadas", arrivals: "Llegadas", departures: "Salidas", issues: "Incidencias" },
  de: { summary: "Tagesübersicht", occupied: "Belegt", arrivals: "Anreisen", departures: "Abreisen", issues: "Vorfälle" },
}

function dateKey(value: string | null | undefined) {
  if (!value) return null
  try { return format(parseISO(value), "yyyy-MM-dd") } catch { return null }
}

export function CalendarDailyOperationsSummary({ dates, reservations, timelineWidth }: { dates: Date[]; reservations: CalendarEvent[]; timelineWidth: number }) {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const c = copy[language]
  const [operations, setOperations] = useState<Record<string, Pick<DailyCounts, "housekeeping" | "hospitality" | "issues">>>({})

  const load = useCallback(async () => {
    const ids = [...new Set(reservations.map((reservation) => reservation.event_id))]
    if (ids.length === 0) { setOperations({}); return }

    const [housekeepingResult, hospitalityResult, issuesResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("reservation_id, scheduled_for, service_date, due_at").in("reservation_id", ids),
      supabase.from("hospitality_requests").select("reservation_id, promised_at, due_at, created_at").in("reservation_id", ids),
      supabase.from("issues").select("related_item_id, created_at").eq("related_item_type", "reservation").in("related_item_id", ids),
    ])

    const next: Record<string, Pick<DailyCounts, "housekeeping" | "hospitality" | "issues">> = {}
    const ensure = (key: string) => next[key] ??= { housekeeping: 0, hospitality: 0, issues: 0 }

    for (const item of housekeepingResult.data ?? []) {
      const key = dateKey(item.scheduled_for ?? item.service_date ?? item.due_at)
      if (key) ensure(key).housekeeping += 1
    }
    for (const item of hospitalityResult.data ?? []) {
      const key = dateKey(item.promised_at ?? item.due_at ?? item.created_at)
      if (key) ensure(key).hospitality += 1
    }
    for (const item of issuesResult.data ?? []) {
      const key = dateKey(item.created_at)
      if (key) ensure(key).issues += 1
    }
    setOperations(next)
  }, [reservations, supabase])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => dates.map((date) => {
    const key = format(date, "yyyy-MM-dd")
    const base = operations[key] ?? { housekeeping: 0, hospitality: 0, issues: 0 }
    return reservations.reduce<DailyCounts>((acc, reservation) => {
      const start = parseISO(reservation.starts_on)
      const end = parseISO(reservation.ends_on)
      if (date >= start && date < end) acc.occupied += 1
      if (isSameDay(date, start)) acc.arrivals += 1
      if (isSameDay(date, end)) acc.departures += 1
      return acc
    }, { ...EMPTY, ...base })
  }), [dates, operations, reservations])

  return (
    <div className="sticky bottom-0 z-30 flex border-t bg-background/95 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur">
      <div className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r bg-background px-3 text-xs font-semibold" style={{ width: LABEL_WIDTH, height: 46 }}>
        <Users className="h-4 w-4 text-primary" />
        {c.summary}
      </div>
      <div className="grid" style={{ width: timelineWidth, gridTemplateColumns: `repeat(${dates.length}, ${DAY_WIDTH}px)` }}>
        {counts.map((count, index) => (
          <div key={dates[index].toISOString()} className="flex h-[46px] flex-wrap content-center justify-center gap-x-1.5 gap-y-0.5 border-r px-1 text-[9px] text-muted-foreground">
            <span title={c.occupied} className="inline-flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{count.occupied}</span>
            <span title={c.arrivals} className="inline-flex items-center gap-0.5 text-emerald-700"><LogIn className="h-2.5 w-2.5" />{count.arrivals}</span>
            <span title={c.departures} className="inline-flex items-center gap-0.5 text-amber-700"><LogOut className="h-2.5 w-2.5" />{count.departures}</span>
            <span title="Housekeeping" className="inline-flex items-center gap-0.5"><BedDouble className="h-2.5 w-2.5" />{count.housekeeping}</span>
            <span title="Hospitality" className="inline-flex items-center gap-0.5"><ConciergeBell className="h-2.5 w-2.5" />{count.hospitality}</span>
            <span title={c.issues} className={`inline-flex items-center gap-0.5 ${count.issues > 0 ? "text-red-700" : ""}`}><TriangleAlert className="h-2.5 w-2.5" />{count.issues}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

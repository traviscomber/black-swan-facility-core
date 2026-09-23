"use client"

import { useState, useEffect } from "react"
import { format, addDays, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, isAfter, parseISO } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { createBrowserClient } from "@/lib/supabase/client"
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/hooks/use-language"
import { addReservationCopy, fillReservationCopy } from "@/lib/translations/add-reservation"
import { bookingTodayDate } from "@/lib/booking/timezone"

interface AvailabilityCalendarPickerProps {
  bedId: string
  roomId?: string
  onDateRangeSelect: (checkIn: string, checkOut: string) => void
  currentCheckIn?: string
  currentCheckOut?: string
  minDate?: Date
}

interface DayAvailability {
  date: Date
  isBooked: boolean
  isBlocked: boolean
  conflictsWith?: string
}

const DATE_LOCALES = { en: enUS, es, de } as const
const PICKER_COPY = {
  en: { previousMonth: "Previous month", nextMonth: "Next month", loading: "Loading" },
  es: { previousMonth: "Mes anterior", nextMonth: "Mes siguiente", loading: "Cargando" },
  de: { previousMonth: "Vorheriger Monat", nextMonth: "Nächster Monat", loading: "Wird geladen" },
} as const

export function AvailabilityCalendarPicker({
  bedId,
  roomId,
  onDateRangeSelect,
  currentCheckIn,
  currentCheckOut,
  minDate,
}: AvailabilityCalendarPickerProps) {
  const { language } = useLanguage()
  const copy = addReservationCopy[language]
  const pickerCopy = PICKER_COPY[language]
  const dateLocale = DATE_LOCALES[language]
  const weekDays = [copy.sun, copy.mon, copy.tue, copy.wed, copy.thu, copy.fri, copy.sat]
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [checkIn, setCheckIn] = useState<Date | null>(currentCheckIn ? parseISO(currentCheckIn) : null)
  const [checkOut, setCheckOut] = useState<Date | null>(currentCheckOut ? parseISO(currentCheckOut) : null)
  const [availability, setAvailability] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const supabase = createBrowserClient()
  const effectiveMinDate = startOfDay(minDate ?? bookingTodayDate())

  useEffect(() => { void loadAvailability() }, [currentMonth, bedId, roomId])

  async function loadAvailability() {
    if (!bedId) return
    setLoading(true)
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const [reservationResult, blockResult] = await Promise.all([
        supabase
          .from("reservations")
          .select("check_in, check_out, guest_name, status")
          .eq("bed_id", bedId)
          .gte("check_out", format(monthStart, "yyyy-MM-dd"))
          .lte("check_in", format(monthEnd, "yyyy-MM-dd"))
          .not("status", "in", "(cancelled, canceled, void, voided)"),
        roomId
          ? supabase
              .from("room_blocks")
              .select("start_date, end_date, reason, status")
              .eq("room_id", roomId)
              .eq("status", "active")
              .lte("start_date", format(monthEnd, "yyyy-MM-dd"))
              .gte("end_date", format(monthStart, "yyyy-MM-dd"))
          : Promise.resolve({ data: [], error: null }),
      ])
      if (reservationResult.error) throw reservationResult.error
      if (blockResult.error) throw blockResult.error
      const reservations = reservationResult.data ?? []
      const blocks = blockResult.data ?? []

      const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
      const nextAvailability: DayAvailability[] = days.map((date) => {
        const reservationConflict = reservations.find((res: { check_in: string; check_out: string; guest_name: string }) => {
          const resStart = parseISO(res.check_in)
          const resEnd = parseISO(res.check_out)
          return date >= resStart && date < resEnd
        })
        const blockConflict = blocks.find((block: { start_date: string; end_date: string; reason: string }) => {
          const blockStart = parseISO(block.start_date)
          const blockEnd = parseISO(block.end_date)
          return date >= blockStart && date < blockEnd
        })
        return { date, isBooked: Boolean(reservationConflict), isBlocked: Boolean(blockConflict), conflictsWith: reservationConflict?.guest_name ?? blockConflict?.reason }
      })
      setAvailability(nextAvailability)
    } catch (error) {
      console.error("[availability] load failed:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleDayClick(date: Date) {
    if (isBefore(date, effectiveMinDate)) return
    setRangeError(null)
    if (!checkIn) {
      setCheckIn(date)
      setCheckOut(null)
    } else if (!checkOut) {
      if (isAfter(date, checkIn)) {
        const crossesConflict = availability.some((item) => item.date >= checkIn && item.date < date && (item.isBooked || item.isBlocked))
        if (crossesConflict) { setRangeError(copy.rangeConflict); return }
        setCheckOut(date)
        onDateRangeSelect(format(checkIn, "yyyy-MM-dd"), format(date, "yyyy-MM-dd"))
      } else {
        setCheckIn(date)
        setCheckOut(null)
      }
    } else {
      setCheckIn(date)
      setCheckOut(null)
    }
  }

  function getDateStatus(date: Date): "available" | "booked" | "blocked" | "selected" | "in-range" {
    if (checkIn && date.toDateString() === checkIn.toDateString()) return "selected"
    if (checkOut && date.toDateString() === checkOut.toDateString()) return "selected"
    if (checkIn && checkOut && date > checkIn && date < checkOut) return "in-range"
    const dayAvail = availability.find((a) => a.date.toDateString() === date.toDateString())
    if (dayAvail?.isBlocked) return "blocked"
    return dayAvail?.isBooked ? "booked" : "available"
  }

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const nights = checkIn && checkOut ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div className="w-full max-w-md space-y-4 rounded-lg border bg-white p-4 dark:bg-slate-950">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setCurrentMonth(addDays(currentMonth, -32))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={pickerCopy.previousMonth}><ChevronLeft className="h-4 w-4" /></button>
        <h3 className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy", { locale: dateLocale })}</h3>
        <button type="button" onClick={() => setCurrentMonth(addDays(currentMonth, 32))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={pickerCopy.nextMonth}><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-1"><div className="h-3 w-3 rounded border border-green-200 bg-green-50" /><span>{copy.available}</span></div>
        <div className="flex items-center gap-1"><div className="h-3 w-3 rounded border border-red-300 bg-red-100" /><span>{copy.booked}</span></div>
        <div className="flex items-center gap-1"><div className="h-3 w-3 rounded border border-amber-300 bg-amber-100" /><span>{copy.blocked}</span></div>
        <div className="flex items-center gap-1"><div className="h-3 w-3 rounded border border-blue-300 bg-blue-100" /><span>{copy.selected}</span></div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => <div key={day} className="py-1 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{day}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {daysInMonth.map((date) => {
            const status = getDateStatus(date)
            const dayAvail = availability.find((a) => a.date.toDateString() === date.toDateString())
            const isDisabled = isBefore(date, effectiveMinDate) || status === "booked" || status === "blocked"
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => handleDayClick(date)}
                disabled={isDisabled}
                title={dayAvail?.conflictsWith ? fillReservationCopy(copy.bookedBy, { guest: dayAvail.conflictsWith }) : ""}
                className={`relative rounded border p-2 text-xs font-medium transition-colors ${status === "booked" ? "cursor-not-allowed border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900/20" : ""} ${status === "blocked" ? "cursor-not-allowed border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20" : ""} ${status === "available" ? "border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/10" : ""} ${status === "selected" ? "border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-600 dark:bg-blue-900/20" : ""} ${status === "in-range" ? "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/10" : ""} ${isBefore(date, effectiveMinDate) ? "cursor-not-allowed text-slate-400 opacity-30" : ""} ${!isSameMonth(date, currentMonth) ? "text-slate-300 dark:text-slate-600" : ""}`}
              >
                {format(date, "d")}
              </button>
            )
          })}
        </div>
      </div>

      {rangeError && <div className="border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{rangeError}</div>}

      {checkIn && checkOut && (
        <div className="space-y-1 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100"><CheckCircle2 className="h-4 w-4" />{copy.selectionConfirmed}</div>
          <p className="text-xs text-blue-800 dark:text-blue-200">{format(checkIn, "dd MMM", { locale: dateLocale })} → {format(checkOut, "dd MMM", { locale: dateLocale })} ({nights} {nights === 1 ? copy.night : copy.nights})</p>
        </div>
      )}

      {checkIn && !checkOut && (
        <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100"><AlertCircle className="h-4 w-4" />{copy.selectCheckOut}</div>
          <p className="text-xs text-amber-800 dark:text-amber-200">{copy.checkIn}: {format(checkIn, "dd MMM yyyy", { locale: dateLocale })}</p>
        </div>
      )}

      {(checkIn || checkOut) && (
        <Button variant="outline" size="sm" onClick={() => { setCheckIn(null); setCheckOut(null); setRangeError(null) }} className="w-full">{copy.clearSelection}</Button>
      )}
      {loading && <span className="sr-only">{pickerCopy.loading}</span>}
    </div>
  )
}

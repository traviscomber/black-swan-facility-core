"use client"

import { useState, useEffect } from "react"
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, isAfter, parseISO } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { createBrowserClient } from "@/lib/supabase/client"
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/hooks/use-language"
import { addReservationCopy, fillReservationCopy } from "@/lib/translations/add-reservation"

interface AvailabilityCalendarPickerProps {
  bedId: string
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

export function AvailabilityCalendarPicker({
  bedId,
  onDateRangeSelect,
  currentCheckIn,
  currentCheckOut,
  minDate = new Date(),
}: AvailabilityCalendarPickerProps) {
  const { language } = useLanguage()
  const copy = addReservationCopy[language]
  const dateLocale = language === "de" ? de : language === "es" ? es : enUS
  const weekDays = [copy.sun, copy.mon, copy.tue, copy.wed, copy.thu, copy.fri, copy.sat]
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [checkIn, setCheckIn] = useState<Date | null>(currentCheckIn ? parseISO(currentCheckIn) : null)
  const [checkOut, setCheckOut] = useState<Date | null>(currentCheckOut ? parseISO(currentCheckOut) : null)
  const [availability, setAvailability] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => { loadAvailability() }, [currentMonth, bedId])

  async function loadAvailability() {
    if (!bedId) return
    setLoading(true)
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("check_in, check_out, guest_name, status")
        .eq("bed_id", bedId)
        .gte("check_out", format(monthStart, "yyyy-MM-dd"))
        .lte("check_in", format(monthEnd, "yyyy-MM-dd"))
        .not("status", "in", "(cancelled, canceled, void, voided)")
      if (error) throw error

      const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
      const nextAvailability: DayAvailability[] = days.map((date) => {
        const conflict = reservations?.find((res: { check_in: string; check_out: string; guest_name: string }) => {
          const resStart = parseISO(res.check_in)
          const resEnd = parseISO(res.check_out)
          return date >= resStart && date < resEnd
        })
        return { date, isBooked: Boolean(conflict), isBlocked: false, conflictsWith: conflict?.guest_name }
      })
      setAvailability(nextAvailability)
    } catch (error) {
      console.error("[availability] load failed:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleDayClick(date: Date) {
    if (isBefore(date, minDate)) return
    if (!checkIn) {
      setCheckIn(date)
      setCheckOut(null)
    } else if (!checkOut) {
      if (isAfter(date, checkIn)) {
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

  function getDateStatus(date: Date): "available" | "booked" | "selected" | "in-range" {
    if (checkIn && checkOut) {
      if (date >= checkIn && date < checkOut) return "in-range"
      if (date.toDateString() === checkIn.toDateString()) return "selected"
      if (date.toDateString() === checkOut.toDateString()) return "selected"
    } else if (checkIn && date.toDateString() === checkIn.toDateString()) return "selected"
    const dayAvail = availability.find((a) => a.date.toDateString() === date.toDateString())
    return dayAvail?.isBooked ? "booked" : "available"
  }

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const nights = checkIn && checkOut ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div className="w-full max-w-md space-y-4 rounded-lg border bg-white p-4 dark:bg-slate-950">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setCurrentMonth(addDays(currentMonth, -32))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={language === "de" ? "Vorheriger Monat" : language === "es" ? "Mes anterior" : "Previous month"}><ChevronLeft className="h-4 w-4" /></button>
        <h3 className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy", { locale: dateLocale })}</h3>
        <button type="button" onClick={() => setCurrentMonth(addDays(currentMonth, 32))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={language === "de" ? "Nächster Monat" : language === "es" ? "Mes siguiente" : "Next month"}><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1"><div className="h-3 w-3 rounded border border-green-200 bg-green-50" /><span>{copy.available}</span></div>
        <div className="flex items-center gap-1"><div className="h-3 w-3 rounded border border-red-300 bg-red-100" /><span>{copy.booked}</span></div>
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
            const isDisabled = isBefore(date, minDate) || status === "booked"
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => handleDayClick(date)}
                disabled={isDisabled}
                title={dayAvail?.conflictsWith ? fillReservationCopy(copy.bookedBy, { guest: dayAvail.conflictsWith }) : ""}
                className={`relative rounded border p-2 text-xs font-medium transition-colors ${status === "booked" ? "cursor-not-allowed border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900/20" : ""} ${status === "available" ? "border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/10" : ""} ${status === "selected" ? "border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-600 dark:bg-blue-900/20" : ""} ${status === "in-range" ? "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/10" : ""} ${isBefore(date, minDate) ? "cursor-not-allowed text-slate-400 opacity-30" : ""} ${!isSameMonth(date, currentMonth) ? "text-slate-300 dark:text-slate-600" : ""}`}
              >
                {format(date, "d")}
              </button>
            )
          })}
        </div>
      </div>

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
        <Button variant="outline" size="sm" onClick={() => { setCheckIn(null); setCheckOut(null) }} className="w-full">{copy.clearSelection}</Button>
      )}
      {loading && <span className="sr-only">Loading</span>}
    </div>
  )
}

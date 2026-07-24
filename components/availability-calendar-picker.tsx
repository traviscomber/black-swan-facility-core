"use client"

import { useState, useEffect } from "react"
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, isBefore, isAfter, parseISO } from "date-fns"
import { createBrowserClient } from "@/lib/supabase/client"
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  conflictsWith?: string // guest name or reason
}

export function AvailabilityCalendarPicker({
  bedId,
  onDateRangeSelect,
  currentCheckIn,
  currentCheckOut,
  minDate = new Date(),
}: AvailabilityCalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [checkIn, setCheckIn] = useState<Date | null>(currentCheckIn ? parseISO(currentCheckIn) : null)
  const [checkOut, setCheckOut] = useState<Date | null>(currentCheckOut ? parseISO(currentCheckOut) : null)
  const [availability, setAvailability] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  // Load availability data for the current month
  useEffect(() => {
    loadAvailability()
  }, [currentMonth, bedId])

  async function loadAvailability() {
    if (!bedId) return

    setLoading(true)
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)

      // Fetch all reservations for this bed in the month
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("check_in, check_out, guest_name, status")
        .eq("bed_id", bedId)
        .gte("check_out", format(monthStart, "yyyy-MM-dd"))
        .lte("check_in", format(monthEnd, "yyyy-MM-dd"))
        .not("status", "in", "(cancelled, canceled, void, voided)")

      if (error) throw error

      // Generate availability for each day in month
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
      const availability: DayAvailability[] = days.map((date) => {
        const isBooked = reservations?.some((res: any) => {
          const resStart = parseISO(res.check_in)
          const resEnd = parseISO(res.check_out)
          // A day is booked if it falls within [check_in, check_out)
          return date >= resStart && date < resEnd
        })

        return {
          date,
          isBooked: !!isBooked,
          isBlocked: false,
          conflictsWith: reservations?.find((res: any) => {
            const resStart = parseISO(res.check_in)
            const resEnd = parseISO(res.check_out)
            return date >= resStart && date < resEnd
          })?.guest_name,
        }
      })

      setAvailability(availability)
    } catch (error) {
      console.error("[availability] load failed:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleDayClick(date: Date) {
    // Don't allow selecting past dates
    if (isBefore(date, minDate)) return

    // If no check-in selected, this is check-in
    if (!checkIn) {
      setCheckIn(date)
      setCheckOut(null)
    }
    // If check-in selected but not check-out
    else if (!checkOut) {
      if (isAfter(date, checkIn)) {
        setCheckOut(date)
        onDateRangeSelect(format(checkIn, "yyyy-MM-dd"), format(date, "yyyy-MM-dd"))
      } else {
        // User selected earlier date, reset
        setCheckIn(date)
        setCheckOut(null)
      }
    }
    // Both selected, start new selection
    else {
      setCheckIn(date)
      setCheckOut(null)
    }
  }

  function getDateStatus(date: Date): "available" | "booked" | "selected" | "in-range" {
    if (checkIn && checkOut) {
      if (date >= checkIn && date < checkOut) return "in-range"
      if (date.toDateString() === checkIn.toDateString()) return "selected"
      if (date.toDateString() === checkOut.toDateString()) return "selected"
    } else if (checkIn && date.toDateString() === checkIn.toDateString()) {
      return "selected"
    }

    const dayAvail = availability.find((a) => a.date.toDateString() === date.toDateString())
    return dayAvail?.isBooked ? "booked" : "available"
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  return (
    <div className="w-full max-w-md space-y-4 p-4 border rounded-lg bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(addDays(currentMonth, -32))}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-sm">{format(currentMonth, "MMMM yyyy")}</h3>
        <button
          onClick={() => setCurrentMonth(addDays(currentMonth, 32))}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-50 border border-green-200 rounded" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
          <span>Selected</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="space-y-2">
        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-xs font-semibold text-center text-slate-600 dark:text-slate-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysInMonth.map((date) => {
            const status = getDateStatus(date)
            const dayAvail = availability.find((a) => a.date.toDateString() === date.toDateString())
            const isDisabled = isBefore(date, minDate) || status === "booked"

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                disabled={isDisabled}
                title={dayAvail?.conflictsWith ? `Booked by ${dayAvail.conflictsWith}` : ""}
                className={`
                  relative p-2 text-xs font-medium rounded border transition-colors
                  ${status === "booked" && "bg-red-100 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-700 cursor-not-allowed"}
                  ${status === "available" && "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/10 dark:border-green-700"}
                  ${status === "selected" && "bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-900/20 dark:border-blue-600"}
                  ${status === "in-range" && "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-700"}
                  ${isBefore(date, minDate) && "opacity-30 cursor-not-allowed text-slate-400"}
                  ${!isSameMonth(date, currentMonth) && "text-slate-300 dark:text-slate-600"}
                `}
              >
                {format(date, "d")}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selection summary */}
      {checkIn && checkOut && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
            <CheckCircle2 className="w-4 h-4" />
            Selection Confirmed
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            {format(checkIn, "MMM dd")} → {format(checkOut, "MMM dd")} ({Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))} nights)
          </p>
        </div>
      )}

      {checkIn && !checkOut && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
            <AlertCircle className="w-4 h-4" />
            Select Check-Out
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-200">Check-in: {format(checkIn, "MMM dd, yyyy")}</p>
        </div>
      )}

      {/* Clear selection button */}
      {(checkIn || checkOut) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCheckIn(null)
            setCheckOut(null)
          }}
          className="w-full"
        >
          Clear Selection
        </Button>
      )}
    </div>
  )
}

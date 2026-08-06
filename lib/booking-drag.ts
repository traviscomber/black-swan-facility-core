import { addDays, format, parseISO } from "date-fns"

export type BookingDragMode = "move" | "resize-start" | "resize-end"

export type BookingDragDates = {
  checkIn: string
  checkOut: string
}

export function bookingStaysOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB
}

export function bookingDragDayDelta(pointerDelta: number, scrollDelta: number, dayWidth: number) {
  if (!Number.isFinite(dayWidth) || dayWidth <= 0) return 0
  return Math.round((pointerDelta + scrollDelta) / dayWidth)
}

export function bookingDragDates(
  mode: BookingDragMode,
  originalCheckIn: string,
  originalCheckOut: string,
  dayDelta: number,
): BookingDragDates {
  const checkIn = parseISO(originalCheckIn)
  const checkOut = parseISO(originalCheckOut)

  if (mode === "move") {
    return {
      checkIn: format(addDays(checkIn, dayDelta), "yyyy-MM-dd"),
      checkOut: format(addDays(checkOut, dayDelta), "yyyy-MM-dd"),
    }
  }

  if (mode === "resize-start") {
    return {
      checkIn: format(addDays(checkIn, dayDelta), "yyyy-MM-dd"),
      checkOut: originalCheckOut,
    }
  }

  return {
    checkIn: originalCheckIn,
    checkOut: format(addDays(checkOut, dayDelta), "yyyy-MM-dd"),
  }
}

export function bookingEdgeScrollVelocity(
  pointer: number,
  viewportStart: number,
  viewportEnd: number,
  threshold = 72,
  maximum = 20,
) {
  if (threshold <= 0 || maximum <= 0 || viewportEnd <= viewportStart) return 0

  if (pointer < viewportStart + threshold) {
    const intensity = Math.min(1, Math.max(0, (viewportStart + threshold - pointer) / threshold))
    return -Math.max(1, Math.round(maximum * intensity))
  }

  if (pointer > viewportEnd - threshold) {
    const intensity = Math.min(1, Math.max(0, (pointer - (viewportEnd - threshold)) / threshold))
    return Math.max(1, Math.round(maximum * intensity))
  }

  return 0
}

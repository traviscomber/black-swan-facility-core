import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import type { CalendarGeometry } from "./calendar-types"

export interface CalendarGeometryConfig {
  dayWidth: number
  rangeStart: Date
  rangeEnd: Date
  horizontalInset?: number
  minimumWidth?: number
}

export function clampDateToRange(date: Date, rangeStart: Date, rangeEnd: Date) {
  if (date < rangeStart) return rangeStart
  if (date > rangeEnd) return rangeEnd
  return date
}

export function geometryForDateRange(
  startsOn: string,
  endsOn: string,
  config: CalendarGeometryConfig,
): CalendarGeometry {
  const horizontalInset = config.horizontalInset ?? 4
  const minimumWidth = config.minimumWidth ?? 24
  const eventStart = clampDateToRange(parseISO(startsOn), config.rangeStart, config.rangeEnd)
  const eventEnd = clampDateToRange(parseISO(endsOn), config.rangeStart, config.rangeEnd)
  const offsetDays = Math.max(0, differenceInCalendarDays(eventStart, config.rangeStart))
  const durationDays = Math.max(1, differenceInCalendarDays(eventEnd, eventStart))

  return {
    left: offsetDays * config.dayWidth + horizontalInset,
    width: Math.max(minimumWidth, durationDays * config.dayWidth - horizontalInset * 2),
  }
}

export function dateForTimelineOffset(offsetX: number, rangeStart: Date, dayWidth: number) {
  const dayIndex = Math.max(0, Math.floor(offsetX / dayWidth))
  return addDays(rangeStart, dayIndex)
}

export function dayDeltaForPointer(
  pointerX: number,
  pointerStartX: number,
  scrollLeft: number,
  initialScrollLeft: number,
  dayWidth: number,
) {
  const pointerDelta = pointerX - pointerStartX
  const scrollDelta = scrollLeft - initialScrollLeft
  return Math.round((pointerDelta + scrollDelta) / dayWidth)
}

export function clampReservationRange(startsOn: string, endsOn: string) {
  const start = parseISO(startsOn)
  const end = parseISO(endsOn)

  if (end > start) return { startsOn, endsOn }

  return {
    startsOn,
    endsOn: addDays(start, 1).toISOString().slice(0, 10),
  }
}

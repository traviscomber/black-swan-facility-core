export const DAY_WIDTH = 96
export const LABEL_WIDTH = 272
export const ROW_HEIGHT = 44

function dayKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

function utcDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number)
  return Date.UTC(year, month - 1, day)
}

export function temporalSpanGeometry(startsOn: string, endsOn: string, visibleDates: Date[]): { left: number; width: number } {
  if (!visibleDates.length) return { left: 0, width: 0 }
  const visibleStart = utcDay(dayKey(visibleDates[0]))
  const start = utcDay(startsOn)
  const end = utcDay(endsOn)
  const oneDay = 86400000
  const leftDays = Math.round((start - visibleStart) / oneDay)
  const spanDays = Math.max(1, Math.round((end - start) / oneDay))
  return { left: leftDays * DAY_WIDTH, width: spanDays * DAY_WIDTH }
}
